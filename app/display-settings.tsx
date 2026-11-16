"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark" | "system";
type Size = "sm" | "md" | "lg";

const THEME_KEY = "campalert.theme";
const SIZE_KEY = "campalert.uiSize";

const THEMES: { id: Theme; label: string; hint: string }[] = [
  { id: "light", label: "สว่าง", hint: "พื้นครีมแบบเดิม" },
  { id: "dark", label: "มืด", hint: "พื้นเข้ม ถนอมสายตา" },
  { id: "system", label: "ตามเครื่อง", hint: "ใช้ค่าของอุปกรณ์" },
];

const SIZES: { id: Size; label: string }[] = [
  { id: "sm", label: "เล็ก" },
  { id: "md", label: "กลาง" },
  { id: "lg", label: "ใหญ่" },
];

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

function readSize(): Size {
  if (typeof window === "undefined") return "md";
  try {
    const stored = window.localStorage.getItem(SIZE_KEY);
    return stored === "sm" || stored === "md" || stored === "lg" ? stored : "md";
  } catch {
    return "md";
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // โหมดส่วนตัวบางตัวเขียนไม่ได้ ก็ยังใช้ในหน้านี้ได้
  }
}

/** ปุ่มปรับธีมและขนาดตัวอักษร อยู่ท้ายหัวเว็บ ใช้ได้ทั้งหน้าแรกและหน้าตั้งค่า */
export default function DisplaySettings() {
  // ค่าถูกอ่านจาก localStorage ตอนเปิดแผง ถ้าแผงยังปิดอยู่ HTML จึงตรงกันทั้งสองฝั่ง
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [size, setSize] = useState<Size>(readSize);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // สลับคลาส .dark ที่ <html> ตามที่เลือก และตามเครื่องเมื่อเลือก "ตามเครื่อง"
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  // ขนาดใช้ root font-size เพราะทั้งเว็บคิดเป็น rem
  useEffect(() => {
    document.documentElement.dataset.size = size;
  }, [size]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: Event) => {
      const node = event.target instanceof Node ? event.target : null;
      if (node && wrapRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    write(THEME_KEY, next);
  }

  function chooseSize(next: Size) {
    setSize(next);
    write(SIZE_KEY, next);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="ปรับธีมและขนาดตัวอักษร"
        title="ปรับธีมและขนาดตัวอักษร"
        className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-[#3b352d] dark:bg-[#1c1a17] dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
      >
        <span aria-hidden="true" className="text-base font-semibold leading-none">
          Aa
        </span>
        <span className="hidden sm:inline">แสดงผล</span>
      </button>

      {open ? (
        <div className="animate-panel absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#e7ddcd] bg-white p-4 text-left shadow-[0_18px_45px_-15px_rgba(0,0,0,0.35)] dark:border-[#332e27] dark:bg-[#1c1a17]">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">การแสดงผล</p>

          <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">ธีม</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseTheme(item.id)}
                aria-pressed={theme === item.id}
                title={item.hint}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                  theme === item.id
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-400 dark:border-[#3b352d] dark:bg-[#1c1a17] dark:text-zinc-300 dark:hover:border-emerald-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">ขนาด UI</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {SIZES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseSize(item.id)}
                aria-pressed={size === item.id}
                className={`rounded-xl border px-2 py-2 font-medium transition ${
                  size === item.id
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-400 dark:border-[#3b352d] dark:bg-[#1c1a17] dark:text-zinc-300 dark:hover:border-emerald-500"
                } ${item.id === "sm" ? "text-xs" : item.id === "lg" ? "text-base" : "text-sm"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
            จำค่าไว้ในเครื่องนี้ เปิดครั้งต่อไปจะใช้ค่าที่เลือกไว้ทันที
          </p>
        </div>
      ) : null}
    </div>
  );
}
