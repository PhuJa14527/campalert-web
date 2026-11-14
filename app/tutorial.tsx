"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type { Camp } from "@/lib/camps";

const TUTORIAL_KEY = "campalert.tutorial.v1";

type ViewMode = "list" | "calendar";

type Props = {
  camps: Camp[];
  query: string;
  showFilters: boolean;
  explicitFilterCount: number;
  organizer: string;
  bookmarkedIds: string[];
  view: ViewMode;
  selectedDay: string | null;
  onRemoveBookmarks: (ids: string[]) => void;
  onResetFilters: () => void;
  onSetView: (view: ViewMode) => void;
  onSetShowFilters: (open: boolean) => void;
  onFocusMonth: (iso: string) => void;
};

type StepState = {
  query: string;
  showFilters: boolean;
  explicitFilterCount: number;
  organizer: string;
  bookmarkedIds: string[];
  view: ViewMode;
  selectedDay: string | null;
};

type Sample = { first: Camp; second: Camp; start: string; end: string };

type Step = {
  id: string;
  title: string;
  body: string;
  /** ปุ่มที่ผู้ใช้ต้องกดเองสำหรับขั้นที่เป็นการเล่าเรื่อง */
  manualLabel?: string;
  /** ต้องมีการกดของจริงในขั้นนี้ ไม่ใช่แค่เงื่อนไขบังเอิญเป็นจริงอยู่แล้ว */
  requiresClick?: boolean;
  done?: (state: StepState, sample: Sample | null) => boolean;
};

const STEPS: Step[] = [
  {
    id: "intro",
    title: "เว็บนี้คืออะไร",
    body: "ค่ายไหนดี รวมค่ายที่ยังเปิดรับสมัครจาก CAMPHUB ไว้ที่เดียว แต่ละค่ายมีลิงก์กลับไปหน้าต้นฉบับให้กดสมัครเอง\n\nเว็บมีสามระบบหลัก ตัวกรองแบบเดียวกับหน้า search ของ CAMPHUB ที่เราเพิ่มผู้จัดเข้ามาว่าเป็นมหาวิทยาลัยหรือมูลนิธิ, ปฏิทินที่โชว์วันจัดจริงและเตือนวันที่ค่ายชนกัน, กับการแจ้งเตือนผ่าน Discord\n\nเดี๋ยวพาไล่กดทีละอัน ปุ่มที่ให้กดจะมีวงเขียว ๆ ส่วนอื่นล็อกไว้ก่อน",
    manualLabel: "เริ่มเลย",
  },
  {
    id: "search",
    title: "ระบบค้นหา",
    body: "ช่องนี้หาได้ทั้งชื่อค่าย สายการเรียน จังหวัด หรือชื่อผู้จัด พิมพ์อะไรสักคำแล้วรายการด้านล่างจะกรองให้ทันที\n\nลองพิมพ์ดูครับ เช่น แพทย์ หรือ กรุงเทพ",
    done: (state) => state.query.trim().length > 0,
  },
  {
    id: "advanced",
    title: "ตัวกรองแบบ CAMPHUB",
    body: "ปุ่มนี้เปิดแผงตัวกรองที่ยกโครงมาจากหน้า search ของ CAMPHUB ข้างในมีรูปแบบกิจกรรม หมวดสาขา ระดับชั้นที่เลือกหลายอันได้ จังหวัด ค่าใช้จ่าย มหาวิทยาลัย ผู้จัด และคุณสมบัติเพิ่มเติม\n\nลองกดเปิดดูครับ",
    done: (state) => state.showFilters,
  },
  {
    id: "organizer",
    title: "จุดที่เราเพิ่มเอง: ผู้จัด",
    body: "CAMPHUB บอกชื่อผู้จัดไว้ แต่ไม่ได้แยกว่าเป็นใคร เราก็เลยเพิ่มตัวกรองนี้ให้เห็นว่าใครจัด มหาวิทยาลัย มูลนิธิ หรืออื่น ๆ\n\nลองเลือกสักอย่างในช่องผู้จัดครับ",
    requiresClick: true,
    done: (state) => state.organizer !== "all",
  },
  {
    id: "reset",
    title: "ล้างตัวกรอง",
    body: "ถ้าเลือกจนผลลัพธ์แคบเกินไป ปุ่ม ทั้งหมด จะล้างตัวกรองทุกอันแล้วกลับไปเริ่มใหม่\n\nลองกดดูครับ",
    requiresClick: true,
    done: (state) => state.explicitFilterCount === 0,
  },
  {
    id: "apply",
    title: "ดูผลลัพธ์",
    body: "กดปุ่มนี้แล้วแผงตัวกรองจะย่อกลับ เหลือรายการค่ายที่ผ่านเงื่อนไขพร้อมจำนวนที่เจอ\n\nลองกดดูครับ",
    requiresClick: true,
    done: (state) => !state.showFilters,
  },
  {
    id: "bookmark",
    title: "มาร์กค่ายที่สนใจ",
    body: "การ์ดค่ายทุกใบมีดาว ☆ ไว้เก็บค่ายที่สนใจ ค่ายที่มาร์กจะขึ้นในปฏิทินและถูกใช้ส่งแจ้งเตือน\n\nสองค่ายนี้วันจัดชนกันพอดี ลองกดดาวให้ครบทั้งสองใบครับ",
    requiresClick: true,
    done: (state, sample) =>
      Boolean(
        sample &&
          state.bookmarkedIds.includes(sample.first.id) &&
          state.bookmarkedIds.includes(sample.second.id),
      ),
  },
  {
    id: "calendar",
    title: "ปฏิทินวันจัดค่าย",
    body: "สลับไปมุมมองปฏิทินได้เลย ปฏิทินใช้ วันจัดจริง ของค่าย ไม่ใช่วันปิดรับสมัคร วันที่มีค่ายเป็นสีเขียว ค่ายที่มาร์กไว้เป็นสีเหลือง\n\nลองกดสลับดูครับ",
    done: (state) => state.view === "calendar",
  },
  {
    id: "clash",
    title: "ค่ายที่วันจัดชนกัน",
    body: "เพราะมาร์กไว้สองค่ายที่จัดวันเดียวกัน วันนั้นจึงขึ้นสีแดง และในรายการด้านล่างมีป้ายบอกช่วงที่ชนกัน\n\nลองกดช่องสีแดงดูครับ",
    done: (state, sample) => Boolean(sample && state.selectedDay === sample.start),
  },
  {
    id: "discord",
    title: "แจ้งเตือนเข้า Discord",
    body: "ระบบสุดท้ายคือแจ้งเตือน กดเข้าสู่ระบบ Discord ที่มุมขวาบนก่อน จากนั้นไปที่หน้าตั้งค่า เลือกสายที่สนใจกับจำนวนวันแจ้งล่วงหน้า บอทจะทักไปเมื่อมีค่ายใหม่ตรงสาย หรือใกล้วันจัดค่ายที่มาร์กไว้\n\nค่ายตัวอย่างที่เพิ่งมาร์กไปเราเก็บคืนให้แล้ว ไม่ต้องกลัวว่าจะค้างในรายการ",
    manualLabel: "จบการแนะนำ",
  },
];

type Saved = { step: number; done: boolean; closed: boolean };

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(TUTORIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      step: typeof parsed.step === "number" ? Math.max(0, parsed.step) : 0,
      done: Boolean(parsed.done),
      closed: Boolean(parsed.closed),
    };
  } catch {
    return null;
  }
}

function writeSaved(value: Saved) {
  try {
    window.localStorage.setItem(TUTORIAL_KEY, JSON.stringify(value));
  } catch {
    // โหมดส่วนตัวบางตัวเขียนไม่ได้ ไม่เป็นไร ทัวร์ยังใช้ได้ในหน้านี้
  }
}

function daysInclusive(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}

// เลือกคู่ค่ายตัวอย่างที่วันจัดทับกัน โดยเอาเหตุการณ์สั้น ๆ ก่อน
// (ค่ายประกวดที่กินเวลาหลายเดือนจะทับกับทุกอย่าง เลยไม่เหมาะเอามาสาธิต)
function pickSample(camps: Camp[], saved: Set<string>): Sample | null {
  const dated = camps.filter(
    (camp) => camp.startDate && camp.endDate && camp.startDate <= camp.endDate,
  );

  let best: Sample | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < dated.length; i += 1) {
    for (let j = i + 1; j < dated.length; j += 1) {
      const a = dated[i];
      const b = dated[j];
      const start = a.startDate! > b.startDate! ? a.startDate! : b.startDate!;
      const end = a.endDate! < b.endDate! ? a.endDate! : b.endDate!;
      if (start > end) continue;

      const score =
        daysInclusive(a.startDate!, a.endDate!) +
        daysInclusive(b.startDate!, b.endDate!) +
        (saved.has(a.id) ? 100 : 0) +
        (saved.has(b.id) ? 100 : 0);

      if (score < bestScore) {
        bestScore = score;
        best = { first: a, second: b, start, end };
      }
    }
  }

  return best;
}

function targetFor(stepId: string, state: StepState, sample: Sample | null) {
  switch (stepId) {
    case "search":
      return '[data-tour="search"]';
    case "advanced":
      return '[data-tour="advanced"]';
    case "organizer":
      return '[data-tour="organizer"]';
    case "reset":
      return '[data-tour="reset"]';
    case "apply":
      return '[data-tour="apply"]';
    case "bookmark": {
      if (!sample) return null;
      const firstSaved = state.bookmarkedIds.includes(sample.first.id);
      const secondSaved = state.bookmarkedIds.includes(sample.second.id);
      if (firstSaved && secondSaved) return null;
      if (firstSaved) return `[data-tour-bookmark="${sample.second.id}"]`;
      return `[data-tour-bookmark="${sample.first.id}"]`;
    }
    case "calendar":
      return '[data-tour="calendar"]';
    case "clash":
      return sample ? `[data-tour-day="${sample.start}"]` : null;
    default:
      return null;
  }
}

type Rect = { top: number; left: number; width: number; height: number };

export default function Tutorial({
  camps,
  query,
  showFilters,
  explicitFilterCount,
  organizer,
  bookmarkedIds,
  view,
  selectedDay,
  onRemoveBookmarks,
  onResetFilters,
  onSetView,
  onSetShowFilters,
  onFocusMonth,
}: Props) {
  // ให้ prerender กับ render แรกตรงกัน (ฝั่งเซิร์ฟเวอร์ไม่รู้ค่า localStorage)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = readSaved();
    return !saved || (!saved.done && !saved.closed);
  });
  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = readSaved();
    return saved && !saved.done ? Math.min(saved.step, STEPS.length) : 0;
  });
  const [finished, setFinished] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(readSaved()?.done);
  });
  const [clickedStep, setClickedStep] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const cardRef = useRef<HTMLElement | null>(null);
  // ค่ายที่ผู้ใช้เพิ่งมาร์กช่วงทัวร์ เก็บไว้ล้างคืนตอนไปขั้นถัดไป
  const demoIdsRef = useRef<Set<string>>(new Set());
  const preparedRef = useRef<number | null>(null);

  // จำค่ายที่มาร์กไว้ก่อนเริ่ม เพื่อไม่ไปแตะของเดิมของผู้ใช้
  const [initialBookmarks] = useState(() => new Set(bookmarkedIds));
  const sample = useMemo(() => pickSample(camps, initialBookmarks), [camps, initialBookmarks]);

  const state: StepState = {
    query,
    showFilters,
    explicitFilterCount,
    organizer,
    bookmarkedIds,
    view,
    selectedDay,
  };

  const current = step < STEPS.length ? STEPS[step] : null;
  const targetSelector = current ? targetFor(current.id, state, sample) : null;
  const currentDone = Boolean(
    current &&
      !finished &&
      current.done?.(state, sample) &&
      (!current.requiresClick || clickedStep === current.id),
  );

  const save = useCallback((nextStep: number, done: boolean, closed: boolean) => {
    writeSaved({ step: nextStep, done, closed });
  }, []);

  const advance = useCallback(() => {
    setClickedStep(null);

    // ออกจากขั้นวันชนกันแล้วคืนค่ายตัวอย่างให้ผู้ใช้
    if (STEPS[step]?.id === "clash") {
      const demo = [...demoIdsRef.current];
      demoIdsRef.current.clear();
      if (demo.length > 0) onRemoveBookmarks(demo);
    }

    if (step >= STEPS.length - 1) {
      setFinished(true);
      setStep(STEPS.length);
      save(STEPS.length, true, false);
      return;
    }

    const next = step + 1;
    setStep(next);
    save(next, false, false);
  }, [step, save, onRemoveBookmarks]);

  const close = useCallback(() => {
    setOpen(false);
    save(step, finished, true);
  }, [save, step, finished]);

  const restart = useCallback(() => {
    const demo = [...demoIdsRef.current];
    demoIdsRef.current.clear();
    if (demo.length > 0) onRemoveBookmarks(demo);
    preparedRef.current = null;
    setStep(0);
    setFinished(false);
    setClickedStep(null);
    setOpen(true);
    save(0, false, false);
  }, [save, onRemoveBookmarks]);

  // เตรียมหน้าจอให้ตรงกับขั้น เช่น ล้างตัวกรองก่อนให้มาร์กค่ายตัวอย่าง
  useEffect(() => {
    if (!open || finished) return;
    if (preparedRef.current === step) return;
    const id = STEPS[step]?.id;
    if (!id) return;
    preparedRef.current = step;

    // ขั้นที่อยู่ในแผงตัวกรอง ต้องมั่นใจว่าแผงกางอยู่ (เผื่อผู้ใช้ปิดไว้ก่อนกลับมาทำต่อ)
    if (id === "organizer" || id === "reset" || id === "apply") {
      onSetShowFilters(true);
    }
    if (id === "bookmark") {
      onResetFilters();
      onSetView("list");
    }
    if (id === "calendar") {
      onSetView("list");
      if (sample) onFocusMonth(sample.start);
    }
    if (id === "clash") {
      if (sample) onFocusMonth(sample.start);
      onSetView("calendar");
    }
  }, [open, finished, step, sample, onResetFilters, onSetView, onSetShowFilters, onFocusMonth]);

  // ตามตำแหน่งปุ่มเป้าหมายทุกเฟรม รองรับการเลื่อนจอและแผงที่กางออก
  useEffect(() => {
    if (!open) return;

    let frame = 0;
    let scrolled = false;

    const tick = () => {
      const node = targetSelector
        ? document.querySelector<HTMLElement>(targetSelector)
        : null;

      if (node && !scrolled) {
        scrolled = true;
        node.scrollIntoView({ block: "center", inline: "nearest" });
      }

      const next = node ? node.getBoundingClientRect() : null;
      setRect((prev) => {
        if (!next) return prev === null ? prev : null;
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return { top: next.top, left: next.left, width: next.width, height: next.height };
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, targetSelector]);

  // ระหว่างทัวร์ให้กดได้แค่ปุ่มที่แนะนำ (การ์ดกับปุ่มเป้าหมายเท่านั้น)
  useEffect(() => {
    if (!open) return;

    const insideAllowed = (node: Element | null) => {
      if (!node) return false;
      if (cardRef.current?.contains(node)) return true;
      if (!targetSelector) return false;
      const target = document.querySelector(targetSelector);
      return Boolean(target && target.contains(node));
    };

    const onClick = (event: MouseEvent) => {
      const node = event.target instanceof Element ? event.target : null;
      if (node && cardRef.current?.contains(node)) return;

      const target = targetSelector ? document.querySelector(targetSelector) : null;
      if (node && target && target.contains(node)) {
        const star = node.closest("[data-tour-bookmark]");
        const id = star?.getAttribute("data-tour-bookmark");
        if (id && !bookmarkedIds.includes(id)) demoIdsRef.current.add(id);
        if (current) setClickedStep(current.id);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const onPointer = (event: Event) => {
      const node = event.target instanceof Element ? event.target : null;
      if (insideAllowed(node)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, targetSelector, current, bookmarkedIds, close]);

  // ทำตามขั้นนี้แล้ว โชว์ติ๊กถูกแป๊บหนึ่งก่อนเลื่อนไปขั้นถัดไป
  useEffect(() => {
    if (!open || finished || !current || !currentDone) return;
    const timer = setTimeout(advance, 900);
    return () => clearTimeout(timer);
  }, [open, finished, current, currentDone, advance]);

  const placement = useMemo(() => {
    if (!rect || typeof window === "undefined") return "bottom-right";
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const vertical = centerY > window.innerHeight / 2 ? "top" : "bottom";
    const horizontal = centerX > window.innerWidth / 2 ? "left" : "right";
    return `${vertical}-${horizontal}`;
  }, [rect]);

  if (!mounted) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          preparedRef.current = null;
          setClickedStep(null);
          setOpen(true);
        }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-zinc-800"
      >
        🎓{" "}
        {finished
          ? "ดูแนะนำเว็บอีกครั้ง"
          : step > 0 && step < STEPS.length
            ? `ทำต่อ ขั้น ${step + 1}/${STEPS.length}`
            : "รู้จักเว็บนี้"}
      </button>
    );
  }

  const cardStyle: CSSProperties =
    placement === "top-left"
      ? { top: 16, left: 16 }
      : placement === "top-right"
        ? { top: 16, right: 16 }
        : placement === "bottom-left"
          ? { bottom: 16, left: 16 }
          : { bottom: 16, right: 16 };

  const hole = rect
    ? {
        top: Math.max(0, rect.top - 6),
        left: Math.max(0, rect.left - 6),
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : null;

  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const progress = Math.round((Math.min(step, STEPS.length) / STEPS.length) * 100);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[60]">
        {hole ? (
          <>
            <div
              className="absolute inset-x-0 top-0 bg-zinc-950/55"
              style={{ height: hole.top }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-zinc-950/55"
              style={{ height: Math.max(0, viewportHeight - hole.top - hole.height) }}
            />
            <div
              className="absolute left-0 bg-zinc-950/55"
              style={{ top: hole.top, height: hole.height, width: hole.left }}
            />
            <div
              className="absolute right-0 bg-zinc-950/55"
              style={{
                top: hole.top,
                height: hole.height,
                width: Math.max(0, viewportWidth - hole.left - hole.width),
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-zinc-950/55" />
        )}
      </div>

      {hole && !currentDone ? (
        <div
          className="pointer-events-none fixed z-[65] animate-pulse rounded-xl ring-4 ring-emerald-400"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 8px rgba(16,185,129,0.25)",
          }}
        />
      ) : null}

      <aside
        ref={cardRef}
        style={cardStyle}
        className="fixed z-[70] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">🎓 มีอะไรในค่ายไหนดี</p>
            <p className="text-xs text-zinc-500">
              {finished ? "ครบทุกขั้นแล้ว" : `ขั้น ${Math.min(step + 1, STEPS.length)} จาก ${STEPS.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="ปิดการแนะนำ"
            className="rounded-full px-1.5 text-zinc-400 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <div className="h-1 bg-zinc-100">
          <div
            className="h-1 bg-emerald-600 transition-all"
            style={{ width: `${finished ? 100 : progress}%` }}
          />
        </div>

        <div className="px-4 py-4">
          {finished ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">
                🎉 ครบทุกขั้นแล้ว ตอนนี้เว็บพร้อมใช้จริง
              </p>
              <ul className="space-y-1.5 text-sm text-zinc-600">
                <li>· ตัวกรองแบบ CAMPHUB เพิ่มผู้จัดว่าเป็นมหาวิทยาลัยหรือมูลนิธิ</li>
                <li>· มาร์กค่ายไว้ดูในปฏิทิน วันที่ค่ายชนกันขึ้นสีแดง</li>
                <li>· เปิดแจ้งเตือน Discord ได้ที่หน้าตั้งค่า หรือพิมพ์ /settings ใน Discord</li>
                <li>· ข้อมูลรีเฟรชวันละครั้งจาก CAMPHUB</li>
              </ul>
              <button
                type="button"
                onClick={restart}
                className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                เริ่มแนะนำใหม่
              </button>
            </div>
          ) : currentDone ? (
            <div className="flex flex-col items-center gap-2 py-5">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
                ✓
              </span>
              <p className="text-sm font-medium text-emerald-700">ลองแล้ว ✓</p>
            </div>
          ) : current ? (
            <div className="space-y-3">
              <p className="text-base font-semibold text-zinc-900">{current.title}</p>
              <p className="whitespace-pre-line text-sm leading-6 text-zinc-600">
                {current.body}
              </p>
              {current.manualLabel ? (
                <button
                  type="button"
                  onClick={advance}
                  className="w-full rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {current.manualLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!finished && !currentDone ? (
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              {current?.manualLabel
                ? "กดปุ่มด้านบนเพื่อไปต่อ"
                : "กดปุ่มที่วงเขียวไว้ แล้วติ๊กถูกจะขึ้นเอง"}
            </p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
