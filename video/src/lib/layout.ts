import { useVideoConfig } from "remotion";
import { type } from "../config";

/**
 * Layout from the configured size, never hardcoded to 1080. `u` scales a
 * 1080-reference length to the composition's shorter side, so 1920x1080
 * keeps text the same size and gains horizontal room.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return { width, height, u, wide: width / height > 1.2 };
}

/**
 * Where a scene's main card goes: between the eyebrow and the caption,
 * centred, with the caption's side margin. Wide frames cap the width so the
 * UI stays large instead of stretching.
 */
export function useStage() {
  const { width, height, u, wide } = useLayout();
  const side = type.caption.left * u;
  const top = 140 * u;
  const bottomReserve = 330 * u;
  const cardWidth = Math.min(width - 2 * side, 1240 * u);
  const cardHeight = height - top - bottomReserve;
  return { u, wide, width, height, top, side, cardWidth, cardHeight, cardLeft: (width - cardWidth) / 2 };
}
