export interface FormatDateOptions {
  locale?: string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
  relative?: boolean;
}

export function formatDate(dateInput: string | Date | number, options: FormatDateOptions = {}): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (Number.isNaN(date.getTime())) return String(dateInput);

  const { locale, relative, ...formatOptions } = options;

  if (relative) {
    return formatRelative(date, locale);
  }

  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatRelative(date: Date, locale?: string): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: 30.44 * 24 * 60 * 60 * 1000 },
    { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 1000 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

  for (const { unit, ms } of units) {
    if (absDiffMs >= ms) {
      const value = Math.round(diffMs / ms);
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
      } catch {
        return date.toISOString();
      }
    }
  }

  return "now";
}
