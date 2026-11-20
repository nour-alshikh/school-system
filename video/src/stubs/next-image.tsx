import type { ImgHTMLAttributes } from "react";
import { staticFile } from "remotion";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string }; priority?: boolean; fill?: boolean };

/** next/image → a plain <img>. App paths like "/logos/x.svg" map to /video/public. */
export default function Image({ src, priority: _priority, fill: _fill, alt, ...rest }: Props) {
  const url = typeof src === "string" ? src : src.src;
  return <img {...rest} alt={alt ?? ""} src={url.startsWith("/") ? staticFile(url.slice(1)) : url} />;
}
