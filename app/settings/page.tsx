import Link from "next/link";
import SiteHeader from "@/app/site-header";
import SettingsForm from "@/app/settings/settings-form";
import { BotInviteSection } from "@/app/settings/bot-invite";
import { campFields } from "@/lib/camps";

export const metadata = {
  title: "ตั้งค่าการแจ้งเตือน · CampAlert",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#fbf8f2] dark:bg-[#12100e] text-zinc-900 dark:text-zinc-100">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
        {/* ปุ่มกลับหน้าแรกแยกออกมาอยู่บนสุด กดง่ายทั้งนิ้วมือและเมาส์ */}
        <div className="pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-[#3b352d] bg-white dark:bg-[#1c1a17] px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-700 dark:hover:border-emerald-500 dark:hover:text-emerald-300 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ←
            </span>
            กลับหน้าแรก
          </Link>
        </div>

        <section className="pt-6 pb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ตั้งค่าการแจ้งเตือน
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            ตั้งครั้งเดียวแล้วใช้ได้ทั้งเว็บและบอท Discord
            บอทจะส่งข้อความส่วนตัว (DM) หาคุณเมื่อมีค่ายตรงเงื่อนไขที่เลือกไว้
          </p>
        </section>

        <SettingsForm fields={campFields} />
        <BotInviteSection />
      </main>
    </div>
  );
}
