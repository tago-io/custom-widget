export interface FormatValueOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  style?: "decimal" | "currency" | "percent" | "unit";
  currency?: string;
  unit?: string;
}

export function formatValue(value: string | number | boolean | undefined, options: FormatValueOptions = {}): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    value = num;
  }

  const { locale, ...formatOptions } = options;

  try {
    return new Intl.NumberFormat(locale, formatOptions).format(value);
  } catch {
    return String(value);
  }
}
