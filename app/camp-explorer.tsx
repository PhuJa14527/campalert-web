"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Camp } from "@/lib/camps";
import { organizerKind, topicLabels } from "@/lib/camps";
import { getSupabase } from "@/lib/supabase";
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
type Status = "all" | "open" | "closed";

const BOOKMARK_KEY = "campalert.bookmarks.v1";

const typeStyles: Record<string, string> = {
  "พัฒนาทักษะ/เวิร์กชอป": "bg-sky-50 text-sky-700 border-sky-200",
  "แนะแนวเรียนต่อ/อาชีพ": "bg-violet-50 text-violet-700 border-violet-200",
  "งานเปิดบ้าน/นิทรรศการ": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "เสวนา/สัมมนา": "bg-amber-50 text-amber-700 border-amber-200",
  "ประกวดแข่งขัน": "bg-rose-50 text-rose-700 border-rose-200",
  "อาสา/อนุรักษ์": "bg-lime-50 text-lime-700 border-lime-200",
  "ติวสอบ/ทำพอร์ต": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "จำลองสนามสอบ": "bg-teal-50 text-teal-700 border-teal-200",
};

function typeBadge(type: string) {
  return typeStyles[type] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function matchPrice(id: string, price?: number | null) {
  const known = price !== null && price !== undefined;
  if (id === "free") return price === 0;
  if (id === "unknown") return !known;
  if (!known) return false;
  if (id === "low") return price > 0 && price <= 500;
  if (id === "mid") return price > 500 && price <= 1500;
  if (id === "high") return price > 1500;
  return false;
}

function matchFormat(id: string, camp: Camp) {
  if (id === "online") return Boolean(camp.online);
  if (id === "overnight") return Boolean(camp.overnight);
  if (id === "onsite") return !camp.online;
  return true;
}

const BOOKMARK_EVENT = "campalert:bookmarks-changed";
const EMPTY_IDS: string[] = [];

function readBookmarkRaw() {
  try {
    return window.localStorage.getItem(BOOKMARK_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeBookmarks(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(BOOKMARK_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BOOKMARK_EVENT, callback);
  };
}

// อ่านค่ายที่มาร์กจาก localStorage แบบ external store
// เพื่อไม่ให้ HTML ตอน prerender กับตอนเปิดหน้าไม่ตรงกัน
function useLocalBookmarks() {
  const raw = useSyncExternalStore(subscribeBookmarks, readBookmarkRaw, () => "[]");
  return useMemo(() => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : EMPTY_IDS;
    } catch {
      return EMPTY_IDS;
    }
  }, [raw]);
}

function writeLocalBookmarks(ids: string[]) {
  try {
    window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(ids));
  } catch {
    // โหมดส่วนตัวบางตัวเขียนไม่ได้ ก็ยังใช้ในหน้านี้ได้
  }
  window.dispatchEvent(new Event(BOOKMARK_EVENT));
}

function useBookmarks() {
  const localIds = useLocalBookmarks();
  // null = ยังไม่รู้ว่าล็อกอินหรือเปล่า / ไม่ได้ล็อกอิน ใช้ของในเครื่อง
  const [remoteIds, setRemoteIds] = useState<string[] | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const db = supabase;
    let active = true;

    async function sync(userId: string | null) {
      if (!userId) {
        if (active) setRemoteIds(null);
        return;
      }

      const { data } = await db.from("bookmarks").select("camp_id").eq("user_id", userId);

      const remote = (data ?? []).map((row) => row.camp_id as string);
      const merged = [...new Set([...readLocalIds(), ...remote])];
      const missing = merged.filter((id) => !remote.includes(id));

      if (missing.length > 0) {
        await db
          .from("bookmarks")
          .upsert(
            missing.map((campId) => ({ user_id: userId, camp_id: campId })),
            { onConflict: "user_id,camp_id", ignoreDuplicates: true },
          );
      }

      if (!active) return;
      setRemoteIds(merged);
      writeLocalBookmarks(merged);
    }

    void db.auth.getSession().then(({ data }) => {
      void sync(data.session?.user.id ?? null);
    });

    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      void sync(session?.user.id ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const ids = remoteIds ?? localIds;

  function toggleBookmark(id: string) {
    const saved = ids.includes(id);
    const next = saved ? ids.filter((item) => item !== id) : [...ids, id];

    if (remoteIds) setRemoteIds(next);
    writeLocalBookmarks(next);

    const supabase = getSupabase();
    if (!supabase) return;

    // เขียนลงฐานข้อมูลทุกครั้งถ้ามี session ค้างอยู่
    // (ไม่ต้องรอ sync รอบแรกเสร็จก่อน กันกดดาวแล้วหาย)
    void supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) return;

      const { error } = saved
        ? await supabase.from("bookmarks").delete().eq("user_id", userId).eq("camp_id", id)
        : await supabase.from("bookmarks").insert({ user_id: userId, camp_id: id });

      if (error) console.error("บันทึกค่ายที่มาร์กไม่สำเร็จ:", error.message);
    });
  }

  return { ids, toggleBookmark };
}

function readLocalIds(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOKMARK_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
  limit = 8,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const visible = expanded ? options : options.slice(0, limit);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {visible.map((option) => (
          <Chip
            key={option}
            active={selected.includes(option)}
            onClick={() => onToggle(option)}
          >
            {option}
          </Chip>
        ))}
        {options.length > limit ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full px-2 py-1.5 text-sm text-emerald-700 underline"
          >
            {expanded ? "ย่อลง" : `เพิ่มเติม (${options.length - limit})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BookmarkButton({
  saved,
  onClick,
  title,
}: {
  saved: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `เลิกมาร์ก ${title}` : `มาร์ก ${title}`}
      title={saved ? "เลิกมาร์ก" : "มาร์กค่ายนี้"}
      className={`rounded-full border px-2.5 py-1 text-sm leading-none ${
        saved
          ? "border-amber-300 bg-amber-50 text-amber-600"
          : "border-zinc-200 bg-white text-zinc-400 hover:text-amber-500"
      }`}
    >
      {saved ? "★" : "☆"}
    </button>
  );
}

function CampCard({
  camp,
  today,
  saved,
  onBookmark,
}: {
  camp: Camp;
  today: string | null;
  saved: boolean;
  onBookmark: () => void;
}) {
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
        {camp.certificate ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            มีเกียรติบัตร
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-xs font-medium ${closed ? "text-zinc-400" : "text-emerald-600"}`}
          >
            {closed ? "ปิดรับแล้ว" : "เปิดรับสมัคร"}
          </span>
          <BookmarkButton saved={saved} onClick={onBookmark} title={camp.title} />
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug">{camp.title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{camp.organizer || "ไม่ระบุผู้จัด"}</p>

      <dl className="mt-3 space-y-1.5 text-sm text-zinc-600">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">วันจัด</dt>
          <dd>
            {camp.startDate && camp.endDate
              ? formatRange(camp.startDate, camp.endDate)
              : "ยังไม่ระบุวันจัด (ดูที่ Camphub)"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">สถานที่</dt>
          <dd>
            {camp.location || "ไม่ระบุ"}
            {camp.online ? " · ออนไลน์" : ""}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">ค่าใช้จ่าย</dt>
          <dd>{camp.fee || "ไม่ระบุ"}</dd>
        </div>
        {camp.levels && camp.levels.length > 0 ? (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-400">ระดับชั้น</dt>
            <dd>{camp.levels.join(", ")}</dd>
          </div>
        ) : null}
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
          ดูรายละเอียดที่ Camphub
        </a>
      </div>
    </article>
  );
}

export default function CampExplorer({
  camps,
  types,
  levels,
  provinces,
  formats,
  prices,
  topicGroups,
  organizerKinds,
  organizerCounts,
  fetchedLabel,
  stats,
}: {
  camps: Camp[];
  types: string[];
  levels: string[];
  provinces: string[];
  formats: { id: string; label: string }[];
  prices: { id: string; label: string }[];
  topicGroups: { id: string; label: string; options: { slug: string; label: string; count: number }[] }[];
  organizerKinds: { id: string; label: string }[];
  organizerCounts: Record<string, number>;
  fetchedLabel: string;
  stats: { sourcePages: number; foundLinks: number; keptCamps: number };
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ทั้งหมด");
  const [topics, setTopics] = useState<string[]>([]);
  const [organizer, setOrganizer] = useState("all");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { ids: bookmarked, toggleBookmark } = useBookmarks();

  // อ่านเวลาปัจจุบันฝั่งเบราว์เซอร์เท่านั้น เพื่อให้หน้าเว็บยัง prerender ได้
  const today = useSyncExternalStore<string | null>(
    () => () => {},
    () => todayISO(),
    () => null,
  );

  const firstMonth = useMemo(() => {
    const first = camps.find((camp) => camp.startDate);
    const [year, month] = (first?.startDate ?? "2026-01-01").split("-").map(Number);
    return { year, month: month - 1 };
  }, [camps]);

  const [month, setMonth] = useState(firstMonth);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return camps.filter((camp) => {
      if (type !== "ทั้งหมด" && camp.type !== type) return false;
      if (topics.length > 0) {
        const slugs = camp.slugs ?? [];
        if (!topics.some((slug) => slugs.includes(slug))) return false;
      }
      if (organizer !== "all" && organizerKind(camp) !== organizer) return false;
      if (
        selectedLevels.length &&
        !selectedLevels.some((level) => (camp.levels ?? []).includes(level))
      )
        return false;
      if (selectedProvinces.length && !selectedProvinces.includes(camp.province ?? ""))
        return false;
      if (selectedPrices.length && !selectedPrices.some((id) => matchPrice(id, camp.price)))
        return false;
      if (selectedFormats.length && !selectedFormats.some((id) => matchFormat(id, camp)))
        return false;
      if (status !== "all") {
        const closed = isPast(camp.deadline, today);
        if (status === "open" && closed) return false;
        if (status === "closed" && !closed) return false;
      }
      if (bookmarkedOnly && !bookmarked.includes(camp.id)) return false;
      if (!q) return true;
      return [
        camp.title,
        camp.organizer,
        camp.location,
        camp.field,
        camp.type,
        camp.level,
        camp.province,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    camps,
    query,
    type,
    topics,
    organizer,
    selectedLevels,
    selectedProvinces,
    selectedPrices,
    selectedFormats,
    status,
    bookmarkedOnly,
    bookmarked,
    today,
  ]);

  const activeFilterCount =
    topics.length +
    selectedLevels.length +
    selectedProvinces.length +
    selectedPrices.length +
    selectedFormats.length +
    (status !== "all" ? 1 : 0) +
    (type !== "ทั้งหมด" ? 1 : 0) +
    (organizer !== "all" ? 1 : 0) +
    (bookmarkedOnly ? 1 : 0);

  function clearFilters() {
    setType("ทั้งหมด");
    setTopics([]);
    setOrganizer("all");
    setSelectedLevels([]);
    setSelectedProvinces([]);
    setSelectedPrices([]);
    setSelectedFormats([]);
    setStatus("all");
    setBookmarkedOnly(false);
    setQuery("");
  }

  const monthCamps = useMemo(() => {
    const startOfMonth = toISO(month.year, month.month, 1);
    const endOfMonth = toISO(month.year, month.month + 1, 0);
    return filtered.filter(
      (camp) =>
        camp.startDate &&
        camp.endDate &&
        camp.startDate <= endOfMonth &&
        camp.endDate >= startOfMonth,
    );
  }, [filtered, month]);

  const dayCamps = useMemo(() => {
    if (!selectedDay) return [];
    return filtered.filter(
      (camp) =>
        camp.startDate &&
        camp.endDate &&
        camp.startDate <= selectedDay &&
        camp.endDate >= selectedDay,
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

  function dayCampsOn(iso: string) {
    return filtered.filter(
      (camp) =>
        camp.startDate &&
        camp.endDate &&
        camp.startDate <= iso &&
        camp.endDate >= iso,
    );
  }

  const bookmarkedCamps = camps.filter((camp) => bookmarked.includes(camp.id));

  return (
    <div>
      <section className="space-y-3">
        {/* แถบตัวกรองแบบ CAMPHUB: ค้นหา + dropdown แยกตามกลุ่ม */}
        <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl border border-zinc-300 bg-white">
          <label className="flex min-w-[180px] flex-1 items-center gap-2 px-3">
            <span className="sr-only">ค้นหาค่ายและกิจกรรม</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาค่ายและกิจกรรม"
              className="w-full bg-transparent py-3 text-base outline-none"
            />
          </label>

          {topicGroups.map((group) => {
            const picked = group.options.find((option) => topics.includes(option.slug));
            return (
              <label
                key={group.id}
                className={`flex items-center border-l border-zinc-200 px-2 text-sm ${
                  picked ? "font-medium text-emerald-700" : "text-zinc-700"
                }`}
              >
                <select
                  value={picked?.slug ?? ""}
                  onChange={(event) => {
                    const slug = event.target.value;
                    setTopics((prev) => {
                      const others = prev.filter(
                        (item) => !group.options.some((option) => option.slug === item),
                      );
                      return slug ? [...others, slug] : others;
                    });
                  }}
                  className="bg-transparent py-3 pr-1 outline-none"
                >
                  <option value="">{group.label}</option>
                  {group.options.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}

          <label
            className={`flex items-center border-l border-zinc-200 px-2 text-sm ${
              type !== "ทั้งหมด" ? "font-medium text-emerald-700" : "text-zinc-700"
            }`}
          >
            <select
              value={type === "ทั้งหมด" ? "" : type}
              onChange={(event) => setType(event.target.value || "ทั้งหมด")}
              className="bg-transparent py-3 pr-1 outline-none"
            >
              <option value="">รูปแบบค่าย</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`flex items-center border-l border-zinc-200 px-2 text-sm ${
              organizer !== "all" ? "font-medium text-emerald-700" : "text-zinc-700"
            }`}
          >
            <select
              value={organizer === "all" ? "" : organizer}
              onChange={(event) => setOrganizer(event.target.value || "all")}
              className="bg-transparent py-3 pr-1 outline-none"
            >
              <option value="">ผู้จัด</option>
              {organizerKinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label} ({organizerCounts[kind.id] ?? 0})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="border-l border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700"
          >
            ตัวกรอง{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {/* ป้ายที่เลือกอยู่ กดกากบาทเพื่อเอาออกทีละอัน */}
        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => setTopics((prev) => prev.filter((item) => item !== slug))}
                className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-800"
              >
                {topicLabels[slug] ?? slug} ✕
              </button>
            ))}
          </div>
        ) : null}

        {showFilters ? (
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <FilterGroup
              title="ระดับชั้น"
              options={levels}
              selected={selectedLevels}
              onToggle={(value) => setSelectedLevels((prev) => toggleValue(prev, value))}
            />
            <FilterGroup
              title="จังหวัด"
              options={provinces}
              selected={selectedProvinces}
              onToggle={(value) => setSelectedProvinces((prev) => toggleValue(prev, value))}
            />
            <FilterGroup
              title="ค่าใช้จ่าย"
              options={prices.map((item) => item.label)}
              selected={selectedPrices.map(
                (id) => prices.find((item) => item.id === id)?.label ?? id,
              )}
              onToggle={(label) => {
                const found = prices.find((item) => item.label === label);
                if (found) setSelectedPrices((prev) => toggleValue(prev, found.id));
              }}
            />
            <FilterGroup
              title="รูปแบบ"
              options={formats.map((item) => item.label)}
              selected={selectedFormats.map(
                (id) => formats.find((item) => item.id === id)?.label ?? id,
              )}
              onToggle={(label) => {
                const found = formats.find((item) => item.label === label);
                if (found) setSelectedFormats((prev) => toggleValue(prev, found.id));
              }}
            />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                สถานะ
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip active={status === "all"} onClick={() => setStatus("all")}>
                  ทั้งหมด
                </Chip>
                <Chip active={status === "open"} onClick={() => setStatus("open")}>
                  เปิดรับสมัคร
                </Chip>
                <Chip active={status === "closed"} onClick={() => setStatus("closed")}>
                  ปิดรับแล้ว
                </Chip>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              <Chip
                active={bookmarkedOnly}
                onClick={() => setBookmarkedOnly((value) => !value)}
              >
                ★ เฉพาะที่มาร์กไว้ ({bookmarked.length})
              </Chip>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full px-3 py-1.5 text-sm text-zinc-500 underline"
                >
                  ล้างตัวกรอง
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            พบ {filtered.length} ค่าย · ข้อมูล ณ {fetchedLabel}
          </p>
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

        {bookmarkedCamps.length > 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ★ มาร์กไว้ {bookmarkedCamps.length} ค่าย · จะขึ้นในปฏิทิน และใช้ส่งแจ้งเตือนใน Discord
            (กำลังทำขั้นถัดไป)
          </p>
        ) : null}
      </section>

      {view === "list" ? (
        filtered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            ไม่พบค่ายที่ตรงกับเงื่อนไข ลองล้างตัวกรองหรือเปลี่ยนคำค้น
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {filtered.map((camp) => (
              <li key={camp.id}>
                <CampCard
                  camp={camp}
                  today={today}
                  saved={bookmarked.includes(camp.id)}
                  onBookmark={() => toggleBookmark(camp.id)}
                />
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
              const dayList = dayCampsOn(iso);
              const count = dayList.length;
              const savedCount = dayList.filter((camp) =>
                bookmarked.includes(camp.id),
              ).length;
              const selected = selectedDay === iso;
              const isToday = today === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(selected ? null : iso)}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-lg border text-sm ${
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : savedCount > 0
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : count > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <span className={isToday ? "font-bold" : ""}>
                    {Number(iso.slice(-2))}
                  </span>
                  {count > 0 ? (
                    <span
                      className={`text-[10px] ${selected ? "text-white/80" : "text-emerald-700"}`}
                    >
                      {count} ค่าย
                    </span>
                  ) : null}
                  {savedCount > 0 ? (
                    <span className="absolute right-1 top-1 text-[10px] text-amber-500">★</span>
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
                        <p className="font-medium">
                          {bookmarked.includes(camp.id) ? "★ " : ""}
                          {camp.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {camp.startDate && camp.endDate
                            ? formatRange(camp.startDate, camp.endDate)
                            : "ยังไม่ระบุวันจัด"}{" "}
                          · {camp.location || "ไม่ระบุสถานที่"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <BookmarkButton
                          saved={bookmarked.includes(camp.id)}
                          onClick={() => toggleBookmark(camp.id)}
                          title={camp.title}
                        />
                        <a
                          href={camp.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs font-medium text-emerald-700 underline"
                        >
                          ต้นฉบับ
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        รอบนี้ดึงจาก {stats.sourcePages} หน้า CAMPHUB พบลิงก์ {stats.foundLinks} รายการ
        และเก็บเฉพาะที่ยังเปิดรับสมัคร {stats.keptCamps} ค่าย · รีเฟรชวันละครั้ง
      </p>
    </div>
  );
}
