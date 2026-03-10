const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const WebSocket = require("ws");
const { WebSocketServer } = require("ws");
const spawn = require("cross-spawn");

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const NEXT_DEV_PORT = Number(process.env.NEXT_DEV_PORT) || 3001;
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const ELEVENLABS_STT_URL =
  "wss://api.elevenlabs.io/v1/speech-to-text/realtime?audio_format=pcm_16000";

const HUME_STREAM_URL = "wss://api.hume.ai/v0/stream/models";

function forwardToClient(clientWs, payload) {
  if (clientWs.readyState !== 1) return; // OPEN
  try {
    clientWs.send(JSON.stringify(payload));
  } catch (err) {
    console.error("[STT] forward to client:", err);
  }
}

function forwardToElevenLabs(upstream, payload) {
  if (upstream.readyState !== 1) return;
  try {
    upstream.send(JSON.stringify(payload));
  } catch (err) {
    console.error("[STT] forward to ElevenLabs:", err);
  }
}

function handleSttClient(clientWs) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    forwardToClient(clientWs, {
      type: "error",
      message: "ELEVENLABS_API_KEY is not configured",
    });
    clientWs.close(1011, "Server configuration error");
    return;
  }

  let upstream = null;

  const cleanup = () => {
    if (upstream) {
      try {
        upstream.removeAllListeners();
        if (upstream.readyState === 1) upstream.close(1000, "Client closed");
      } catch (_) {}
      upstream = null;
    }
  };

  try {
    const upstreamUrl = ELEVENLABS_STT_URL;
    upstream = new WebSocket(upstreamUrl, {
      headers: { "xi-api-key": apiKey },
    });
  } catch (err) {
    console.error("[STT] ElevenLabs connect error:", err);
    forwardToClient(clientWs, {
      type: "error",
      message: err.message || "Failed to connect to speech-to-text",
    });
    clientWs.close(1011, "Upstream connect failed");
    return;
  }

  upstream.on("open", () => {
    // Client is already connected; no need to send anything. Client treats ws.onopen as STT ready.
  });

  upstream.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const mt = msg.message_type;
      if (mt === "partial_transcript") {
        forwardToClient(clientWs, { type: "partial_transcript", text: msg.text ?? "" });
      } else if (mt === "committed_transcript") {
        forwardToClient(clientWs, { type: "committed_transcript", text: msg.text ?? "" });
      } else if (
        mt === "error" ||
        mt === "auth_error" ||
        mt === "quota_exceeded" ||
        mt === "commit_throttled" ||
        mt === "unaccepted_terms" ||
        mt === "rate_limited" ||
        mt === "queue_overflow" ||
        mt === "resource_exhausted" ||
        mt === "session_time_limit_exceeded" ||
        mt === "input_error" ||
        mt === "chunk_size_exceeded" ||
        mt === "insufficient_audio_activity" ||
        mt === "transcriber_error"
      ) {
        forwardToClient(clientWs, {
          type: "error",
          message: msg.error ?? msg.message ?? "Unknown error",
        });
      }
      // session_started, committed_transcript_with_timestamps can be ignored or forwarded if needed
    } catch (e) {
      // ignore parse errors
    }
  });

  upstream.on("close", (code, reason) => {
    forwardToClient(clientWs, {
      type: "upstream_closed",
      reason: reason?.toString() || `Upstream closed (${code})`,
    });
    try {
      clientWs.close(1000, "Upstream closed");
    } catch (_) {}
    cleanup();
  });

  upstream.on("error", (err) => {
    console.error("[STT] ElevenLabs error:", err.message);
    forwardToClient(clientWs, {
      type: "upstream_closed",
      reason: err.message || "WebSocket error",
    });
    try {
      clientWs.close(1011, "Upstream error");
    } catch (_) {}
    cleanup();
  });

  clientWs.on("message", (data) => {
    if (!upstream || upstream.readyState !== 1) return;
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "input_audio_chunk") {
        const payload = {
          message_type: "input_audio_chunk",
          audio_base_64: msg.audioBase64,
          sample_rate: msg.sampleRate ?? 16000,
          commit: false,
        };
        forwardToElevenLabs(upstream, payload);
      }
    } catch (_) {}
  });

  clientWs.on("close", () => {
    cleanup();
  });

  clientWs.on("error", () => {
    cleanup();
  });
}

/** Hume Expression Measurement WebSocket proxy: adds X-Hume-Api-Key header (browser cannot). */
function handleHumeStreamClient(clientWs) {
  const apiKey = process.env.HUME_API_KEY || process.env.NEXT_PUBLIC_HUME_API_KEY;
  if (!apiKey) {
    try {
      clientWs.send(JSON.stringify({ error: "Hume API key missing: set HUME_API_KEY or NEXT_PUBLIC_HUME_API_KEY", code: "config" }));
    } catch (_) {}
    clientWs.close(1011, "Server configuration error");
    return;
  }

  let upstream = null;
  const cleanup = () => {
    if (upstream) {
      try {
        upstream.removeAllListeners();
        if (upstream.readyState === 1) upstream.close(1000, "Client closed");
      } catch (_) {}
      upstream = null;
    }
  };

  try {
    upstream = new WebSocket(HUME_STREAM_URL, {
      headers: { "X-Hume-Api-Key": apiKey },
    });
  } catch (err) {
    try {
      clientWs.send(JSON.stringify({ error: err.message || "Failed to connect to Hume", code: "connect" }));
    } catch (_) {}
    clientWs.close(1011, "Upstream connect failed");
    return;
  }

  upstream.on("open", () => {});

  upstream.on("message", (data) => {
    if (clientWs.readyState !== 1) return;
    try {
      if (Buffer.isBuffer(data)) clientWs.send(data);
      else if (typeof data === "string") clientWs.send(data);
      else clientWs.send(data.toString());
    } catch (_) {}
  });

  upstream.on("close", (code, reason) => {
    try {
      if (clientWs.readyState === 1) clientWs.close(code, reason);
    } catch (_) {}
    cleanup();
  });

  upstream.on("error", () => {
    try {
      if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ error: "Hume WebSocket error", code: "upstream_error" }));
      clientWs.close(1011, "Upstream error");
    } catch (_) {}
    cleanup();
  });

  clientWs.on("message", (data) => {
    if (!upstream || upstream.readyState !== 1) return;
    try {
      // Hume expects JSON text frames; sending as string ensures text frame (not binary).
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : typeof data === "string" ? data : String(data);
      upstream.send(text);
    } catch (_) {}
  });

  clientWs.on("close", () => cleanup());
  clientWs.on("error", () => cleanup());
}

/** In dev: proxy WebSocket upgrade for /_next/* to Next dev server on targetPort */
function proxyHmrUpgrade(request, socket, head, targetPort) {
  const hmrWss = new WebSocketServer({ noServer: true });
  hmrWss.on("connection", (clientWs, req) => {
    const targetUrl = `ws://127.0.0.1:${targetPort}${req.url}`;
    const upstream = new WebSocket(targetUrl, { headers: req.headers });
    upstream.on("open", () => {
      clientWs.on("message", (data) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      });
      upstream.on("message", (data) => {
        if (clientWs.readyState === 1) clientWs.send(data);
      });
    });
    const cleanup = () => {
      try {
        upstream.close();
        clientWs.close();
      } catch (_) {}
    };
    clientWs.on("close", cleanup);
    upstream.on("close", cleanup);
    clientWs.on("error", () => upstream.terminate());
    upstream.on("error", () => clientWs.terminate());
  });
  hmrWss.handleUpgrade(request, socket, head, (ws) => {
    hmrWss.emit("connection", ws, request);
  });
}

/** Proxy HTTP request to targetPort and pipe response */
function proxyHttp(req, res, targetPort) {
  const parsed = parse(req.url, true);
  const path = (parsed.pathname || "") + (parsed.search || "");
  const opts = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: path || "/",
    method: req.method,
    headers: req.headers,
  };
  const proxyReq = require("http").request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway (Next dev not reachable)");
  });
  req.pipe(proxyReq);
}

async function waitForPort(port, maxWaitMs = 60000) {
  const start = Date.now();
  const http = require("http");
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/", method: "HEAD" },
        () => resolve()
      );
      req.on("error", () => {
        if (Date.now() - start > maxWaitMs) reject(new Error("Next dev server did not start"));
        else setTimeout(tryConnect, 300);
      });
      req.setTimeout(5000);
      req.end();
    }
    setTimeout(tryConnect, 1500);
  });
}

async function runDev() {
  const nextChild = spawn("npx", ["next", "dev", "-p", String(NEXT_DEV_PORT)], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
    windowsHide: true,
  });
  nextChild.on("error", (err) => {
    console.error("Failed to start Next dev:", err);
    process.exit(1);
  });
  await waitForPort(NEXT_DEV_PORT);
  const server = createServer((req, res) => proxyHttp(req, res, NEXT_DEV_PORT));
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0] ?? "";
    if (pathname.startsWith("/ws/stt")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }
    if (pathname.startsWith("/ws/hume-stream")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }
    if (pathname.startsWith("/_next/")) {
      proxyHmrUpgrade(request, socket, head, NEXT_DEV_PORT);
      return;
    }
    socket.destroy();
  });
  wss.on("connection", (clientWs, request) => {
    const pathname = request?.url?.split("?")[0] ?? "";
    if (pathname.startsWith("/ws/hume-stream")) {
      handleHumeStreamClient(clientWs);
      return;
    }
    handleSttClient(clientWs);
  });
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port} (proxying to :${NEXT_DEV_PORT}, /ws/stt here)`);
  });
}

function runProd() {
  app.prepare().then(() => {
    const server = createServer(async (req, res) => {
      if (
        req.headers.upgrade === "websocket" &&
        req.url?.startsWith("/ws/stt")
      ) {
        return;
      }
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const pathname = request.url?.split("?")[0] ?? "";
      if (pathname.startsWith("/ws/stt")) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
        return;
      }
      if (pathname.startsWith("/ws/hume-stream")) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
        return;
      }
      if (pathname.startsWith("/_next/")) {
        return;
      }
      socket.destroy();
    });

    wss.on("connection", (clientWs, request) => {
      const pathname = request?.url?.split("?")[0] ?? "";
      if (pathname.startsWith("/ws/hume-stream")) {
        handleHumeStreamClient(clientWs);
        return;
      }
      handleSttClient(clientWs);
    });

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  });
}

if (dev) {
  runDev().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
} else {
  runProd();
}
