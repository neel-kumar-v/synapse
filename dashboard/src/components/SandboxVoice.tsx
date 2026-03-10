"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Frown, Meh, Pencil, ArrowLeft, Send, Loader2 } from "lucide-react";
import { refinePrompt, runPrompt } from "@/lib/workerClient";
import {
  AudioLinesIcon,
  type AudioLinesIconHandle,
} from "@/components/ui/audio-lines";
import { cn } from "@/lib/utils";
import useClickOutside from "@/hooks/useClickOutside";

const WS_PATH = "/ws/stt";
const TARGET_SAMPLE_RATE = 16000;
const MIN_SEGMENT_LENGTH = 2;
const MAX_VOICE_PROMPT_CHARS = 420;
const GARBAGE_REGEX =
  /^(?:um+|uh+|hm+|ah+|oh+|like|yeah|nope|okay|ok\s*)$|^[\s.,?!\-–—;:'"]+$/i;
const SPEAKING_DEBOUNCE_MS = 500;

const NO_ACTION_PHRASES = [
  "no clear request",
  "no actionable request",
  "unintelligible",
  "nothing to do",
  "no change needed",
];

const PREDEFINED_RESPONSES = [
  "Done! What do you think?",
  "Changes are live, take a look!",
  "All set! Let me know if you want any tweaks.",
  "Updated! How does that look?",
  "There you go! Anything else?",
];

function normalizeSegment(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function filterGarbageAndEmpty(raw: string): string | null {
  const s = normalizeSegment(raw);
  if (s.length < MIN_SEGMENT_LENGTH) return null;
  if (GARBAGE_REGEX.test(s)) return null;
  return s;
}

function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

function downsampleTo16k(
  float32: Float32Array,
  sourceSampleRate: number,
): Int16Array {
  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(float32.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const next = idx + 1 < float32.length ? float32[idx + 1] : float32[idx];
    const sample = float32[idx] * (1 - frac) + next * frac;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
  }
  return out;
}

function int16ToBase64(int16: Int16Array): string {
  const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Delay for each processing step: 5s ± 2s (3–7s) */
function stepDelayMs(): number {
  return 5000 + (Math.random() * 4 - 2) * 1000;
}

const PROCESSING_STEPS_VOICE = [
  "Analyzing transcription",
  "Refining prompt",
  "Contextualizing prompt",
  "Sending prompt to Cloudflare AI",
  "AI is updating code...",
  "Sending edit history to supermemory",
  "Finalizing edits...",
];

const PROCESSING_STEPS_TEXT = [
  "Refining prompt",
  "Contextualizing prompt",
  "Sending prompt to Cloudflare AI",
  "AI is updating code...",
  "Sending edit history to supermemory",
  "Finalizing edits...",
];

function isRejection(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    !text ||
    text.length < 2 ||
    NO_ACTION_PHRASES.some(
      (p) =>
        lower === p ||
        lower.startsWith(p + ".") ||
        lower.startsWith(p + ","),
    )
  );
}

let statusIdCounter = 0;

type ToolbarMode = "idle" | "text" | "transcribing";
type StatusUpdate = { id: string; text: string };

type SandboxVoiceProps = {
  sandboxId: string;
  emotionColor?: "green" | "yellow" | "red";
};

export function SandboxVoice({
  sandboxId,
  emotionColor = "yellow",
}: SandboxVoiceProps) {
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolbarMode>("idle");
  const modeRef = useRef<ToolbarMode>("idle");
  const [textInput, setTextInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const processingSourceRef = useRef<"voice" | "text">("text");
  const [refinedPromptDisplay, setRefinedPromptDisplay] = useState<string>("");
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [transcript, setTranscript] = useState({
    committed: "",
    partial: "",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mountRef = useRef(true);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioLinesRef = useRef<AudioLinesIconHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptPanelRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef("");
  const partialRef = useRef("");
  const isTranscribingRef = useRef(false);
  /** Minimum hold duration (ms) before we send captured audio to AI. Prevents accidental clicks from triggering capture. */
  const MIN_HOLD_MS = 400;
  const holdStartTimeRef = useRef<number>(0);
  /** Accumulates only committed segments received while the user is holding (shift+space or hold-to-speak). Sent to AI on release. */
  const capturedDuringHoldRef = useRef("");
  const [capturedDuringHoldState, setCapturedDuringHoldState] = useState("");
  const voiceSessionIdRef = useRef<Id<"sandboxAnalyticsSessions"> | null>(null);
  const voiceSessionStartPromiseRef = useRef<Promise<Id<"sandboxAnalyticsSessions">> | null>(null);

  const startVoiceSessionMutation = useMutation(api.analytics.startVoiceSession);
  const insertTranscriptEntryMutation = useMutation(api.analytics.insertTranscriptEntry);
  const endVoiceSessionMutation = useMutation(api.analytics.endVoiceSession);
  const sandboxIdRef = useRef(sandboxId);
  sandboxIdRef.current = sandboxId;

  // ── helpers ──

  const addStatus = useCallback((text: string) => {
    const id = `status-${++statusIdCounter}`;
    setStatusUpdates((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setStatusUpdates((prev) => prev.filter((s) => s.id !== id));
    }, 4000);
  }, []);

  const playTts = useCallback(async (text: string) => {
    setTtsPlaying(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(resolve);
      });
    } catch {
      /* silent */
    } finally {
      setTtsPlaying(false);
    }
  }, []);

  // ── request pipeline (refine → run) ──
  //
  // Refinement pipeline: raw input (voice or text) → POST /api/refine (Gemini turns
  // speech/chat into one short instruction) → if not rejected, POST /api/prompt with
  // refinedPrompt → worker uses refinedPrompt as USER REQUEST for the code LLM. See
  // worker src/index.ts api/refine and api/prompt.

  const processPrompt = useCallback(
    async (rawText: string, source: "voice" | "text") => {
      const text = filterGarbageAndEmpty(rawText);
      if (!text) {
        addStatus("No speech captured");
        return;
      }

      processingSourceRef.current = source;
      setIsProcessing(true);
      setProcessingStep(
        source === "voice"
          ? PROCESSING_STEPS_VOICE[0]
          : PROCESSING_STEPS_TEXT[0],
      );
      addStatus(
        source === "voice"
          ? "Analyzing voice prompt…"
          : "Processing text prompt…",
      );

      try {
        const { refinedPrompt: refined } = await refinePrompt({
          sandboxId,
          prompt: text,
        });

        if (isRejection(refined)) {
          addStatus("Couldn't understand the request");
          await playTts("Sorry, could you repeat that?");
          return;
        }

        setRefinedPromptDisplay(refined ?? "");
        addStatus("Sending AI refined prompt…");

        const result = await runPrompt({
          sandboxId,
          prompt: text,
          refinedPrompt: refined,
        });

        if ("error" in result) {
          addStatus(`Error: ${result.error}`);
          await playTts("Something went wrong. Please try again.");
          return;
        }

        const iframe = document.getElementById(
          "sandboxFrame",
        ) as HTMLIFrameElement | null;
        if (iframe) iframe.src = iframe.src;

        addStatus("Changes applied!");
        await playTts(pickRandom(PREDEFINED_RESPONSES));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addStatus(`Error: ${msg}`);
        await playTts("Something went wrong. Please try again.");
      } finally {
        setIsProcessing(false);
        setProcessingStep("");
        setRefinedPromptDisplay("");
      }
    },
    [sandboxId, addStatus, playTts],
  );

  // ── lifecycle ──

  useEffect(() => {
    mountRef.current = true;
    return () => {
      mountRef.current = false;
      if (voiceSessionIdRef.current) {
        endVoiceSessionMutation({ sessionId: voiceSessionIdRef.current }).catch(
          () => {},
        );
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [endVoiceSessionMutation]);

  // ── processing step cycle ──

  useEffect(() => {
    if (!isProcessing) return;
    const steps =
      processingSourceRef.current === "voice"
        ? PROCESSING_STEPS_VOICE
        : PROCESSING_STEPS_TEXT;
    let stepIndex = 1; // step 0 already set in processPrompt
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext() {
      if (stepIndex >= steps.length) return; // stop at final step
      timeoutId = setTimeout(() => {
        setProcessingStep(steps[stepIndex]);
        stepIndex++;
        scheduleNext();
      }, stepDelayMs());
    }

    timeoutId = setTimeout(() => {
      setProcessingStep(steps[stepIndex]);
      stepIndex++;
      scheduleNext();
    }, stepDelayMs());

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing]);

  // ── STT WebSocket ──

  useEffect(() => {
    let cancelled = false;
    const url = getWsUrl();
    if (!url) return;

    function connect() {
      if (!mountRef.current || wsRef.current?.readyState === WebSocket.OPEN)
        return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setSttError(null);

      ws.onopen = () => {
        if (cancelled || !mountRef.current) return;
        setIsListening(true);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "partial_transcript" && msg.text != null) {
            partialRef.current = msg.text ?? "";
            setTranscript((prev) => ({
              ...prev,
              partial: partialRef.current,
            }));
            setIsSpeaking(true);
            if (speakingTimeoutRef.current)
              clearTimeout(speakingTimeoutRef.current);
            speakingTimeoutRef.current = setTimeout(
              () => setIsSpeaking(false),
              SPEAKING_DEBOUNCE_MS,
            );
          } else if (
            msg.type === "committed_transcript" &&
            msg.text != null
          ) {
            const text = msg.text ?? "";
            committedRef.current +=
              (committedRef.current ? " " : "") + text;
            partialRef.current = "";
            setTranscript({
              committed: committedRef.current,
              partial: "",
            });
            // While user is holding, accumulate this segment into the "during hold" buffer (only this gets sent to AI)
            if (isTranscribingRef.current) {
              capturedDuringHoldRef.current +=
                (capturedDuringHoldRef.current ? " " : "") + text;
              setCapturedDuringHoldState(capturedDuringHoldRef.current);
            }
            // Persist to Convex sandboxTranscriptEntries
            const sbId = sandboxIdRef.current;
            const insertEntry = insertTranscriptEntryMutation;
            if (voiceSessionIdRef.current) {
              insertEntry({
                sandboxId: sbId,
                timestampMs: Date.now(),
                text,
                sessionId: voiceSessionIdRef.current,
                fromMic: true,
                isAiPrompt: false,
              }).catch(() => {});
            } else {
              if (!voiceSessionStartPromiseRef.current) {
                voiceSessionStartPromiseRef.current = startVoiceSessionMutation({
                  sandboxId: sbId,
                }).then((id) => {
                  voiceSessionIdRef.current = id;
                  return id;
                });
              }
              voiceSessionStartPromiseRef.current
                .then((sessionId) => {
                  insertEntry({
                    sandboxId: sbId,
                    timestampMs: Date.now(),
                    text,
                    sessionId,
                    fromMic: true,
                    isAiPrompt: false,
                  });
                })
                .catch(() => {});
            }
          } else if (msg.type === "error") {
            setSttError(msg.message || "STT error");
          } else if (msg.type === "upstream_closed") {
            const reason = String(msg.reason ?? "");
            if (!/\(1000\)|normal/i.test(reason))
              setSttError(reason || "STT connection closed");
            else setSttError(null);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!cancelled) setIsListening(false);
        wsRef.current = null;
        if (cancelled || !mountRef.current) return;
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        if (!cancelled) setSttError("WebSocket error");
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
      wsRef.current = null;
    };
  }, []);

  // ── audio capture ──

  useEffect(() => {
    if (
      !isListening ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } })
      .then((stream) => {
        streamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 48000 });
        audioContextRef.current = ctx;
        audioContext = ctx;
        const src = ctx.createMediaStreamSource(stream);
        source = src;
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processor = proc;
        proc.onaudioprocess = (e) => {
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16k(input, ctx.sampleRate);
          const b64 = int16ToBase64(int16);
          try {
            ws.send(
              JSON.stringify({
                type: "input_audio_chunk",
                audioBase64: b64,
                sampleRate: TARGET_SAMPLE_RATE,
              }),
            );
          } catch {
            /* ignore */
          }
        };
        src.connect(proc);
        proc.connect(ctx.destination);
      })
      .catch((err) => {
        setSttError(err.message || "Microphone access denied");
      });

    return () => {
      if (processor && source) {
        try {
          source.disconnect();
          processor.disconnect();
        } catch {
          /* ignore */
        }
      }
      if (audioContext) audioContext.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      audioContextRef.current = null;
    };
  }, [isListening]);

  // ── audio lines animation ──

  useEffect(() => {
    if (mode === "text") return;
    if (isSpeaking) audioLinesRef.current?.startAnimation();
    else audioLinesRef.current?.stopAnimation();
  }, [isSpeaking, mode]);

  // Reset audio lines to normal when returning from text mode (icon remounts and can be glitched)
  useLayoutEffect(() => {
    if (mode === "idle") audioLinesRef.current?.stopAnimation();
  }, [mode]);

  // ── mode transitions ──

  const enterTextMode = useCallback(() => {
    if (isProcessing || ttsPlaying) return;
    setMode("text");
    modeRef.current = "text";
    setTextInput("");
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isProcessing, ttsPlaying]);

  const exitTextMode = useCallback(() => {
    setMode("idle");
    modeRef.current = "idle";
    setTextInput("");
  }, []);

  const submitText = useCallback(() => {
    const text = textInput.trim();
    exitTextMode();
    if (text) processPrompt(text, "text");
  }, [textInput, exitTextMode, processPrompt]);

  const enterTranscribing = useCallback(() => {
    if (isProcessing || ttsPlaying || modeRef.current === "text") return;
    holdStartTimeRef.current = Date.now();
    // Start a fresh buffer for this hold; only what arrives from now until release is sent to AI
    capturedDuringHoldRef.current = "";
    setCapturedDuringHoldState("");
    partialRef.current = "";
    setTranscript((prev) => ({ ...prev, partial: "" }));
    isTranscribingRef.current = true;
    setMode("transcribing");
    modeRef.current = "transcribing";
  }, [isProcessing, ttsPlaying]);

  const exitTranscribing = useCallback(() => {
    if (!isTranscribingRef.current) return;
    const heldMs = Date.now() - holdStartTimeRef.current;
    isTranscribingRef.current = false;
    setMode("idle");
    modeRef.current = "idle";

    // Only send to AI if user held long enough (prevents accidental clicks from triggering capture)
    if (heldMs < MIN_HOLD_MS) return;

    // Send only what was accumulated during this hold (committed + current partial)
    let captured = (
      capturedDuringHoldRef.current +
      (partialRef.current ? " " + partialRef.current : "")
    ).trim();
    if (captured.length > MAX_VOICE_PROMPT_CHARS) {
      captured = captured.slice(-MAX_VOICE_PROMPT_CHARS).trim();
    }
    if (captured) processPrompt(captured, "voice");
  }, [processPrompt]);

  // ── click outside (text mode) ──

  useClickOutside(
    toolbarRef as React.RefObject<HTMLDivElement>,
    useCallback(() => {
      if (modeRef.current === "text") exitTextMode();
    }, [exitTextMode]),
  );

  // ── Shift+Space keyboard handler ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current === "text") return;
      if (e.shiftKey && e.code === "Space") {
        e.preventDefault();
        if (!isTranscribingRef.current) enterTranscribing();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isTranscribingRef.current) return;
      if (
        e.code === "Space" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight"
      ) {
        e.preventDefault();
        exitTranscribing();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enterTranscribing, exitTranscribing]);

  // ── Escape for text mode ──

  useEffect(() => {
    if (mode !== "text") return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitTextMode();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mode, exitTextMode]);

  // ── auto-scroll transcript panel ──

  useEffect(() => {
    if (mode === "transcribing" && transcriptPanelRef.current) {
      transcriptPanelRef.current.scrollTop =
        transcriptPanelRef.current.scrollHeight;
    }
  }, [transcript, mode]);

  // ── computed values ──

  const capturedText =
    mode === "transcribing"
      ? (
          capturedDuringHoldState +
          (transcript.partial ? " " + transcript.partial : "")
        ).trim()
      : "";

  const emotionBg =
    emotionColor === "green"
      ? "bg-green-500/20"
      : emotionColor === "red"
        ? "bg-red-500/20"
        : "bg-yellow-500/20";

  const emotionRing =
    emotionColor === "green"
      ? "ring-green-500/40"
      : emotionColor === "red"
        ? "ring-red-500/40"
        : "ring-yellow-500/40";

  const EmotionFaceIcon =
    emotionColor === "green"
      ? Smile
      : emotionColor === "red"
        ? Frown
        : Meh;

  const toolbarWidth =
    mode === "text" ? 450 : mode === "transcribing" ? 300 : 160;

  return (
    <>
      {/* ── AI loading overlay (when AI is making edits) ── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            key="ai-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              aria-hidden
            />
            <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/95 px-8 py-6 shadow-xl">
              <Loader2
                className="h-10 w-10 animate-spin text-white/90"
                aria-hidden
              />
              <p className="text-sm font-medium text-white/90">
                {processingStep || "Processing…"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── status updates zone ── */}
      <AnimatePresence>
        {statusUpdates.length > 0 && (
          <motion.div
            key="status-zone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed bottom-20 left-0 right-0 z-50 flex justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-1 px-8 pt-10 pb-4">
              <AnimatePresence mode="popLayout">
                {statusUpdates.map((u) => (
                  <motion.p
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="text-xs text-white/70"
                  >
                    {u.text}
                  </motion.p>
                ))}
              </AnimatePresence>
              {isProcessing && refinedPromptDisplay && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="mt-2 w-full max-w-[min(90vw,420px)] rounded-xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-lg backdrop-blur-md"
                >
                  <p className="text-[11px] text-white/50 mb-1.5">
                    Refined prompt:
                  </p>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {refinedPromptDisplay}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── toolbar area ── */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex flex-col items-center pointer-events-none gap-3">
        {/* transcript panel (transcribing mode) */}
        <AnimatePresence>
          {mode === "transcribing" && (
            <motion.div
              key="transcript-panel"
              ref={transcriptPanelRef}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="pointer-events-auto w-[340px] max-h-[120px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/90 px-4 py-3 text-sm text-white/80 shadow-lg backdrop-blur-md"
            >
              {capturedText ? (
                <p className="whitespace-pre-wrap wrap-break-word">
                  {capturedText}
                  <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-white/60" />
                </p>
              ) : (
                <p className="text-white/40 italic">Listening…</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* toolbar */}
        <div
          ref={toolbarRef}
          className="pointer-events-auto flex items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md overflow-hidden"
          style={{ width: toolbarWidth, transition: "width 0.3s ease-out" }}
        >
          {mode === "idle" && (
            <div className="flex items-center gap-4 px-5 py-3">
              {/* face icon with pulsing emotion ring */}
              <button
                type="button"
                className="relative flex items-center justify-center disabled:opacity-50"
                onMouseDown={enterTranscribing}
                onMouseUp={exitTranscribing}
                onMouseLeave={() => {
                  if (isTranscribingRef.current) exitTranscribing();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  enterTranscribing();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  exitTranscribing();
                }}
                disabled={isProcessing || ttsPlaying || !isListening}
                aria-label="Hold to speak"
              >
                <span
                  className={cn(
                    "absolute inset-[-4px] rounded-full animate-pulse ring-[3px]",
                    emotionRing,
                  )}
                />
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full",
                    emotionBg,
                  )}
                >
                  <EmotionFaceIcon className="h-5 w-5 text-white/90" />
                </span>
              </button>

              {/* audio lines */}
              <AudioLinesIcon
                key="audio-lines-idle"
                ref={audioLinesRef}
                size={24}
                className="text-white/60"
              />

              {/* pencil icon */}
              <button
                type="button"
                onClick={enterTextMode}
                disabled={isProcessing || ttsPlaying}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Type a prompt"
              >
                <Pencil className="h-4 w-4 text-white/70" />
              </button>
            </div>
          )}

          {mode === "text" && (
            <div className="flex items-center gap-1.5 p-1.5 w-full">
              <button
                type="button"
                onClick={exitTextMode}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4 text-white/70" />
              </button>
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitText();
                  }
                  if (e.key === "Backspace" && !textInput) {
                    e.preventDefault();
                    exitTextMode();
                  }
                }}
                placeholder="Type your prompt…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/40 outline-none py-2 px-2 min-h-[36px] max-h-[100px]"
              />
              <button
                type="button"
                onClick={submitText}
                disabled={!textInput.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
                aria-label="Send"
              >
                <Send className="h-4 w-4 text-white/80" />
              </button>
            </div>
          )}

          {mode === "transcribing" && (
            <div className="flex items-center gap-4 px-5 py-3">
              {/* face icon (active recording) */}
              <div className="relative flex items-center justify-center">
                <span className="absolute inset-[-4px] rounded-full animate-ping ring-[3px] ring-red-500/40" />
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
                  <EmotionFaceIcon className="h-5 w-5 text-red-400" />
                </span>
              </div>

              {/* expanded audio lines */}
              <AudioLinesIcon
                key="audio-lines-transcribing"
                ref={audioLinesRef}
                size={32}
                className="text-white/80"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── STT error ── */}
      {sttError && (
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs text-white shadow-lg">
          {sttError}
        </div>
      )}
    </>
  );
}
