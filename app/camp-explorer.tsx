"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Camp } from "@/lib/camps";
import { organizerKind, universityLabels, universityOf } from "@/lib/camps";
import { getSupabase } from "@/lib/supabase";
import Tutorial from "@/app/tutorial";
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
type ImpliedKey = "type" | "field" | "province" | "price" | "organizer" | "level" | "status";

/** ตัวเลือกในหัวข้อ "คุณสมบัติเพิ่มเติม" ของแผงตัวกรอง */
const extraOptions = [
  { id: "online", label: "ออนไลน์" },
  { id: "overnight", label: "ค้างคืน" },
  { id: "certificate", label: "มีเกียรติบัตร" },
] as const;

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

function addDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** ข้อความบอกช่วงวันที่ชน เช่น "ชน 21 - 23 พ.ย." */
function clashLabel(days: string[]) {
  if (days.length === 0) return "";
  let contiguous = true;
  for (let index = 1; index < days.length; index += 1) {
    if (days[index] !== addDay(days[index - 1])) {
      contiguous = false;
      break;
    }
  }
  if (!contiguous) return `ชน ${days.length} วัน`;
  return `ชน ${formatRange(days[0], days[days.length - 1])}`;
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

  // ใช้ตอนทัวร์เก็บค่ายตัวอย่างคืนให้ผู้ใช้ (ลบทีละหลายค่ายพร้อมกัน)
  function removeBookmarks(targetIds: string[]) {
    if (targetIds.length === 0) return;
    const next = ids.filter((id) => !targetIds.includes(id));

    if (remoteIds) setRemoteIds(next);
    writeLocalBookmarks(next);

    const supabase = getSupabase();
    if (!supabase) return;

    void supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) return;

      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .in("camp_id", targetIds);

      if (error) console.error("ล้างค่ายตัวอย่างไม่สำเร็จ:", error.message);
    });
  }

  return { ids, toggleBookmark, removeBookmarks };
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
      className={`rounded-full border px-3 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

/** ช่องเลือกแบบ dropdown ใช้ในแผงตัวกรอง (เลือกได้ทีละอย่าง) */
function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const active = value !== "";
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 ${
        active
          ? "border-zinc-900 bg-white font-medium text-zinc-900"
          : "border-zinc-300 bg-white text-zinc-600"
      }`}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function BookmarkButton({
  saved,
  onClick,
  title,
  campId,
}: {
  saved: boolean;
  onClick: () => void;
  title: string;
  campId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `เลิกมาร์ก ${title}` : `มาร์ก ${title}`}
      title={saved ? "เลิกมาร์ก" : "มาร์กค่ายนี้"}
      data-tour-bookmark={campId}
      className={`rounded-full border px-2.5 py-1 text-sm leading-none transition active:scale-90 ${
        saved
          ? "animate-pop border-amber-300 bg-amber-50 text-amber-600"
          : "border-zinc-200 bg-white text-zinc-400 hover:border-amber-300 hover:text-amber-500"
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
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
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
          <BookmarkButton
            saved={saved}
            onClick={onBookmark}
            title={camp.title}
            campId={camp.id}
          />
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
  fields,
  levels,
  provinces,
  prices,
  universities,
  organizerKinds,
  organizerCounts,
  fetchedLabel,
  stats,
}: {
  camps: Camp[];
  types: string[];
  fields: string[];
  levels: string[];
  provinces: string[];
  prices: { id: string; label: string }[];
  universities: { id: string; label: string; count: number }[];
  organizerKinds: { id: string; label: string }[];
  organizerCounts: Record<string, number>;
  fetchedLabel: string;
  stats: { sourcePages: number; foundLinks: number; keptCamps: number };
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ทั้งหมด");
  const [field, setField] = useState("ทั้งหมด");
  const [province, setProvince] = useState("ทั้งหมด");
  const [price, setPrice] = useState("all");
  const [university, setUniversity] = useState("all");
  const [organizer, setOrganizer] = useState("all");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<View>("list");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { ids: bookmarked, toggleBookmark, removeBookmarks } = useBookmarks();

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

  // คำค้นที่พิมพ์อยู่ ถ้าไปตรงกับชื่อตัวเลือกไหน ให้ตัวเลือกนั้นติดให้เอง
  // เช่นพิมพ์ "กรุงเทพ" → ช่องจังหวัดเป็นกรุงเทพฯ แล้วผลลัพธ์ก็กรองตามจังหวัดให้เลย
  //
  // คำเดียวให้ติดช่องเดียวเท่านั้น เพราะถ้าติดหลายช่องจะเป็นเงื่อนไข "และ" กัน
  // เช่น "มหาวิทยาลัย" มีทั้งในระดับชั้นและผู้จัด ถ้าติดทั้งคู่จะเหลือค่ายน้อยเกินจริง
  const implied = useMemo((): { key: ImpliedKey; value: string } | null => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const hit = (label: string) => label.toLowerCase().includes(q);

    // เรียงตามความสำคัญ: หมวดหมู่ → ผู้จัด → จังหวัด → รูปแบบกิจกรรม → ค่าใช้จ่าย → ระดับชั้น → สถานะ
    const fieldHit = fields.find(hit);
    if (fieldHit) return { key: "field", value: fieldHit };

    const organizerHit = organizerKinds.find((kind) => hit(kind.label));
    if (organizerHit) return { key: "organizer", value: organizerHit.id };

    const provinceHit = provinces.find(hit);
    if (provinceHit) return { key: "province", value: provinceHit };

    const typeHit = types.find(hit);
    if (typeHit) return { key: "type", value: typeHit };

    const priceHit = prices.find((item) => hit(item.label));
    if (priceHit) return { key: "price", value: priceHit.id };

    const levelHit = levels.find(hit);
    if (levelHit) return { key: "level", value: levelHit };

    if ("เปิดรับสมัคร".includes(q)) return { key: "status", value: "open" };
    if ("ปิดรับแล้ว".includes(q)) return { key: "status", value: "closed" };
    return null;
  }, [query, fields, organizerKinds, provinces, types, prices, levels]);

  // ค่าที่ใช้กรองจริง = ที่เลือกเองก่อน ถ้ายังไม่เลือกค่อยใช้ค่าที่เดาจากคำค้น
  const effType = type !== "ทั้งหมด" ? type : implied?.key === "type" ? implied.value : "ทั้งหมด";
  const effField =
    field !== "ทั้งหมด" ? field : implied?.key === "field" ? implied.value : "ทั้งหมด";
  const effProvince =
    province !== "ทั้งหมด"
      ? province
      : implied?.key === "province"
        ? implied.value
        : "ทั้งหมด";
  const effPrice = price !== "all" ? price : implied?.key === "price" ? implied.value : "all";
  const effOrganizer =
    organizer !== "all" ? organizer : implied?.key === "organizer" ? implied.value : "all";
  const effLevels = useMemo(
    () => (implied?.key === "level" ? [implied.value] : selectedLevels),
    [implied, selectedLevels],
  );
  const effStatus: Status =
    openOnly || (implied?.key === "status" && implied.value === "open")
      ? "open"
      : implied?.key === "status" && implied.value === "closed"
        ? "closed"
        : "all";

  // เปลี่ยนช่องไหน ถ้าคำค้นเป็นคนทำให้ช่องนั้นติดอยู่ ก็ล้างคำค้นทิ้ง
  // ไม่งั้นตัวกรองจะชนกัน แล้วผลลัพธ์แคบลงโดยที่ผู้ใช้ไม่ได้สั่ง
  function clearQueryFor(dim: ImpliedKey) {
    if (implied?.key === dim) setQuery("");
  }

  function toggleExtra(value: string) {
    setExtras((prev) => toggleValue(prev, value));
  }

  function toggleLevel(value: string) {
    // ถ้าระดับนี้ติดมาจากคำค้น เอาคำค้นออกก่อน แล้วค่อยเลือกตามที่กด
    if (implied?.key === "level") {
      setQuery("");
      setSelectedLevels(implied.value === value ? [] : [value]);
      return;
    }
    setSelectedLevels((prev) => toggleValue(prev, value));
  }

  function clearFilters() {
    setQuery("");
    setType("ทั้งหมด");
    setField("ทั้งหมด");
    setProvince("ทั้งหมด");
    setPrice("all");
    setUniversity("all");
    setOrganizer("all");
    setSelectedLevels([]);
    setExtras([]);
    setOpenOnly(false);
    setBookmarkedOnly(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return camps.filter((camp) => {
      if (effType !== "ทั้งหมด" && camp.type !== effType) return false;
      if (effField !== "ทั้งหมด" && camp.field !== effField) return false;
      if (effProvince !== "ทั้งหมด" && (camp.province ?? "") !== effProvince) return false;
      if (effPrice !== "all" && !matchPrice(effPrice, camp.price)) return false;
      if (university !== "all" && universityOf(camp) !== university) return false;
      if (effOrganizer !== "all" && organizerKind(camp) !== effOrganizer) return false;
      if (effLevels.length && !effLevels.some((level) => (camp.levels ?? []).includes(level)))
        return false;
      if (extras.includes("online") && !camp.online) return false;
      if (extras.includes("overnight") && !camp.overnight) return false;
      if (extras.includes("certificate") && !camp.certificate) return false;
      if (effStatus !== "all") {
        const closed = isPast(camp.deadline, today);
        if (effStatus === "open" && closed) return false;
        if (effStatus === "closed" && !closed) return false;
      }
      if (bookmarkedOnly && !bookmarked.includes(camp.id)) return false;
      // ถ้าคำค้นกลายเป็นตัวกรองไปแล้ว ไม่ต้องเอาไปค้นข้อความซ้ำ
      if (!q || implied) return true;
      return [
        camp.title,
        camp.organizer,
        camp.location,
        camp.field,
        camp.type,
        camp.level,
        camp.province,
        isPast(camp.deadline, today) ? "ปิดรับแล้ว" : "เปิดรับสมัคร",
        organizerKinds.find((kind) => kind.id === organizerKind(camp))?.label ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    camps,
    query,
    effType,
    effField,
    effProvince,
    effPrice,
    university,
    effOrganizer,
    effLevels,
    extras,
    effStatus,
    implied,
    organizerKinds,
    bookmarkedOnly,
    bookmarked,
    today,
  ]);

  const activeFilterCount =
    (effType !== "ทั้งหมด" ? 1 : 0) +
    (effField !== "ทั้งหมด" ? 1 : 0) +
    (effProvince !== "ทั้งหมด" ? 1 : 0) +
    (effPrice !== "all" ? 1 : 0) +
    (university !== "all" ? 1 : 0) +
    (effOrganizer !== "all" ? 1 : 0) +
    effLevels.length +
    extras.length +
    (effStatus !== "all" ? 1 : 0) +
    (bookmarkedOnly ? 1 : 0);

  // นับเฉพาะตัวกรองที่ผู้ใช้เลือกเอง (ไม่นับที่เดาจากคำค้น)
  // ใช้ให้ทัวร์รู้ว่าผู้ใช้ได้ลองกดตัวกรองจริง ๆ แล้วหรือยัง
  const explicitFilterCount =
    (type !== "ทั้งหมด" ? 1 : 0) +
    (field !== "ทั้งหมด" ? 1 : 0) +
    (province !== "ทั้งหมด" ? 1 : 0) +
    (price !== "all" ? 1 : 0) +
    (university !== "all" ? 1 : 0) +
    (organizer !== "all" ? 1 : 0) +
    selectedLevels.length +
    extras.length +
    (openOnly ? 1 : 0) +
    (bookmarkedOnly ? 1 : 0);

  // ป้ายสรุปตัวกรองที่ติดอยู่ กด ✕ เพื่อเอาออกทีละอัน (เห็นได้แม้ย่อแผงลงแล้ว)
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (effField !== "ทั้งหมด") {
    activeChips.push({
      key: "field",
      label: effField,
      clear: () => {
        clearQueryFor("field");
        setField("ทั้งหมด");
      },
    });
  }
  if (effType !== "ทั้งหมด") {
    activeChips.push({
      key: "type",
      label: effType,
      clear: () => {
        clearQueryFor("type");
        setType("ทั้งหมด");
      },
    });
  }
  if (effOrganizer !== "all") {
    const label = organizerKinds.find((kind) => kind.id === effOrganizer)?.label ?? effOrganizer;
    activeChips.push({
      key: "organizer",
      label,
      clear: () => {
        clearQueryFor("organizer");
        setOrganizer("all");
      },
    });
  }
  if (effProvince !== "ทั้งหมด") {
    activeChips.push({
      key: "province",
      label: effProvince,
      clear: () => {
        clearQueryFor("province");
        setProvince("ทั้งหมด");
      },
    });
  }
  if (effPrice !== "all") {
    const label = prices.find((item) => item.id === effPrice)?.label ?? effPrice;
    activeChips.push({
      key: "price",
      label,
      clear: () => {
        clearQueryFor("price");
        setPrice("all");
      },
    });
  }
  if (university !== "all") {
    activeChips.push({
      key: "university",
      label: universityLabels[university] ?? university,
      clear: () => setUniversity("all"),
    });
  }
  for (const level of effLevels) {
    activeChips.push({
      key: `level-${level}`,
      label: level,
      clear: () => toggleLevel(level),
    });
  }
  for (const extra of extras) {
    const label = extraOptions.find((item) => item.id === extra)?.label ?? extra;
    activeChips.push({
      key: `extra-${extra}`,
      label,
      clear: () => toggleExtra(extra),
    });
  }
  if (effStatus !== "all") {
    activeChips.push({
      key: "status",
      label: effStatus === "open" ? "เปิดรับสมัคร" : "ปิดรับแล้ว",
      clear: () => {
        clearQueryFor("status");
        setOpenOnly(false);
      },
    });
  }
  if (bookmarkedOnly) {
    activeChips.push({
      key: "bookmarked",
      label: "★ มาร์กไว้",
      clear: () => setBookmarkedOnly(false),
    });
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

  // ให้ทัวร์พาปฏิทินไปที่เดือนของค่ายตัวอย่าง
  const focusMonthOf = useCallback((iso: string) => {
    const [year, month] = iso.split("-").map(Number);
    setMonth({ year, month: month - 1 });
    setSelectedDay(null);
  }, []);

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

  // หา "วันที่ชนกัน" แบบรายวัน: วันไหนมีค่ายที่มาร์กไว้ตั้งแต่ 2 ค่ายจัดอยู่ = วันนั้นชน
  // ทำแบบรายวันเพื่อให้แดงเฉพาะจุดที่ทับกันจริง ไม่ลามไปทั้งช่วงของค่าย
  const { conflictDays, clashByCamp } = useMemo(() => {
    const saved = camps.filter(
      (camp) => bookmarked.includes(camp.id) && camp.startDate && camp.endDate,
    );

    const dayCount = new Map<string, number>();
    for (const camp of saved) {
      if (!camp.startDate || !camp.endDate) continue;
      let cursor = camp.startDate;
      while (cursor <= camp.endDate) {
        dayCount.set(cursor, (dayCount.get(cursor) ?? 0) + 1);
        cursor = addDay(cursor);
      }
    }

    const conflict = new Set<string>();
    for (const [iso, count] of dayCount) {
      if (count >= 2) conflict.add(iso);
    }

    const byCamp = new Map<string, string[]>();
    for (const camp of saved) {
      if (!camp.startDate || !camp.endDate) continue;
      const days: string[] = [];
      let cursor = camp.startDate;
      while (cursor <= camp.endDate) {
        if (conflict.has(cursor)) days.push(cursor);
        cursor = addDay(cursor);
      }
      if (days.length > 0) byCamp.set(camp.id, days);
    }

    return { conflictDays: conflict, clashByCamp: byCamp };
  }, [camps, bookmarked]);

  const conflictCount = clashByCamp.size;

  return (
    <div>
      <section className="space-y-3">
        {/* แถบค้นหาแบบย่อ: ปกติเห็นแค่ช่องค้นหา กด "ค้นหาละเอียด" ค่อยกางแผงตัวกรองออกมา */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100/70" data-tour="search">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5 shrink-0 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="sr-only">ค้นหาค่ายและกิจกรรม</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาค่ายและกิจกรรม"
              className="w-full bg-transparent py-3 text-base outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้น"
                className="shrink-0 rounded-full px-1 text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            ) : null}
          </label>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            data-tour="advanced"
            className={`flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              showFilters || activeFilterCount > 0
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:shadow-sm"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            ค้นหาละเอียด
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-white/20 px-2 text-xs">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>

        {/* ป้ายที่เลือกอยู่ (รวมที่มาจากคำค้น) กด ✕ เพื่อเอาออกทีละอัน เห็นได้แม้ย่อแผงแล้ว */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="animate-fade rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-sm text-white transition hover:bg-zinc-800 active:scale-95"
              >
                {chip.label} ✕
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-3 py-1 text-sm text-zinc-500 underline"
            >
              ล้างทั้งหมด
            </button>
          </div>
        ) : null}

        {showFilters ? (
          <div className="animate-panel overflow-hidden rounded-2xl border border-zinc-200 bg-[#f6f4ef] shadow-sm" data-tour="filters">
            {/* แท็บเลือกชนิดกิจกรรม เหมือนหน้า search ของ CAMPHUB */}
            <div className="flex items-end gap-2 px-4 pt-3">
              {[
                { id: "ทั้งหมด", label: "กิจกรรมทั่วไป" },
                { id: "ประกวดแข่งขัน", label: "ประกวดแข่งขัน" },
              ].map((tab) => {
                const active =
                  tab.id === "ประกวดแข่งขัน"
                    ? effType === "ประกวดแข่งขัน"
                    : effType !== "ประกวดแข่งขัน";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      clearQueryFor("type");
                      setType(tab.id);
                    }}
                    aria-pressed={active}
                    className={`rounded-t-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                      active
                        ? "bg-zinc-900 text-white"
                        : "bg-white/70 text-zinc-600 hover:bg-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-5 border-t border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  <p className="text-sm font-semibold text-zinc-800">ตัวกรอง</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    data-tour="reset"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      activeFilterCount > 0
                        ? "border-zinc-400 bg-white text-zinc-800"
                        : "border-zinc-300 bg-white/60 text-zinc-500"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                </div>
                <p className="text-xs text-zinc-500">เลือกได้หลายระดับชั้น · ช่องอื่นเลือกได้ทีละอย่าง</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">รูปแบบกิจกรรม</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={effType === "ทั้งหมด" ? "" : effType}
                    options={types.map((item) => ({ value: item, label: item }))}
                    onChange={(value) => {
                      clearQueryFor("type");
                      setType(value || "ทั้งหมด");
                    }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">หมวดหมู่/สาขา</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={effField === "ทั้งหมด" ? "" : effField}
                    options={fields.map((item) => ({ value: item, label: item }))}
                    onChange={(value) => {
                      clearQueryFor("field");
                      setField(value || "ทั้งหมด");
                    }}
                  />
                </div>

                <div className="lg:row-span-2">
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">ระดับชั้นที่รับ</p>
                  <div className="grid gap-1.5 rounded-lg border border-zinc-300 bg-white p-3">
                    {levels.map((level) => (
                      <label
                        key={level}
                        className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={effLevels.includes(level)}
                          onChange={() => toggleLevel(level)}
                          className="size-4 accent-zinc-900"
                        />
                        <span>{level}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">จังหวัด/พื้นที่</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={effProvince === "ทั้งหมด" ? "" : effProvince}
                    options={provinces.map((item) => ({ value: item, label: item }))}
                    onChange={(value) => {
                      clearQueryFor("province");
                      setProvince(value || "ทั้งหมด");
                    }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">ช่วงค่าใช้จ่าย</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={effPrice === "all" ? "" : effPrice}
                    options={prices.map((item) => ({ value: item.id, label: item.label }))}
                    onChange={(value) => {
                      clearQueryFor("price");
                      setPrice(value || "all");
                    }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">มหาวิทยาลัย</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={university === "all" ? "" : university}
                    options={universities.map((item) => ({
                      value: item.id,
                      label: `${item.label} (${item.count})`,
                    }))}
                    onChange={(value) => setUniversity(value || "all")}
                  />
                </div>

                <div data-tour="organizer">
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">ผู้จัด</p>
                  <SelectFilter
                    label="ทั้งหมด"
                    value={effOrganizer === "all" ? "" : effOrganizer}
                    options={organizerKinds.map((kind) => ({
                      value: kind.id,
                      label: `${kind.label} (${organizerCounts[kind.id] ?? 0})`,
                    }))}
                    onChange={(value) => {
                      clearQueryFor("organizer");
                      setOrganizer(value || "all");
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-zinc-500">คุณสมบัติเพิ่มเติม:</p>
                {extraOptions.map((option) => (
                  <Chip
                    key={option.id}
                    active={extras.includes(option.id)}
                    onClick={() => toggleExtra(option.id)}
                  >
                    {option.label}
                  </Chip>
                ))}
                <Chip active={openOnly} onClick={() => setOpenOnly((value) => !value)}>
                  เปิดรับสมัครเท่านั้น
                </Chip>
                <Chip
                  active={bookmarkedOnly}
                  onClick={() => setBookmarkedOnly((value) => !value)}
                >
                  ★ มาร์กไว้ ({bookmarked.length})
                </Chip>
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-4 shrink-0 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="sr-only">ค้นหาคำเพิ่มเติมในแผงตัวกรอง</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาคำเพิ่มเติม เช่น ชื่อค่าย"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
              <p className="text-sm text-zinc-600">
                พบ <span className="font-semibold text-orange-600">{filtered.length}</span>{" "}
                กิจกรรม ที่ตรงเงื่อนไข
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="text-sm text-zinc-500 underline-offset-2 transition hover:text-zinc-800 hover:underline"
                >
                  ซ่อนตัวกรอง ⌃
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  data-tour="apply"
                  className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 hover:shadow-md active:scale-[0.98]"
                >
                  ดูผลลัพธ์ทั้งหมด
                </button>
              </div>
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
              className={`rounded-full px-3 py-1 transition-colors duration-200 ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              รายการ
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
              data-tour="calendar"
              className={`rounded-full px-3 py-1 transition-colors duration-200 ${view === "calendar" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              ปฏิทิน
            </button>
          </div>
        </div>

        {bookmarkedCamps.length > 0 ? (
          <p
            className={`rounded-xl border px-3 py-2 text-xs ${
              conflictCount > 0
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            ★ มาร์กไว้ {bookmarkedCamps.length} ค่าย
            {conflictCount > 0
              ? ` · ${conflictCount} ค่ายมีวันจัดชนกัน ดูสีแดงในปฏิทิน`
              : " · จะขึ้นในปฏิทิน และใช้ส่งแจ้งเตือนใน Discord"}
          </p>
        ) : null}
      </section>

      {view === "list" ? (
        filtered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            ไม่พบค่ายที่ตรงกับเงื่อนไข ลองล้างตัวกรองหรือเปลี่ยนคำค้น
          </p>
        ) : (
          <ul className="mt-6 grid animate-view gap-4 sm:grid-cols-2">
            {filtered.map((camp, index) => (
              <li
                key={camp.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
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
        <section className="mt-6 animate-view">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm transition hover:border-zinc-500 hover:shadow-sm active:scale-95"
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
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm transition hover:border-zinc-500 hover:shadow-sm active:scale-95"
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
              const hasConflict = savedCount > 0 && conflictDays.has(iso);
              const selected = selectedDay === iso;
              const isToday = today === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(selected ? null : iso)}
                  title={hasConflict ? "มีค่ายที่มาร์กไว้และวันจัดชนกัน" : undefined}
                  data-tour-day={iso}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition duration-150 hover:scale-[1.04] hover:shadow-sm active:scale-95 ${
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : hasConflict
                        ? "border-red-300 bg-red-50 text-red-900"
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
                      className={`text-[10px] ${
                        selected
                          ? "text-white/80"
                          : hasConflict
                            ? "text-red-600"
                            : "text-emerald-700"
                      }`}
                    >
                      {count} ค่าย
                    </span>
                  ) : null}
                  {savedCount > 0 ? (
                    <span
                      className={`absolute right-1 top-1 text-[10px] ${
                        hasConflict ? "text-red-500" : "text-amber-500"
                      }`}
                    >
                      ★
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-amber-300 bg-amber-50" />
              มาร์กไว้
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-red-300 bg-red-50" />
              วันจัดชนกัน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-emerald-200 bg-emerald-50" />
              มีค่าย
            </span>
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
                {(selectedDay ? dayCamps : monthCamps).map((camp) => {
                  const clashDays = clashByCamp.get(camp.id);
                  return (
                    <li
                      key={camp.id}
                      className="rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {bookmarked.includes(camp.id) ? "★ " : ""}
                            {camp.title}
                            {clashDays ? (
                              <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-[10px] font-medium text-white">
                                {clashLabel(clashDays)}
                              </span>
                            ) : null}
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
                            campId={camp.id}
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
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        รอบนี้ดึงจาก {stats.sourcePages} หน้า CAMPHUB พบลิงก์ {stats.foundLinks} รายการ
        และเก็บเฉพาะที่ยังเปิดรับสมัคร {stats.keptCamps} ค่าย · รีเฟรชวันละครั้ง
      </p>

      <Tutorial
        camps={camps}
        query={query}
        showFilters={showFilters}
        explicitFilterCount={explicitFilterCount}
        organizer={organizer}
        bookmarkedIds={bookmarked}
        view={view}
        selectedDay={selectedDay}
        onRemoveBookmarks={removeBookmarks}
        onResetFilters={clearFilters}
        onSetView={setView}
        onSetShowFilters={setShowFilters}
        onFocusMonth={focusMonthOf}
      />
    </div>
  );
}
