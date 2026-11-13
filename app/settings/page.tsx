import SiteHeader from "@/app/site-header";
import SettingsForm from "@/app/settings/settings-form";
import { campFields } from "@/lib/camps";

export const metadata = {
  title: "ตั้งค่าการแจ้งเตือน · ค่ายไหนดี",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#faf9f6] text-zinc-900">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
        <section className="pt-10 pb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ตั้งค่าการแจ้งเตือน
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
            ตั้งครั้งเดียวแล้วใช้ได้ทั้งเว็บและบอท Discord
            บอทจะส่งข้อความส่วนตัว (DM) หาคุณเมื่อมีค่ายตรงเงื่อนไขที่เลือกไว้
          </p>
        </section>

        <SettingsForm fields={campFields} />
      </main>
    </div>
  );
}
