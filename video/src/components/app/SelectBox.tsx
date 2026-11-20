import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The app's real Select, closed and controlled: shows `label` for `value`
 * exactly as a filled select looks in the app (or the placeholder when empty).
 */
export function SelectBox({
  value,
  label,
  placeholder,
  className,
}: {
  value: string | null;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select items={value && label ? [{ value, label }] : []} value={value}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
    </Select>
  );
}
