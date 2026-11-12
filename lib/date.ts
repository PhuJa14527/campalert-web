const THAI_TZ = "Asia/Bangkok";

const dayMonth = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: THAI_TZ,
});

const monthYear = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: THAI_TZ,
});

const weekday = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  timeZone: THAI_TZ,
});

const numericDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: THAI_TZ,
});

// ใช้เที่ยงวัน UTC เพื่อไม่ให้วันที่เลื่อนข้ามวันตาม timezone
function toDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatDay(iso: string) {
  return dayMonth.format(toDate(iso));
}

export function formatDayFull(iso: string) {
  return numericDate.format(toDate(iso));
}

export function formatRange(start: string, end: string) {
  if (start === end) return formatDay(start);
  return `${formatDay(start)} - ${formatDay(end)}`;
}

export function formatMonthLabel(year: number, month: number) {
  return monthYear.format(new Date(Date.UTC(year, month, 1, 12)));
}

export function formatWeekday(iso: string) {
  return weekday.format(toDate(iso));
}

export function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: THAI_TZ,
  }).format(new Date());
}

export function isPast(iso: string | null, today: string | null) {
  if (!iso || !today) return false;
  return iso < today;
}
