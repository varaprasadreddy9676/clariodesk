import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";

type LottieData = { op?: number } & Record<string, unknown>;

/**
 * Renders a Lottie animation via lottie-web directly (the canonical,
 * battle-tested renderer our hand-authored JSON targets). Respects
 * prefers-reduced-motion by holding on the last frame instead of animating —
 * WCAG / Apple HIG reduced-motion guidance.
 */
export function LottiePlayer({
  animationData,
  loop = false,
  className,
  style,
}: {
  animationData: LottieData;
  loop?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const anim: AnimationItem = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: loop && !reducedMotion,
      autoplay: !reducedMotion,
      animationData,
    });

    if (reducedMotion) {
      const lastFrame = typeof animationData.op === "number" ? animationData.op - 1 : 0;
      anim.goToAndStop(lastFrame, true);
    }

    return () => anim.destroy();
    // animationData is treated as static per instance — callers pass a fixed import.
  }, [loop]);

  return <div ref={containerRef} className={className} style={style} />;
}
