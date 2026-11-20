import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, colors, copy, timeline, type } from "../config";
import { Highlighted } from "../components/Caption";
import { Scene } from "../components/Scene";
import { useLayout } from "../lib/layout";
import { textIn } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";

const T = timeline.outro;

/** Scene 6 (72–75s): background only, the full logo centred, tagline and URL. Ends on a held frame. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const logo = spring({ frame: frame - beatAt("outro", T.logo), fps, config: { damping: 14, stiffness: 120 } });

  return (
    <Scene duration={sceneFrames("outro")}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34 * u,
          fontFamily: "var(--font-geist-sans)",
          textAlign: "center",
        }}
      >
        <Img src={staticFile("logo-full.svg")} style={{ height: 210 * u, transform: `scale(${0.85 + 0.15 * logo})`, opacity: Math.min(1, logo * 1.4) }} />
        <div
          style={{
            fontSize: 64 * u,
            fontWeight: type.caption.weight,
            letterSpacing: type.caption.tracking,
            lineHeight: 1.05,
            color: colors.heading,
            ...textIn(frame, sec(T.tagline), u),
          }}
        >
          <Highlighted text={copy.outro.tagline} />
        </div>
        <div style={{ fontSize: 28 * u, fontWeight: 500, color: colors.body, ...textIn(frame, sec(T.url), u) }}>{brand.url}</div>
      </div>
    </Scene>
  );
};
