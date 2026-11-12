import CampExplorer from "@/app/camp-explorer";
import {
  campFields,
  campFormats,
  campLevels,
  campProvinces,
  campTypes,
  camps,
  dataFetchedAt,
  dataSource,
  dataStats,
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
    <div className="flex flex-1 flex-col bg-[#faf9f6] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <p className="text-lg font-bold tracking-tight">
            ค่ายไหนดี<span className="text-emerald-600">.</span>
          </p>
          <p className="text-sm text-zinc-500">รวมค่ายสำหรับนักเรียน</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <section className="pt-10 pb-8">
          <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            เจอค่ายที่ใช่
            <br />
            ก่อนปิดรับสมัคร
          </h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-zinc-600">
            รวมค่ายและกิจกรรมจาก CAMPHUB ไว้ที่เดียว เฉพาะค่ายที่ยังเปิดรับสมัคร
            พร้อมวันจัด สถานที่ ค่าใช้จ่าย และวันปิดรับสมัคร
            เลือกดูเป็นรายการหรือปฏิทินก็ได้
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-zinc-600">
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
              {camps.length} ค่ายที่ยังเปิดรับ
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
              ข้อมูลจาก CAMPHUB
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
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
          formats={campFormats.map(({ id, label }) => ({ id, label }))}
          prices={priceRanges.map(({ id, label }) => ({ id, label }))}
          fetchedLabel={fetchedLabel}
          stats={dataStats}
        />

        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600">
          <p className="font-semibold text-zinc-900">ข้อมูลนี้มาจากไหน</p>
          <p className="mt-1">
            เว็บนี้ดึงข้อมูลจากหน้าเว็บสาธารณะของ{" "}
            <a
              className="font-medium text-emerald-700 underline"
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

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-sm text-zinc-500">
          <span>ค่ายไหนดี · ทำโดยนักเรียน เพื่อน ๆ โรงเรียนเดียวกัน</span>
          <span>มีค่ายที่ยังไม่เปิดรับใน CAMPHUB จะขึ้นเองในรอบถัดไป</span>
        </div>
      </footer>
    </div>
  );
}
