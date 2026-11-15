"use client";

import { useSyncExternalStore, useState } from "react";

/** ลิงก์เชิญบอท CampAlert เข้า Discord */
const BOT_INVITE_URL =
  "https://discord.com/oauth2/authorize?client_id=1570437067056349394";

const POPUP_KEY = "campalert.botinvite.v1";

const COMMANDS = [
  { command: "/notify", detail: "เปิดแจ้งเตือน เลือกโหมดและสายที่สนใจ" },
  { command: "/settings", detail: "ดูหรือแก้ค่าที่ตั้งไว้จากใน Discord" },
  { command: "/stop", detail: "ปิดการแจ้งเตือนของบัญชีนี้" },
];

/** การ์ดอธิบายวิธีใช้บอท อยู่ในหน้าตั้งค่าการแจ้งเตือน */
export function BotInviteSection() {
  return (
    <section className="animate-rise mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
      <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg text-white shadow-sm shadow-emerald-600/25">
            🤖
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              เพิ่มบอทเข้า Discord
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              บอท CampAlert เป็นตัวส่งข้อความส่วนตัว (DM) หาคุณ
              เว็บอย่างเดียวส่งหาไม่ได้ ต้องเพิ่มบอทเข้าไปในบัญชี Discord ก่อนสักครั้ง
            </p>
          </div>
        </div>

        <a
          href={BOT_INVITE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-105 active:scale-[0.98]"
        >
          เพิ่มบอทเข้า Discord
          <span aria-hidden="true">↗</span>
        </a>
        <p className="mt-2 text-xs text-zinc-500">
          เปิดลิงก์แล้วเลือกเซิร์ฟเวอร์หรือบัญชีของคุณ กดอนุญาตให้บอทส่งข้อความได้
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm font-medium text-zinc-900">ใช้ยังไงหลังเพิ่มบอทแล้ว</p>
        <ol className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">
          <li>
            <span className="font-medium text-zinc-800">1.</span> ตั้งค่าด้านบนของหน้านี้
            เลือกโหมด สายที่สนใจ และจำนวนวันแจ้งล่วงหน้า แล้วกดบันทึก
          </li>
          <li>
            <span className="font-medium text-zinc-800">2.</span> พิมพ์คำสั่งใน Discord
            (พิมพ์ในเซิร์ฟเวอร์หรือ DM กับบอทก็ได้)
          </li>
          <li>
            <span className="font-medium text-zinc-800">3.</span> บอทจะทักมาเป็น DM
            เมื่อมีค่ายใหม่ตรงสาย หรือใกล้วันปิดรับของค่ายที่มาร์กไว้
          </li>
        </ol>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {COMMANDS.map((item) => (
            <li
              key={item.command}
              className="rounded-xl border border-zinc-200 bg-[#faf9f6] px-3 py-2"
            >
              <code className="text-sm font-semibold text-emerald-700">
                {item.command}
              </code>
              <p className="mt-0.5 text-xs leading-5 text-zinc-500">{item.detail}</p>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs leading-5 text-zinc-500">
          ถ้าไม่ได้รับ DM ให้เช็กว่าบัญชี Discord ปิดรับข้อความจากคนในเซิร์ฟเวอร์ไว้หรือเปล่า
          และตอนนี้บอททำงานเฉพาะเวลาที่เจ้าของโปรเจกต์เปิดคอมไว้
        </p>
      </div>
    </section>
  );
}

/** ป๊อปอัปมุมซ้ายล่าง เตือนให้เพิ่มบอท ปิดแล้วไม่ขึ้นอีก */
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

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(POPUP_KEY, "hidden");
    } catch {
      // ไม่เป็นไร
    }
  }

  if (!mounted || hidden) return null;

  return (
    <div
      role="status"
      className="animate-rise fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-xs rounded-2xl border border-emerald-200 bg-white p-4 shadow-[0_18px_45px_-15px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-sm">
            🤖
          </span>
          อยากให้บอททัก DM?
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดข้อความ"
          className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        กดปุ่มด้านล่างเพื่อเพิ่มบอท CampAlert เข้า Discord
        แล้วตั้งค่าด้านบนเท่านี้ก็เริ่มรับแจ้งเตือนได้
      </p>

      <a
        href={BOT_INVITE_URL}
        target="_blank"
        rel="noreferrer noopener"
        onClick={dismiss}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition hover:brightness-105 active:scale-[0.98]"
      >
        เพิ่มบอทเข้า Discord
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
