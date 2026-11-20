import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

const here = process.cwd();
const frontendSrc = path.resolve(here, "../frontend/src");
const stub = (file: string) => path.resolve(here, "src/stubs", file);

// PNG frames: JPEG frames make the encoder output full-range yuvj420p instead of yuv420p.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// The video imports real UI from ../frontend/src (the "@/..." alias). Anything
// that would reach Next.js, the API or wall-clock state is swapped for a stub
// in src/stubs, so components render deterministically, frame by frame.
// Packages the frontend's components import (base-ui, lucide, recharts,
// use-intl, cva...) resolve from ../frontend/node_modules, so the frontend
// must have its dependencies installed. React is pinned to this folder's copy
// so there is only ever one React instance.
Config.overrideWebpackConfig((config) => {
  const withTailwind = enableTailwind(config);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      modules: ["node_modules", path.resolve(here, "node_modules"), path.resolve(here, "../frontend/node_modules")],
      alias: {
        ...(withTailwind.resolve?.alias as Record<string, string> | undefined),
        react: path.resolve(here, "node_modules/react"),
        "react-dom": path.resolve(here, "node_modules/react-dom"),
        "next-intl$": stub("next-intl.ts"),
        "next/image$": stub("next-image.tsx"),
        "next/navigation$": stub("next-navigation.ts"),
        "@/i18n/navigation$": stub("i18n-navigation.tsx"),
        "@/contexts/auth-context$": stub("auth-context.tsx"),
        "@/lib/api$": stub("api.ts"),
        "@/hooks/use-school-settings$": stub("use-school-settings.ts"),
        "@": frontendSrc,
      },
    },
  };
});
