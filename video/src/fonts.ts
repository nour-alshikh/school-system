import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadCairo } from "@remotion/google-fonts/Cairo";

/**
 * The app's fonts: Geist (Latin) and Cairo (Arabic). loadFont() holds the
 * render (delayRender) until the files are loaded, so no frame ever shows a
 * fallback font.
 */
export const geist = loadGeist("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const cairo = loadCairo("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["arabic", "latin"],
});
