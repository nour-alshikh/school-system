import { Check } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { colors } from "../config";
import { popIn } from "../lib/motion";

/** Video chrome: the green "✓ …" pill (#16a34a on #dcfce7), popping in at `at`. */
export function SuccessChip({ at, children, size = 14 }: { at: number; children: React.ReactNode; size?: number }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <span
      style={{
        ...popIn(frame, at),
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        padding: `${size * 0.4}px ${size * 0.9}px`,
        borderRadius: 999,
        background: colors.successBg,
        color: colors.successText,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Check style={{ width: size * 1.1, height: size * 1.1 }} strokeWidth={3} />
      {children}
    </span>
  );
}
