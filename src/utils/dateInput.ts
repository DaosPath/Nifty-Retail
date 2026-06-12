export function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function isoToDisplay(iso: string, locale?: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  const paddedMonth = month.padStart(2, "0");
  const paddedDay = day.padStart(2, "0");
  if (locale?.toLowerCase().startsWith("en")) {
    return `${paddedMonth}/${paddedDay}/${year}`;
  }
  return `${paddedDay}/${paddedMonth}/${year}`;
}

export function parseDisplayDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    const date = new Date(`${year}-${month}-${day}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return "";
}

export function defaultExpiryIso(daysAhead = 180): string {
  return toIsoDate(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
}