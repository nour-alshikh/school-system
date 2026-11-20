import { Img, staticFile, useCurrentFrame } from "remotion";
import { brand, colors, type } from "../config";
import { useLayout } from "../lib/layout";
import { textIn } from "../lib/motion";

/** Top-left scene label: the icon logo + "School System · <scene>" in teal. */
export function Eyebrow({ scene, enterAt = 0 }: { scene: string; enterAt?: number }) {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const e = type.eyebrow;

  return (
    <div
      style={{
        position: "absolute",
        top: e.top * u,
        left: e.left * u,
        display: "flex",
        alignItems: "center",
        gap: 14 * u,
        fontFamily: "var(--font-geist-sans)",
        fontSize: e.size * u,
        fontWeight: e.weight,
        color: colors.teal,
        ...textIn(frame, enterAt, u),
      }}
    >
      <Img src={staticFile("logo-icon.svg")} style={{ width: e.icon * u, height: e.icon * u }} />
      <span>
        {brand.name} · {scene}
      </span>
    </div>
  );
}
