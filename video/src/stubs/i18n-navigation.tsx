import type { AnchorHTMLAttributes } from "react";
export { useRouter, usePathname } from "./next-navigation";

/** The app's locale-aware Link → a plain anchor (nothing is clickable in a video). */
export function Link({ href, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname: string } }) {
  return <a {...rest} href={typeof href === "string" ? href : href.pathname} />;
}
export const redirect = () => {};
export const getPathname = ({ href }: { href: string }) => href;
