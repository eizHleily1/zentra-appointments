export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface DateStripOption {
  dateKey: string;
  dayLabel: string;
  weekdayLabel: string;
}

export function buildDateStripOptions(count = 14, startDate = new Date()): DateStripOption[] {
  const options: DateStripOption[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    options.push({
      dateKey: formatDateKey(date),
      dayLabel: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(date),
      weekdayLabel: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)
    });
  }

  return options;
}

export function formatConfirmationSchedule(startsAt: string, timeZone: string): { dayLine: string; timeLine: string } {
  const start = new Date(startsAt);
  const dayLine = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone
  }).format(start);
  const timeLine = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(start);

  return { dayLine, timeLine };
}
