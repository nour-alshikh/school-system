"use client";

import { useTranslations } from "next-intl";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Option = { value: string; label: string };

// A step's fields grouped under a heading — "structured", not a flat stack
// of inputs. Only visual grouping, no separate form/validation scope.
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// `control`/`name` are typed loosely (`any`) so this one primitive can back
// both the student wizard's form values and the parent portal's — both
// shapes carry the same "father"/"mother" field paths this is built around.
export function SelectField({
  control,
  name,
  label,
  placeholder,
  options,
  disabled,
  onSelect,
}: {
  // Loosely typed: shared by two different form-value shapes (the student
  // wizard's and the parent portal's) that both carry the same
  // "father"/"mother" field paths this component writes into.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: string;
  label: string;
  placeholder: string;
  options: Option[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            items={options}
            value={(field.value as string) ?? ""}
            onValueChange={(value) => {
              field.onChange(value);
              onSelect?.(value as string);
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Guardian (father/mother) fields are identical, so the whole block is one
// component parameterized by which nested form path ("father" or "mother")
// it writes into, rather than duplicating every FormField twice. Shared by
// the student wizard (create) and the parent portal (edit) — both forms
// carry a `father`/`mother` object of this same shape.
export function GuardianFields({
  control,
  prefix,
  nationalities,
  bloodTypes,
  religions,
  governorateOptions,
}: {
  // Loosely typed: shared by two different form-value shapes (the student
  // wizard's and the parent portal's) that both carry the same
  // "father"/"mother" field paths this component writes into.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  prefix: "father" | "mother";
  nationalities: Option[];
  bloodTypes: Option[];
  religions: Option[];
  governorateOptions: Option[];
}) {
  const t = useTranslations("StudentWizard");

  return (
    <div className="flex flex-col gap-6">
      <Section title={t("sectionPersonalInfo")}>
        <FormField
          control={control}
          name={`${prefix}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guardianNameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.job`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guardianJobLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.national_id`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guardianNationalIdLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.phone`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guardianPhoneLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>

      <Section title={t("sectionLocation")}>
        <SelectField
          control={control}
          name={`${prefix}.nationality_id`}
          label={t("guardianNationalityLabel")}
          placeholder={t("guardianNationalityPlaceholder")}
          options={nationalities}
          disabled
        />
        <SelectField
          control={control}
          name={`${prefix}.governorate_id`}
          label={t("guardianGovernorateLabel")}
          placeholder={t("guardianGovernoratePlaceholder")}
          options={governorateOptions}
        />
        <SelectField
          control={control}
          name={`${prefix}.blood_type_id`}
          label={t("guardianBloodTypeLabel")}
          placeholder={t("guardianBloodTypePlaceholder")}
          options={bloodTypes}
        />
        <SelectField
          control={control}
          name={`${prefix}.religion_id`}
          label={t("guardianReligionLabel")}
          placeholder={t("guardianReligionPlaceholder")}
          options={religions}
        />
      </Section>

      <Section title={t("sectionAddress")}>
        <FormField
          control={control}
          name={`${prefix}.address`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("guardianAddressLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>
    </div>
  );
}
