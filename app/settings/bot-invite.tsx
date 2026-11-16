"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, useState } from "react";

/** ลิงก์เชิญบอท CampAlert เข้า Discord */
const BOT_INVITE_URL =
  "https://discord.com/oauth2/authorize?client_id=1570437067056349394";

const POPUP_KEY = "campalert.botinvite.v1";

const COMMANDS = [
  { command: "/notify", detail: "เปิดแจ้งเตือน เลือกโหมดและสายที่สนใจ" },
  { command: "/settings", detail: "ดูหรือแก้ค่าที่ตั้งไว้จากใน Discord" },
  { command: "/stop", detail: "ปิดการแจ้งเตือนของบัญชีนี้" },
];

/** วิธีใช้บอท ท้ายหน้าตั้งค่าการแจ้งเตือน (เนื้อหาล้วน ไม่ใส่การ์ดหรือไอคอน) */
export function BotInviteSection() {
  return (
    <section id="bot" className="mt-8 scroll-mt-6 border-t border-zinc-200 dark:border-[#332e27] pt-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">เพิ่มบอทเข้า Discord</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        บอท CampAlert เป็นตัวส่งข้อความส่วนตัว (DM) หาคุณ เว็บอย่างเดียวส่งหาไม่ได้
        ต้องเพิ่มบอทเข้าไปในบัญชี Discord ก่อนสักครั้ง
      </p>

      <a
        href={BOT_INVITE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300 underline underline-offset-2 transition hover:text-emerald-800 dark:hover:text-emerald-200"
      >
        เพิ่มบอทเข้า Discord
        <span aria-hidden="true">↗</span>
      </a>
      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        เปิดลิงก์แล้วเลือกเซิร์ฟเวอร์หรือบัญชีของคุณ กดอนุญาตให้บอทส่งข้อความได้
      </p>

      <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">ใช้ยังไงหลังเพิ่มบอทแล้ว</p>
      <ol className="mt-2 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        <li>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">1.</span> ตั้งค่าด้านบนของหน้านี้
          เลือกโหมด สายที่สนใจ และจำนวนวันแจ้งล่วงหน้า แล้วกดบันทึก
        </li>
        <li>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">2.</span> พิมพ์คำสั่งใน Discord
          (พิมพ์ในเซิร์ฟเวอร์หรือ DM กับบอทก็ได้)
        </li>
        <li>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">3.</span> บอทจะทักมาเป็น DM
          เมื่อมีค่ายใหม่ตรงสาย หรือใกล้วันปิดรับของค่ายที่มาร์กไว้
        </li>
      </ol>

      <ul className="mt-3 space-y-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {COMMANDS.map((item) => (
          <li key={item.command}>
            <code className="font-semibold text-zinc-800 dark:text-zinc-200">{item.command}</code>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">{item.detail}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        ถ้าไม่ได้รับ DM ให้เช็กว่าบัญชี Discord ปิดรับข้อความจากคนในเซิร์ฟเวอร์ไว้หรือเปล่า
        และตอนนี้บอททำงานเฉพาะเวลาที่เจ้าของโปรเจกต์เปิดคอมไว้
      </p>
    </section>
  );
}

/** ป๊อปอัปมุมซ้ายล่างของหน้าแรก ชวนไปตั้งค่าการแจ้งเตือน ปิดแล้วไม่ขึ้นอีก */
export function BotInvitePopup() {
  // ให้ prerender กับ render แรกตรงกัน (ฝั่งเซิร์ฟเวอร์อ่าน localStorage ไม่ได้)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(POPUP_KEY) === "hidden";
    } catch {
      return false;
    }
  });

  // จอมือถือครั้งแรก: กล่องถามเรื่องทัวร์กินพื้นที่เต็มความกว้างอยู่
  // ให้ป๊อปอัปนี้รอจนผู้ใช้ตอบว่าจะดูทัวร์หรือไม่ก่อน ไม่งั้นจะทับกัน
  const [waitingForTutorial, setWaitingForTutorial] = useState(() => {
    if (typeof window === "undefined") return false;
    const narrow = window.matchMedia("(max-width: 639px)").matches;
    if (!narrow) return false;
    try {
      return window.localStorage.getItem("campalert.tutorial.v1") === null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!waitingForTutorial) return;
    const onAnswered = () => setWaitingForTutorial(false);
    window.addEventListener("campalert:tutorial-answered", onAnswered);
    return () =>
      window.removeEventListener("campalert:tutorial-answered", onAnswered);
  }, [waitingForTutorial]);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(POPUP_KEY, "hidden");
    } catch {
      // ไม่เป็นไร
    }
  }

  if (!mounted || hidden || waitingForTutorial) return null;

  return (
    <div
      role="status"
      className="animate-rise fixed bottom-20 left-4 z-40 w-[calc(100vw-2rem)] max-w-xs rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#1c1a17] p-4 shadow-[0_18px_45px_-15px_rgba(0,0,0,0.35)] sm:bottom-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-sm">
            🤖
          </span>
          ทำให้บอทแจ้งเตือน
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดข้อความ"
          className="rounded-full p-1 text-zinc-400 dark:text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-[#2a2620] hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
        เพิ่มบอท CampAlert แล้วตั้งค่าที่หน้าตั้งค่า บอทจะทัก DM
        เมื่อมีค่ายใหม่ตรงสายที่สนใจ หรือใกล้วันปิดรับของค่ายที่มาร์กไว้
      </p>

      <Link
        href="/settings#bot"
        onClick={dismiss}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98]"
      >
        ไปตั้งค่าการแจ้งเตือน
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
