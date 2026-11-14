"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase";

const TUTORIAL_KEY = "campalert.tutorial.v1";

type TourState = {
  query: string;
  showFilters: boolean;
  activeFilterCount: number;
  view: "list" | "calendar";
  selectedDay: string | null;
  bookmarkedCount: number;
  loggedIn: boolean;
};

type Step = {
  id: string;
  title: string;
  body: string;
  done: (state: TourState) => boolean;
};

const STEPS: Step[] = [
  {
    id: "search",
    title: "ลองค้นหาค่าย",
    body: "พิมพ์คำที่สนใจในช่องค้นหาด้านบน เช่น แพทย์ หรือ กรุงเทพ แล้วดูรายการด้านล่างเปลี่ยนตาม",
    done: (state) => state.query.trim().length > 0,
  },
  {
    id: "open-filters",
    title: "เปิดตัวกรองละเอียด",
    body: "กดปุ่ม ค้นหาละเอียด เพื่อกางแผงตัวกรองแบบเดียวกับหน้า search ของ CAMPHUB ออกมา",
    done: (state) => state.showFilters,
  },
  {
    id: "pick-filter",
    title: "เลือกตัวกรองอย่างน้อย 1 อย่าง",
    body: "ลองเลือกจังหวัด ระดับชั้น หรือมหาวิทยาลัย ตัวกรองที่ติดอยู่จะขึ้นเป็นป้ายดำเหนือรายการ",
    done: (state) => state.activeFilterCount > 0,
  },
  {
    id: "close-filters",
    title: "กลับไปดูผลลัพธ์",
    body: "กด ซ่อนตัวกรอง หรือ ดูผลลัพธ์ทั้งหมด เพื่อย่อแผงลง เหลือแค่ช่องค้นหากับรายการค่ายที่กรองแล้ว",
    done: (state) => !state.showFilters,
  },
  {
    id: "bookmark",
    title: "มาร์กค่ายที่สนใจ",
    body: "กดดาว ☆ ที่การ์ดค่ายเพื่อเก็บไว้ ค่ายที่มาร์กจะขึ้นในปฏิทิน และใช้เป็นฐานส่งแจ้งเตือนใน Discord",
    done: (state) => state.bookmarkedCount > 0,
  },
  {
    id: "calendar",
    title: "เปิดมุมมองปฏิทิน",
    body: "สลับปุ่มเป็น ปฏิทิน ด้านขวาของจำนวนค่าย ปฏิทินจะโชว์วันจัดจริงของค่าย ไม่ใช่วันปิดรับสมัคร",
    done: (state) => state.view === "calendar",
  },
  {
    id: "calendar-day",
    title: "กดดูค่ายในแต่ละวัน",
    body: "กดช่องวันในปฏิทินเพื่อดูว่าวันนั้นมีค่ายอะไร ถ้าค่ายที่มาร์กไว้จัดทับกัน วันที่ชนจะขึ้นสีแดง",
    done: (state) => state.selectedDay !== null,
  },
  {
    id: "discord",
    title: "เปิดแจ้งเตือน Discord",
    body: "กด เข้าสู่ระบบ Discord ที่มุมขวาบน ไปที่หน้าตั้งค่า แล้วเลือกสายที่สนใจกับจำนวนวันแจ้งล่วงหน้า บอทจะส่ง DM ให้เมื่อมีค่ายใหม่หรือใกล้วันจัด",
    done: (state) => state.loggedIn,
  },
];

type Saved = {
  step: number;
  done: boolean;
  closed: boolean;
};

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

export default function Tutorial({
  query,
  showFilters,
  activeFilterCount,
  view,
  selectedDay,
  bookmarkedCount,
}: Omit<TourState, "loggedIn">) {
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
    return saved && !saved.done ? Math.min(saved.step, STEPS.length - 1) : 0;
  });
  const [finished, setFinished] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(readSaved()?.done);
  });
  const [loggedIn, setLoggedIn] = useState(false);

  // เช็กว่าล็อกอิน Discord อยู่หรือยัง ใช้เป็นเงื่อนไขของขั้นสุดท้าย
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setLoggedIn(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const state = useMemo<TourState>(
    () => ({
      query,
      showFilters,
      activeFilterCount,
      view,
      selectedDay,
      bookmarkedCount,
      loggedIn,
    }),
    [query, showFilters, activeFilterCount, view, selectedDay, bookmarkedCount, loggedIn],
  );

  const current = step < STEPS.length ? STEPS[step] : null;
  const currentDone = current ? current.done(state) : false;

  const save = useCallback((nextStep: number, done: boolean, closed: boolean) => {
    writeSaved({ step: nextStep, done, closed });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    save(step, finished, true);
  }, [save, step, finished]);

  const skip = useCallback(() => {
    const next = Math.min(step + 1, STEPS.length);
    const done = next >= STEPS.length;
    setStep(next);
    if (done) setFinished(true);
    save(next, done, false);
  }, [step, save]);

  const restart = useCallback(() => {
    setStep(0);
    setFinished(false);
    setOpen(true);
    save(0, false, false);
  }, [save]);

  // ทำตามขั้นนี้แล้ว โชว์ติ๊กถูกแป๊บหนึ่งก่อนเลื่อนไปขั้นถัดไป
  useEffect(() => {
    if (!open || finished || !currentDone) return;
    const timer = setTimeout(() => {
      const next = Math.min(step + 1, STEPS.length);
      const done = next >= STEPS.length;
      setStep(next);
      if (done) setFinished(true);
      save(next, done, false);
    }, 900);
    return () => clearTimeout(timer);
  }, [open, finished, currentDone, step, save]);

  if (!mounted) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-zinc-800"
      >
        🎓{" "}
        {finished
          ? "ดูวิธีใช้เว็บอีกครั้ง"
          : step > 0
            ? `ทำทัวร์ต่อ ขั้น ${step + 1}/${STEPS.length}`
            : "สอนวิธีใช้เว็บ"}
      </button>
    );
  }

  const progress = Math.round((Math.min(step, STEPS.length) / STEPS.length) * 100);

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">🎓 วิธีใช้ค่ายไหนดี</p>
          <p className="text-xs text-zinc-500">
            {finished ? "ครบทุกขั้นแล้ว" : `ขั้น ${step + 1} จาก ${STEPS.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="ปิดการสอน"
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
              🎉 เยี่ยมเลย คุณลองครบทุกอย่างแล้ว ตอนนี้เว็บพร้อมใช้จริง:
            </p>
            <ul className="space-y-1.5 text-sm text-zinc-600">
              <li>· ค่ายที่มาร์กไว้จะขึ้นในปฏิทินและใช้ส่งแจ้งเตือน</li>
              <li>· เปิดแจ้งเตือน Discord ได้ที่หน้าตั้งค่า หรือพิมพ์ /settings ใน Discord</li>
              <li>· ข้อมูลรีเฟรชวันละครั้งจาก CAMPHUB</li>
            </ul>
            <button
              type="button"
              onClick={restart}
              className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              เริ่มสอนใหม่
            </button>
          </div>
        ) : currentDone ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
              ✓
            </span>
            <p className="text-sm font-medium text-emerald-700">ทำได้แล้ว</p>
          </div>
        ) : current ? (
          <div className="space-y-3">
            <p className="text-base font-semibold text-zinc-900">{current.title}</p>
            <p className="text-sm leading-6 text-zinc-600">{current.body}</p>
          </div>
        ) : null}
      </div>

      {!finished && !currentDone ? (
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-zinc-400 hover:text-zinc-700"
          >
            ข้ามขั้นนี้
          </button>
          <p className="text-xs text-zinc-400">ทำตามที่บอก แล้วติ๊กถูกจะขึ้นเอง</p>
        </div>
      ) : null}
    </aside>
  );
}
