import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, copy, timeline } from "../config";
import { Caption } from "../components/Caption";
import { Scene } from "../components/Scene";
import { useLayout } from "../lib/layout";
import { textIn } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";

const T = timeline.hook;

/** Scene 1 (0–8s): the icon springs in, resolves into the full logo, then the promise. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, width, height } = useLayout();

  const iconAt = beatAt("hook", T.icon);
  const fullAt = beatAt("hook", T.fullLogo);
  const icon = spring({ frame: frame - iconAt, fps, config: { damping: 12, stiffness: 110 } });
  const resolve = spring({ frame: frame - fullAt, fps, config: { damping: 200 }, durationInFrames: 24 });

  // The icon alone, centred, then it hands over to the full logo (icon + wordmark).
  const iconSize = 220 * u;
  const logoHeight = 190 * u;
  const centerY = height * 0.36;

  return (
    <Scene duration={sceneFrames("hook")}>
      <Img
        src={staticFile("logo-icon.svg")}
        style={{
          position: "absolute",
          width: iconSize,
          height: iconSize,
          left: width / 2 - iconSize / 2,
          top: centerY - iconSize / 2,
          transform: `scale(${icon * (1 - 0.25 * resolve)})`,
          opacity: 1 - resolve,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: centerY - logoHeight / 2,
          display: "flex",
          justifyContent: "center",
          opacity: resolve,
          transform: `scale(${interpolate(resolve, [0, 1], [0.92, 1])})`,
        }}
      >
        <Img src={staticFile("logo-full.svg")} style={{ height: logoHeight }} />
      </div>
      <Caption text={copy.hook.caption} sub={copy.hook.sub} enterAt={sec(T.caption)} />
      <div
        style={{
          position: "absolute",
          left: 96 * u,
          bottom: 56 * u,
          fontFamily: "var(--font-geist-sans)",
          fontSize: 22 * u,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: colors.teal,
          ...textIn(frame, sec(T.stats), u),
        }}
      >
        {copy.hook.stats}
      </div>
    </Scene>
  );
};
