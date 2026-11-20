const noop = () => {};
export const useRouter = () => ({ push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop });
export const usePathname = () => "/dashboard";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({ locale: "en" });
export const redirect = noop;
export const notFound = noop;
