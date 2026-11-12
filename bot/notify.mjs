import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CAMPS_FILE = new URL("../data/camps.json", import.meta.url);

export async function loadCamps() {
  const raw = JSON.parse(await readFile(CAMPS_FILE, "utf8"));
  return raw.camps ?? [];
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

export function addDaysISO(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ค่ายที่ปิดรับสมัครอีก advance วันพอดี (ยังไม่ปิด)
export function deadlineCamps(camps, advance, today) {
  const target = addDaysISO(today, advance);
  return camps.filter((camp) => camp.deadline === target);
}

// เทียบรายการค่ายกับ snapshot เดิม เพื่อหาค่ายที่เพิ่งเพิ่มเข้ามา
export function newCamps(camps, knownIds) {
  const known = new Set(knownIds);
  return camps.filter((camp) => !known.has(camp.id));
}

export function matchesField(camp, field) {
  return !field || field === "ทั้งหมด" || camp.field === field;
}

export function shouldNotify(settings, camp) {
  if (!matchesField(camp, settings.field)) return false;
  return settings.mode === "both" || settings.mode === "new" || settings.mode === "deadline";
}

export function notificationKey(campId, reason) {
  return `${campId}:${reason}`;
}

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Bangkok",
});

function formatDay(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return thaiDate.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function messageBody(camp, reason, advance) {
  const dates =
    !camp.startDate || !camp.endDate
      ? "ยังไม่ระบุวันจัด"
      : camp.startDate === camp.endDate
        ? formatDay(camp.startDate)
        : `${formatDay(camp.startDate)} - ${formatDay(camp.endDate)}`;
  const lines = [
    `**${camp.title}**`,
    `${camp.type} · ${camp.field}`,
    `จัด ${dates} · ${camp.location || "ไม่ระบุสถานที่"}`,
    `ค่าใช้จ่าย ${camp.fee || "ไม่ระบุ"}`,
  ];
  if (camp.deadline) {
    lines.push(
      reason === "deadline"
        ? `⏰ ปิดรับสมัครในอีก ${advance} วัน (${formatDay(camp.deadline)})`
        : `ปิดรับสมัคร ${formatDay(camp.deadline)}`,
    );
  }
  lines.push(`ข้อมูลจาก CAMPHUB: ${camp.sourceUrl}`);
  return lines.join("\n");
}

export function botDataDir() {
  return fileURLToPath(new URL("./data/", import.meta.url));
}
