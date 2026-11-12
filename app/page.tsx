const tools = [
  {
    name: "Next.js",
    role: "โครงเว็บ",
    why: "หน้าต่าง ๆ ของเว็บอยู่ที่โฟลเดอร์ app และมีห้องหลังร้านไว้ซ่อนกุญแจลับ",
    icon: "💻",
  },
  {
    name: "git",
    role: "ปุ่ม save",
    why: "เก็บทุกเวอร์ชันไว้ ถ้าแก้แล้วพัง เรากลับไปตอนที่ยังเวิร์กได้",
    icon: "💾",
  },
  {
    name: "Vercel",
    role: "ขึ้นเน็ต",
    why: "ย้ายเว็บจากเครื่องเราไปไว้บนเน็ต เพื่อนเปิดจากมือถือได้ด้วยลิงก์",
    icon: "🌐",
  },
  {
    name: "Supabase",
    role: "สมุดจด",
    why: "จำสิ่งที่ผู้ใช้กรอกไว้ เพราะหน้าเว็บลืมทุกอย่างเมื่อเขาปิดหน้า",
    icon: "📒",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-5 py-12 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-xl">
        <p className="text-sm font-medium tracking-wide text-emerald-600 dark:text-emerald-400">
          SeedStack · ตั้งเครื่องเสร็จ
        </p>

        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
          เครื่องมือพร้อมแล้ว
          <br />
          พร้อมสร้างเว็บแรกของเรา
        </h1>

        <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          ทั้งสี่ตัวนี้ทำงานอยู่ในโฟลเดอร์ <span className="font-mono text-sm">OpenCode Project</span>{" "}
          แล้ว ลองบอกไอเดียที่อยากสร้างได้เลย
        </p>

        <ul className="mt-8 space-y-3">
          {tools.map((tool) => (
            <li
              key={tool.name}
              className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {tool.icon}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {tool.name}
                  <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    ✅ {tool.role}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {tool.why}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <p className="font-semibold">ขั้นต่อไป</p>
          <p className="mt-1">
            บอกไอเดียใน OpenCode ว่าอยากสร้างอะไร ให้ใครใช้ แล้วเราจะเริ่มจากหน้าแรก
            ด้วยข้อมูลตัวอย่างก่อน
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
          แก้หน้านี้ได้ที่ app/page.tsx
        </p>
      </main>
    </div>
  );
}
