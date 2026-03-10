"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInDialog } from "@/components/SignInDialog";
import { Magnetic } from "@/components/ui/magnetic";
import { BorderTrail } from "../../../components/motion-primitives/border-trail";

const YOUTUBE_VIDEO_ID = "f-oB8XXwYKg";
const YOUTUBE_START_SECONDS = 64; // 1:04

const SYNAPSE_PATH =
  "M547.596558,142.588333 C542.816101,139.088135 539.528931,139.961685 535.398499,143.902679 C505.876587,172.070709 476.074402,199.945389 446.289398,227.836517 C444.050140,229.933395 443.162445,231.739395 444.580048,234.712097 C446.379822,238.486252 447.470978,242.569702 447.381409,246.787018 C447.284851,251.333038 449.774353,253.056747 453.778961,254.184998 C475.076447,260.185303 496.323700,266.364075 517.579224,272.512756 C534.844971,277.507294 552.096130,282.552094 569.357666,287.561188 C572.865112,288.579010 576.396179,289.515411 579.904907,290.528839 C582.688416,291.332825 584.471069,290.344757 586.253418,288.033112 C596.874939,274.257477 611.171875,268.451172 628.074707,271.496674 C645.434631,274.624512 657.406616,285.071381 661.381836,302.663666 C668.686157,334.988403 640.941711,358.035522 614.534607,353.845215 C609.369324,353.025635 604.396057,351.698120 599.961487,348.983429 C597.266907,347.333862 595.512878,347.936920 593.443665,349.915710 C581.047546,361.770233 568.575928,373.545746 556.130005,385.348114 C539.214661,401.388824 522.341492,417.474457 505.343414,433.426910 C502.496368,436.098816 502.034332,438.349579 503.588226,442.116028 C512.899048,464.684357 503.876404,488.278564 482.319061,498.588593 C461.453308,508.567932 436.273773,500.682495 425.179626,480.694427 C411.165680,455.445770 425.187012,423.389160 453.407745,417.309357 C463.574585,415.119019 474.072540,415.777100 483.576233,420.978851 C486.529480,422.595306 488.298889,421.941284 490.503204,419.837036 C520.385620,391.310974 550.320679,362.839966 580.281921,334.396606 C582.037781,332.729706 582.918335,331.276550 581.724426,328.794525 C579.760803,324.712402 578.901001,320.260529 578.409119,315.782196 C578.079041,312.777161 576.805969,311.078918 573.744873,310.201202 C544.790894,301.899567 515.870056,293.481842 486.946838,285.073181 C473.998047,281.308716 461.027130,277.612518 448.146637,273.625519 C443.787689,272.276276 441.057037,272.883545 438.116211,276.820618 C427.647308,290.835999 407.797363,296.021942 390.859253,289.721069 C372.826843,283.013184 362.750885,267.158630 363.721497,247.019745 C364.507416,230.712982 377.290619,215.621902 393.604614,210.750610 C404.875946,207.385056 415.387421,209.057114 425.539429,214.046921 C428.748749,215.624329 430.473511,215.032227 432.863251,212.773544 C463.129150,184.167282 493.473511,155.643829 523.864624,127.170517 C526.098022,125.078041 526.785767,123.355469 525.546143,120.287560 C513.365479,90.142624 532.448364,59.503624 564.780640,57.077938 C587.330994,55.386127 607.979675,72.538727 611.769287,96.110840 C615.240356,117.701546 600.003235,140.221039 578.666016,145.493652 C568.014343,148.125748 557.881775,146.996094 547.596558,142.588333z";

function DecorativeLogo({
  className,
  ariaHidden = true,
}: {
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 544"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <path fill="currentColor" d={SYNAPSE_PATH} />
    </svg>
  );
}

export function LandingPage() {
  const pathname = usePathname();
  const [signInOpen, setSignInOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  if (pathname !== "/") {
    return null;
  }

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col items-center justify-center px-4 py-16 bg-linear-to-b from-background to-muted/30">
      {/* Decorative background logos — very low opacity, partially off-screen, no scroll */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <DecorativeLogo
          className="absolute -left-[10%] top-[5%] w-[min(90vmax,28rem)] h-auto text-foreground opacity-10 from-foreground to-background"
          ariaHidden
        />
        <DecorativeLogo
          className="absolute z-100 top-1/2 -right-[15%] -translate-y-1/2 w-[min(90vmax,32rem)] h-auto text-foreground opacity-10"
          ariaHidden
        />
        <DecorativeLogo
          className="absolute z-0 bottom-10 -left-[20%] -translate-y-1/2 w-[min(90vmax,32rem)] h-auto text-foreground opacity-10"
          ariaHidden
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto mt-30 flex flex-col items-center">
        {/* Hero: value prop, subtitle, CTA */}
        <div className="text-center space-y-6 animate-landing-entry opacity-0">
          <h1
            className="text-4xl font-bold tracking-tight leading-snug text-foreground sm:text-5xl md:text-6xl"
            style={{
              filter:
                "drop-shadow(0 0 8px color-mix(in oklch, var(--primary) 60%, transparent)) drop-shadow(0 0 20px color-mix(in oklch, var(--primary) 35%, transparent)) drop-shadow(0 0 40px color-mix(in oklch, var(--primary) 15%, transparent)) drop-shadow(0 0 64px color-mix(in oklch, var(--primary) 0%, transparent))",
            }}
          >
            The most{" "}
            <span className="relative inline-block">
              complete
              <motion.span
                className="absolute bottom-0 left-0 right-0 h-[0.22em] bg-orange-500"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.4,
                }}
                style={{ transformOrigin: "left" }}
              />
            </span>{" "}
            UI/UX feedback loop ever.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto sm:text-xl">
            Turning user emotions, clicks, intent and direct feedback into
            automatic PRs to help you polish your site like never before.
          </p>
          <Magnetic intensity={0.5} range={380}>
            <Button
              size="lg"
              className="text-base"
              onClick={() => setSignInOpen(true)}
            >
              Get Started
            </Button>
          </Magnetic>
        </div>

        {/* Video area — thumbnail with play button, or embedded YouTube */}
        <div
          role="button"
          tabIndex={0}
          className="relative mt-12 w-full max-w-4xl animate-landing-entry opacity-0 rounded-xl border border-border aspect-video overflow-hidden cursor-pointer"
          style={{ animationDelay: "0.25s", animationFillMode: "both" }}
          onClick={() => !videoPlaying && setVideoPlaying(true)}
          onKeyDown={(e) => {
            if (!videoPlaying && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setVideoPlaying(true);
            }
          }}
        >
          <div className="absolute inset-0 z-20 pointer-events-none rounded-[inherit]">
            <BorderTrail
              className="bg-primary/80"
              size={100}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            />
          </div>
          {videoPlaying ? (
            <iframe
              className="absolute inset-0 w-full h-full z-10"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&start=${YOUTUBE_START_SECONDS}`}
              title="Synapse demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <>
              <Image
                src="/landing.png"
                alt="Synapse Analytics demo"
                fill
                className="object-cover"
                sizes="(max-width: 896px) 100vw, 896px"
                priority
              />
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                <div className="rounded-full bg-black/50 p-4 flex items-center justify-center ring-4 ring-white/20">
                  <Play className="size-12 text-white fill-white" strokeWidth={1.5} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        callbackURL="/"
        dismissible
      />
    </div>
  );
}
