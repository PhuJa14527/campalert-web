"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Camp } from "@/lib/camps";
import {
  formatDayFull,
  formatMonthLabel,
  formatRange,
  formatWeekday,
  isPast,
  toISO,
  todayISO,
} from "@/lib/date";

type View = "list" | "calendar";

const ALL = "ทั้งหมด";

const typeStyles: Record<string, string> = {
  "พัฒนาทักษะ/เวิร์กชอป": "bg-sky-50 text-sky-700 border-sky-200",
  "แนะแนวเรียนต่อ/อาชีพ": "bg-violet-50 text-violet-700 border-violet-200",
  "งานเปิดบ้าน/นิทรรศการ": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "เสวนา/สัมมนา": "bg-amber-50 text-amber-700 border-amber-200",
  "ประกวดแข่งขัน": "bg-rose-50 text-rose-700 border-rose-200",
  "อาสา/อนุรักษ์": "bg-lime-50 text-lime-700 border-lime-200",
};

function typeBadge(type: string) {
  return typeStyles[type] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function CampCard({ camp, today }: { camp: Camp; today: string | null }) {
  const closed = isPast(camp.deadline, today);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${typeBadge(camp.type)}`}
        >
          {camp.type}
        </span>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600">
          {camp.field}
        </span>
        {camp.deadline ? (
          <span
            className={`ml-auto text-xs font-medium ${closed ? "text-zinc-400" : "text-emerald-600"}`}
          >
            {closed ? "ปิดรับแล้ว" : "เปิดรับสมัคร"}
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug">{camp.title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{camp.organizer || "ไม่ระบุผู้จัด"}</p>

      <dl className="mt-3 space-y-1.5 text-sm text-zinc-600">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">วันที่</dt>
          <dd>
            {formatRange(camp.startDate, camp.endDate)}
            {camp.dateIsDeadline ? " (วันปิดรับสมัคร)" : ""}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">สถานที่</dt>
          <dd>{camp.location || "ไม่ระบุ"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">ค่าใช้จ่าย</dt>
          <dd>{camp.fee || "ไม่ระบุ"}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-xs text-zinc-500">
          {camp.deadline ? `ปิดรับ ${formatDayFull(camp.deadline)}` : "ไม่ระบุวันปิดรับ"}
        </p>
        <a
          className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white"
          href={camp.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          ดูที่ Camphub
        </a>
      </div>
    </article>
  );
}

export default function CampExplorer({
  camps,
  types,
}: {
  camps: Camp[];
  types: string[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState(ALL);
  const [view, setView] = useState<View>("list");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // อ่านเวลาปัจจุบันฝั่งเบราว์เซอร์เท่านั้น เพื่อให้หน้าเว็บยัง prerender ได้
  // (ช่วง prerender จะได้ null แล้วค่อยเติมวันที่จริงหลังเปิดหน้า)
  const today = useSyncExternalStore<string | null>(
    () => () => {},
    () => todayISO(),
    () => null,
  );

  const firstMonth = useMemo(() => {
    const first = camps[0];
    const [year, month] = (first?.startDate ?? "2026-01-01").split("-").map(Number);
    return { year, month: month - 1 };
  }, [camps]);

  const [month, setMonth] = useState(firstMonth);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return camps.filter((camp) => {
      if (type !== ALL && camp.type !== type) return false;
      if (!q) return true;
      return [camp.title, camp.organizer, camp.location, camp.field, camp.type, camp.level]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [camps, query, type]);

  const monthCamps = useMemo(() => {
    const startOfMonth = toISO(month.year, month.month, 1);
    const endOfMonth = toISO(month.year, month.month + 1, 0);
    return filtered.filter(
      (camp) => camp.startDate <= endOfMonth && camp.endDate >= startOfMonth,
    );
  }, [filtered, month]);

  const dayCamps = useMemo(() => {
    if (!selectedDay) return [];
    return filtered.filter(
      (camp) => camp.startDate <= selectedDay && camp.endDate >= selectedDay,
    );
  }, [filtered, selectedDay]);

  const leadingBlanks = new Date(Date.UTC(month.year, month.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      toISO(month.year, month.month, index + 1),
    ),
  ];

  function moveMonth(step: number) {
    const next = new Date(Date.UTC(month.year, month.month + step, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelectedDay(null);
  }

  function markedDates(iso: string) {
    return filtered.filter(
      (camp) => camp.startDate <= iso && camp.endDate >= iso,
    ).length;
  }

  return (
    <div>
      <section className="space-y-3">
        <label className="block">
          <span className="sr-only">ค้นหาค่าย</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อค่าย ผู้จัด จังหวัด หรือสาย"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-zinc-900"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {[ALL, ...types].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              aria-pressed={type === item}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                type === item
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">พบ {filtered.length} ค่าย</p>
          <div className="flex rounded-full border border-zinc-300 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`rounded-full px-3 py-1 ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
            >
              รายการ
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
              className={`rounded-full px-3 py-1 ${view === "calendar" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
            >
              ปฏิทิน
            </button>
          </div>
        </div>
      </section>

      {view === "list" ? (
        filtered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            ไม่พบค่ายที่ตรงกับเงื่อนไข ลองล้างคำค้นหรือเลือก &quot;ทั้งหมด&quot;
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {filtered.map((camp) => (
              <li key={camp.id}>
                <CampCard camp={camp} today={today} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              aria-label="เดือนก่อนหน้า"
            >
              ‹
            </button>
            <p className="text-base font-semibold">
              {formatMonthLabel(month.year, month.month)}
            </p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              aria-label="เดือนถัดไป"
            >
              ›
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, index) => {
              if (!iso) return <div key={`blank-${index}`} />;
              const count = markedDates(iso);
              const selected = selectedDay === iso;
              const isToday = today === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(selected ? null : iso)}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-lg border text-sm ${
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : count > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <span className={isToday ? "font-bold" : ""}>{Number(iso.slice(-2))}</span>
                  {count > 0 ? (
                    <span
                      className={`text-[10px] ${selected ? "text-white/80" : "text-emerald-700"}`}
                    >
                      {count} ค่าย
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">
              {selectedDay
                ? `${formatWeekday(selectedDay)} ${formatDayFull(selectedDay)}`
                : `ค่ายในเดือน${formatMonthLabel(month.year, month.month)}`}
            </p>
            {(selectedDay ? dayCamps : monthCamps).length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                ไม่มีค่ายในวันหรือเดือนนี้
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(selectedDay ? dayCamps : monthCamps).map((camp) => (
                  <li
                    key={camp.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{camp.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatRange(camp.startDate, camp.endDate)} · {camp.location || "ไม่ระบุสถานที่"}
                        </p>
                      </div>
                      <a
                        href={camp.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="shrink-0 text-xs font-medium text-emerald-700 underline"
                      >
                        ต้นฉบับ
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
