import CampExplorer from "@/app/camp-explorer";
import SiteHeader from "@/app/site-header";
import { BotInvitePopup } from "@/app/settings/bot-invite";
import {
  campFields,
  campLevels,
  campProvinces,
  campTypes,
  campUniversities,
  camps,
  dataFetchedAt,
  dataSource,
  dataStats,
  organizerCounts,
  organizerKinds,
  priceRanges,
} from "@/lib/camps";

const fetchedLabel = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
}).format(new Date(dataFetchedAt));

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#fbf8f2] dark:bg-[#12100e] text-zinc-900 dark:text-zinc-100">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <section className="pt-10 pb-8">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            CampAlert
            <span className="mx-1.5 font-normal text-zinc-300 dark:text-zinc-600">·</span>
            <span className="font-medium text-zinc-500 dark:text-zinc-400">ค่ายไหนดี</span>
          </p>
          <h1 className="mt-2.5 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            เจอค่ายที่ใช่ ก่อนปิดรับสมัคร
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            CampAlert รวมค่ายและกิจกรรมจาก CAMPHUB ที่ยังเปิดรับสมัครไว้ในที่เดียว
            พร้อมวันจัด สถานที่ ค่าใช้จ่าย และกำหนดปิดรับสมัคร
            ตรวจสอบรายละเอียดจากต้นฉบับแล้วสมัครได้ทันที
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full border border-[#e7ddcd] dark:border-[#332e27] bg-white dark:bg-[#1c1a17] px-3 py-1">
              {camps.length} ค่ายที่ยังเปิดรับ
            </span>
            <span className="rounded-full border border-[#e7ddcd] dark:border-[#332e27] bg-white dark:bg-[#1c1a17] px-3 py-1">
              ข้อมูลจาก CAMPHUB
            </span>
            <span className="rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-emerald-700 dark:text-emerald-300">
              อัปเดต {fetchedLabel}
            </span>
          </div>
        </section>

        <CampExplorer
          camps={camps}
          types={campTypes}
          fields={campFields}
          levels={campLevels}
          provinces={campProvinces}
          prices={priceRanges.map(({ id, label }) => ({ id, label }))}
          universities={campUniversities}
          organizerKinds={organizerKinds.map(({ id, label }) => ({ id, label }))}
          organizerCounts={organizerCounts}
          fetchedLabel={fetchedLabel}
          stats={dataStats}
        />

        <section className="mt-10 rounded-2xl border border-[#e7ddcd] dark:border-[#332e27] bg-white dark:bg-[#1c1a17] p-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">ข้อมูลนี้มาจากไหน</p>
          <p className="mt-1">
            เว็บนี้ดึงข้อมูลจากหน้าเว็บสาธารณะของ{" "}
            <a
              className="font-medium text-emerald-700 dark:text-emerald-300 underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-200"
              href={dataSource}
              target="_blank"
              rel="noreferrer noopener"
            >
              CAMPHUB
            </a>{" "}
            เฉพาะชื่อค่าย วันจัด สถานที่ ค่าใช้จ่าย วันปิดรับสมัคร และหมวดหมู่
            ไม่ได้คัดลอกบทความหรือรูปภาพมาเก็บไว้ และทุกการ์ดมีลิงก์กลับไปยังต้นฉบับ
            ข้อมูลเป็นของผู้จัดแต่ละราย ควรตรวจสอบรายละเอียดกับต้นฉบับก่อนสมัครเสมอ
          </p>
          <p className="mt-3">
            ความสดของข้อมูล: CAMPHUB ไม่มี API สาธารณะให้ดึงแบบวินาทีต่อวินาที
            เราจึงดึงหน้าเว็บใหม่วันละครั้ง แล้วแสดงวันที่ดึงล่าสุดไว้บนหน้านี้
            รายละเอียดที่อาจเปลี่ยนภายหลังให้ยึดหน้าต้นฉบับเป็นหลัก
          </p>
        </section>
      </main>

      <footer className="bg-[#2b2a28] text-zinc-300">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">
              CampAlert<span className="text-emerald-500">.</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              ค่ายไหนดี · ทำโดยนักเรียน เพื่อน ๆ โรงเรียนเดียวกัน
            </p>
          </div>
          <div className="max-w-md text-sm leading-6 text-zinc-400">
            <p>ข้อมูลเป็นของผู้จัดแต่ละราย ควรตรวจสอบรายละเอียดกับต้นฉบับก่อนสมัคร</p>
            <p className="mt-1">
              ดึงข้อมูลวันละครั้งจาก{" "}
              <a
                className="font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                href={dataSource}
                target="_blank"
                rel="noreferrer noopener"
              >
                CAMPHUB
              </a>{" "}
              · มีค่ายที่ยังไม่เปิดรับจะขึ้นเองในรอบถัดไป
            </p>
          </div>
        </div>
      </footer>

      <BotInvitePopup />
    </div>
  );
}
