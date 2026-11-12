// ดึงข้อมูลค่ายจากหน้าเว็บสาธารณะของ CAMPHUB (camphub.in.th)
//
// วิธีที่ใช้: ขอหน้า HTML สาธารณะแบบอ่านอย่างเดียว ไม่ได้ล็อกอิน ไม่ได้ใช้ API ลับ
// 1) หน้าแรกของ CAMPHUB มีการ์ด "กิจกรรมที่ยังเปิดรับสมัคร" ซึ่งใน HTML มี classe
//    บอกหมวดของค่าย (เช่น category-skills-workshop, category-engineer)
// 2) หน้าแต่ละค่ายมีกล่องข้อมูลที่เว็บใช้แสดงผล (class="chv2") ซึ่งมี
//    data-regto (วันปิดรับสมัคร), data-evlast (วันสุดท้ายของกิจกรรม)
//    และบรรทัดข้อมูล เช่น "จัดเมื่อไหร่", "จัดที่ไหน", "ค่าใช้จ่าย", "รับจำนวน"
// 3) เก็บเฉพาะข้อมูลที่ต้องใช้แสดงผล (ชื่อ วัน สถานที่ ค่าใช้จ่าย ลิงก์ต้นฉบับ)
//    ไม่ได้คัดลอกบทความหรือรูปภาพมาไว้ในเว็บเรา และใส่เครดิตพร้อมลิงก์กลับไปเสมอ
//
// หลักปฏิบัติ: เว้นจังหวะระหว่างการขอหน้าเว็บ (sleep) ไม่ยิงรัว และดึงข้อมูลรอบเดียวต่อการรัน
// ถ้าจะใช้เชิงพาณิชย์หรือดึงข้อมูลจำนวนมาก ควรขออนุญาต CAMPHUB ก่อน
//
// รันด้วย: npm run fetch:camphub

import { writeFile, mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = "https://www.camphub.in.th";
const SOURCE_PAGES = [BASE + "/"];
const OUT = new URL("../data/camps.json", import.meta.url);

const THAI_MONTHS = {
  "ม.ค.": 1, "มกราคม": 1,
  "ก.พ.": 2, "กุมภาพันธ์": 2,
  "มี.ค.": 3, "มีนาคม": 3,
  "เม.ย.": 4, "เมษายน": 4,
  "พ.ค.": 5, "พฤษภาคม": 5,
  "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7,
  "ส.ค.": 8, "สิงหาคม": 8,
  "ก.ย.": 9, "กันยายน": 9,
  "ต.ค.": 10, "ตุลาคม": 10,
  "พ.ย.": 11, "พฤศจิกายน": 11,
  "ธ.ค.": 12, "ธันวาคม": 12,
};

// หมวดของ CAMPHUB → ประเภทค่ายที่เราใช้กรอง
const TYPE_BY_SLUG = {
  "skills-workshop": "พัฒนาทักษะ/เวิร์กชอป",
  "guidance": "แนะแนวเรียนต่อ/อาชีพ",
  "seminar": "เสวนา/สัมมนา",
  "tutor": "ติวสอบ/ทำพอร์ต",
  "volunteer": "อาสา/อนุรักษ์",
  "openhouse": "งานเปิดบ้าน/นิทรรศการ",
  "exam-simulation": "จำลองสนามสอบ",
  "contest": "ประกวดแข่งขัน",
};

// หมวดสายวิชา → สายที่เราใช้แสดงบนการ์ด
const FIELD_BY_SLUG = {
  "computer": "คอม/ไอที",
  "science": "วิทยาศาสตร์",
  "engineer": "วิศวกรรม",
  "medical-health": "สายสุขภาพ",
  "doctor": "แพทย์",
  "dentist": "ทันตแพทย์",
  "nurse": "พยาบาล",
  "pharma": "เภสัช",
  "psychology": "จิตวิทยา",
  "vet": "สัตวแพทย์",
  "architect-design": "สถาปัตย์/ออกแบบ",
  "commarts": "นิเทศ/สื่อสาร",
  "account-commerce": "บัญชี/บริหาร",
  "lang-human": "ภาษา/มนุษย์",
  "social": "สังคมศาสตร์",
  "law": "นิติศาสตร์",
  "teacher": "ครู",
  "music": "ดนตรี",
  "aviation": "การบิน",
  "agri-fishery": "เกษตร/ประมง",
  "political": "รัฐศาสตร์",
  "economic": "เศรษฐศาสตร์",
  "logistics": "โลจิสติกส์",
  "hospitality": "การโรงแรม/ท่องเที่ยว",
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function toISO(year, month, day) {
  let ce = year;
  if (ce > 2400) ce -= 543;
  else if (ce < 100) ce += 2500 - 543;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${ce}-${mm}-${dd}`;
}

// แปลงข้อความไทย เช่น "28 – 30 พฤศจิกายน 2569" หรือ "12 พ.ย. 69" เป็นช่วงวันที่
export function parseThaiRange(text) {
  if (!text) return null;
  const clean = text.replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  const monthNames = Object.keys(THAI_MONTHS)
    .sort((a, b) => b.length - a.length)
    .map((m) => m.replace(/\./g, "\\."))
    .join("|");

  // 28 - 30 พฤศจิกายน 2569  /  12 พ.ย. 69
  const range = clean.match(
    new RegExp(`(\\d{1,2})\\s*(?:-\\s*(\\d{1,2}))?\\s*(${monthNames})\\s*(\\d{4}|\\d{2})`),
  );
  if (!range) return null;

  const [, d1, d2, monthName, yearText] = range;
  const month = THAI_MONTHS[monthName];
  const year = Number(yearText);
  if (!month) return null;

  return {
    start: toISO(year, month, Number(d1)),
    end: toISO(year, month, Number(d2 ?? d1)),
  };
}

function parseFacts(html) {
  const facts = {};
  const blocks = html.matchAll(
    /<div class="fk">([\s\S]*?)<\/div>\s*<div class="fv">([\s\S]*?)<\/div>\s*<\/div>/g,
  );
  for (const [, label, value] of blocks) {
    facts[stripTags(label)] = stripTags(value);
  }
  return facts;
}

function pickType(classes) {
  for (const [slug, label] of Object.entries(TYPE_BY_SLUG)) {
    if (classes.includes(`category-${slug}`)) return label;
  }
  if (classes.some((c) => c.startsWith("category-contest"))) return "ประกวดแข่งขัน";
  return "ค่าย/กิจกรรม";
}

function pickField(classes) {
  for (const [slug, label] of Object.entries(FIELD_BY_SLUG)) {
    if (classes.includes(`category-${slug}`)) return label;
  }
  return "ทั่วไป";
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SeedStackStudentProject/1.0; +https://opencode-project-gules.vercel.app)",
      accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseListing(html) {
  const camps = [];
  const seen = new Set();
  for (const article of html.matchAll(/<article class="([^"]*)"([\s\S]*?)<\/article>/g)) {
    const [block, className, body] = article;
    if (!block.includes("camphub.in.th/") || !body.includes("post-")) continue;
    const classes = className.split(/\s+/);
    const link = body.match(/href="(https:\/\/www\.camphub\.in\.th\/[a-z0-9-]+\/)"/i);
    const title = body.match(/title="([^"]+)"/);
    if (!link || !title) continue;
    const url = link[1];
    if (seen.has(url)) continue;
    seen.add(url);
    camps.push({
      url,
      title: decodeEntities(title[1]),
      type: pickType(classes),
      field: pickField(classes),
    });
  }
  return camps;
}

function parseCampPage(html, base) {
  const facts = parseFacts(html);
  const regto = html.match(/data-regto="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
  const evlast = html.match(/data-evlast="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
  const regmode = html.match(/data-regmode="([^"]*)"/)?.[1] ?? "";
  // ค่ายกับประกวดแข่งขันใช้ชื่อหัวข้อต่างกัน ("จัดเมื่อไหร่" กับ "แข่งเมื่อไหร่")
  const when = facts["จัดเมื่อไหร่"] ?? facts["แข่งเมื่อไหร่"] ?? "";
  const range = parseThaiRange(when);

  return {
    startDate: range?.start ?? null,
    endDate: range?.end ?? evlast ?? null,
    deadline: regto,
    level: facts["ใครสมัครได้"] ?? "",
    location: facts["จัดที่ไหน"] ?? facts["แข่งที่ไหน"] ?? "",
    fee: facts["ค่าใช้จ่าย"] ?? facts["ค่าสมัคร"] ?? "",
    seats: facts["รับจำนวน"] ?? "",
    organizer: facts["จัดโดย"] ?? "",
    registration: facts["สมัครเข้าร่วม"] ?? "",
    dateText: when,
    regmode,
    sourceUrl: base,
  };
}

async function main() {
  const found = [];
  for (const page of SOURCE_PAGES) {
    const html = await fetchText(page);
    found.push(...parseListing(html));
    await sleep(800);
  }

  const details = [];
  for (const camp of found) {
    try {
      const html = await fetchText(camp.url);
      details.push({
        id: camp.url.split("/").filter(Boolean).pop(),
        title: camp.title,
        type: camp.type,
        field: camp.field,
        ...parseCampPage(html, camp.url),
      });
      console.log("ok", camp.title);
    } catch (error) {
      console.log("ข้าม", camp.url, String(error.message));
    }
    await sleep(1000);
  }

  const camps = details
    .filter((c) => c.startDate || c.deadline)
    .map((c) =>
      c.startDate
        ? c
        : {
            ...c,
            startDate: c.deadline,
            endDate: c.deadline,
            dateIsDeadline: true,
          },
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: "CAMPHUB",
        sourceUrl: BASE + "/",
        method:
          "อ่านหน้า HTML สาธารณะของการ์ดกิจกรรมหน้าแรก และหน้าแต่ละค่าย เก็บเฉพาะชื่อ วัน สถานที่ ค่าใช้จ่าย และลิงก์ต้นฉบับ",
        fetchedAt: new Date().toISOString(),
        note: "ข้อมูลเป็นของผู้จัดและ CAMPHUB โปรดตรวจสอบกับต้นฉบับก่อนสมัคร",
        camps,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`บันทึก ${camps.length} ค่ายลง data/camps.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
