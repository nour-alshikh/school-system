import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { motion } from "../config";
import { Background } from "./Background";
import { VideoProviders, type Locale } from "./VideoProviders";

/**
 * A scene's stage: the slow camera push-in (scale 1→1.04 over the scene)
 * around its content, inside the providers. The Background is not part of
 * it; Main draws one Background under all scenes.
 */
export function Scene({ duration, locale, children }: { duration: number; locale?: Locale; children: ReactNode }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1, 1 + motion.cameraPush], { extrapolateRight: "clamp" });

  return (
    <VideoProviders locale={locale} style={{ position: "absolute", inset: 0 }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
    </VideoProviders>
  );
}

/** For previewing one scene alone in the Studio: the scene over its own Background. */
export function withBackground<P extends object>(Component: React.ComponentType<P>) {
  const Previewed = (props: P) => (
    <AbsoluteFill>
      <Background />
      <Component {...props} />
    </AbsoluteFill>
  );
  Previewed.displayName = `WithBackground(${Component.displayName ?? Component.name})`;
  return Previewed;
}
