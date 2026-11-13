// ดึงข้อมูลค่ายจากหน้าเว็บสาธารณะของ CAMPHUB (camphub.in.th)
//
// วิธีที่ใช้: ขอหน้า HTML สาธารณะแบบอ่านอย่างเดียว ไม่ได้ล็อกอิน ไม่ได้ใช้ API ลับ
// 1) ไล่หน้า list สาธารณะ (หน้าแรก + หน้าหมวดหมู่/รูปแบบค่าย) เพื่อเก็บลิงก์ค่าย
//    การ์ดใน HTML มี class บอกหมวด เช่น category-skills-workshop, category-engineer
// 2) เปิดหน้าค่ายทีละหน้า เว้นจังหวะ เพื่ออ่านกล่องข้อมูลที่เว็บใช้แสดงผล (class="chv2")
//    ซึ่งมี data-regto (วันปิดรับสมัคร), data-evlast (วันสุดท้ายของกิจกรรม)
//    และบรรทัดข้อมูล เช่น "จัดเมื่อไหร่", "จัดที่ไหน", "ค่าใช้จ่าย", "รับจำนวน"
// 3) เก็บเฉพาะข้อมูลที่ต้องใช้แสดงผล ไม่ได้คัดลอกบทความหรือรูปภาพ
//    และใส่เครดิตพร้อมลิงก์กลับไปเสมอ
//
// หลักปฏิบัติ: เว้นจังหวะระหว่างการขอหน้าเว็บ ไม่ยิงรัว (ค่าเริ่มต้น 350ms)
// ถ้าจะใช้เชิงพาณิชย์หรือดึงข้อมูลจำนวนมาก ควรขออนุญาต CAMPHUB ก่อน
//
// รันด้วย: npm run fetch:camphub  (ตั้งค่า CAMPHUB_DELAY_MS เพื่อปรับจังหวะได้)

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = "https://www.camphub.in.th";
const DELAY = Number(process.env.CAMPHUB_DELAY_MS ?? 350);

const LIST_PAGES = [
  "/",
  "/search-results/",
  "/medical-health/",
  "/medical-health/doctor/",
  "/medical-health/dentist/",
  "/medical-health/nurse/",
  "/medical-health/pharma/",
  "/medical-health/psychology/",
  "/medical-health/vet/",
  "/medical-health/allied-health-sciences/",
  "/medical-health/health-other/",
  "/science/",
  "/computer/",
  "/engineer/",
  "/architect-design/",
  "/agri-fishery/",
  "/aviation/",
  "/contest/",
  "/type/volunteer/",
  "/type/skills-workshop/",
  "/type/guidance/",
  "/type/openhouse/",
  "/type/seminar/",
  "/type/tutor/",
  "/type/exam-simulation/",
  "/account-commerce/",
  "/lang-human/",
  "/social/",
  "/law/",
  "/commarts/",
  "/music/",
  "/teacher/",
  "/political/",
  "/economic/",
  "/logistics/",
  "/hospitality/",
];

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
  "allied-health-sciences": "เทคนิคการแพทย์",
  "architect-design": "สถาปัตย์/ออกแบบ",
  "commarts": "นิเทศ/สื่อสาร",
  "account-commerce": "บัญชี/บริหาร",
  "lang-human": "ภาษา/มนุษย์",
  "social": "สังคมศาสตร์",
  "law": "นิติศาสตร์",
  "teacher": "ครุศาสตร์/ศึกษา",
  "music": "ดนตรี",
  "aviation": "การบิน",
  "agri-fishery": "เกษตร/ประมง",
  "political": "รัฐศาสตร์",
  "economic": "เศรษฐศาสตร์",
  "logistics": "โลจิสติกส์",
  "hospitality": "การโรงแรม/ท่องเที่ยว",
};

const PROVINCES = [
  "กรุงเทพฯ", "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร",
  "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร",
  "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม",
  "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี",
  "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี",
  "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร",
  "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน",
  "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม",
  "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี",
  "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ",
  "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
];

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
  return `${ce}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseThaiRange(text) {
  if (!text) return null;
  let clean = text.replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  // ตัดช่วงเวลา เช่น "09.00 - 16.00 น." ทิ้งก่อน ไม่งั้นจะไปสับสนกับวันที่
  clean = clean.replace(/\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}\s*น?\.?/g, " ");
  clean = clean.replace(/เวลา/g, " ");

  const monthPattern = Object.keys(THAI_MONTHS)
    .sort((a, b) => b.length - a.length)
    .map((month) => month.replace(/\./g, "\\."))
    .join("|");

  // 5 ก.พ. - 7 ก.พ. 2569 หรือ 30 พ.ย. - 2 ธ.ค. 2569 (ข้ามเดือน/ข้ามปี)
  const cross = clean.match(
    new RegExp(
      `(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{4}|\\d{2})?\\s*-\\s*(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{4}|\\d{2})?`,
    ),
  );
  if (cross) {
    const [, d1, month1, year1, d2, month2, year2] = cross;
    const startYear = year1 ?? year2;
    const endYear = year2 ?? year1;
    if (startYear && endYear && THAI_MONTHS[month1] && THAI_MONTHS[month2]) {
      return {
        start: toISO(Number(startYear), THAI_MONTHS[month1], Number(d1)),
        end: toISO(Number(endYear), THAI_MONTHS[month2], Number(d2)),
      };
    }
  }

  // 5 - 7 ก.พ. 2569 (เดือนเดียวกัน)
  const sameMonth = clean.match(
    new RegExp(`(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{4}|\\d{2})`),
  );
  if (sameMonth) {
    const [, d1, d2, monthName, year] = sameMonth;
    const month = THAI_MONTHS[monthName];
    if (month) {
      return {
        start: toISO(Number(year), month, Number(d1)),
        end: toISO(Number(year), month, Number(d2)),
      };
    }
  }

  // 5 ก.พ. 2569 (วันเดียว)
  const single = clean.match(
    new RegExp(`(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{4}|\\d{2})`),
  );
  if (single) {
    const [, day, monthName, year] = single;
    const month = THAI_MONTHS[monthName];
    if (month) {
      const iso = toISO(Number(year), month, Number(day));
      return { start: iso, end: iso };
    }
  }

  return null;
}

function parseFacts(html) {
  const facts = {};
  for (const [, label, value] of html.matchAll(
    /<div class="fk">([\s\S]*?)<\/div>\s*<div class="fv">([\s\S]*?)<\/div>\s*<\/div>/g,
  )) {
    const key = stripTags(label);
    if (!facts[key]) facts[key] = stripTags(value);
  }
  return facts;
}

function categorySlugs(className) {
  return className
    .split(/\s+/)
    .filter((item) => item.startsWith("category-"))
    .map((item) => item.slice("category-".length));
}

function firstType(slugs) {
  for (const [slug, label] of Object.entries(TYPE_BY_SLUG)) {
    if (slugs.includes(slug)) return label;
  }
  if (slugs.some((slug) => slug.startsWith("contest"))) return "ประกวดแข่งขัน";
  return "ค่าย/กิจกรรม";
}

function firstField(slugs) {
  for (const [slug, label] of Object.entries(FIELD_BY_SLUG)) {
    if (slugs.includes(slug)) return label;
  }
  return "ทั่วไป";
}

function pickLevels(levelText) {
  const levels = [];
  if (/ม\.?\s*1|ม\.?\s*2|ม\.?\s*3|ม\.ต้น/.test(levelText)) levels.push("ม.ต้น");
  if (/ม\.?\s*4|ม\.?\s*5|ม\.?\s*6|ม\.ปลาย/.test(levelText)) levels.push("ม.ปลาย");
  if (/ปวช/.test(levelText)) levels.push("ปวช.");
  if (/ปวส/.test(levelText)) levels.push("ปวส.");
  if (/มหาวิทยาลัย/.test(levelText)) levels.push("มหาวิทยาลัย");
  if (/บุคคลทั่วไป/.test(levelText)) levels.push("บุคคลทั่วไป");
  return levels;
}

const VENUE_PROVINCE = [
  // สถานที่/มหาวิทยาลัยที่เจอบ่อยใน CAMPHUB แล้วไม่ได้เขียนชื่อจังหวัด
  [/องครักษ์/, "นครนายก"],
  [/ศาลายา/, "นครปฐม"],
  [/รังสิต/, "ปทุมธานี"],
  [/บูรพา|burapha/i, "ชลบุรี"],
  [/พญาไท|phayathai|จุฬา|สยาม|สีลม|สุขุมวิท|อโศก|หัวลำโพง|อารีย์|บางเขน|จตุจักร|ดินแดง|ราชเทวี|ปทุมวัน|วัฒนา|คลองเตย|หลักสี่|ดอนเมือง|ห้วยขวาง|สามย่าน|samyan|siam/i, "กรุงเทพฯ"],
  [/ลาดกระบัง|บางมด|เทคโนโลยีพระจอมเกล้า|kmitl|kmutt|kmitnb/i, "กรุงเทพฯ"],
  [/เกษตรศาสตร์|kasetsart/i, "กรุงเทพฯ"],
  [/ศรีนครินทรวิโรฒ|มศว/i, "กรุงเทพฯ"],
  [/เกษมบัณฑิต|kasem/i, "กรุงเทพฯ"],
  [/เทคโนโลยีไทย-ญี่ปุ่น|\btni\b/i, "กรุงเทพฯ"],
  [/mbk|มาบุญครอง|phaholyothin|พหลโยธิน|อนุสาวรีย์ชัย|asoke|true space/i, "กรุงเทพฯ"],
  [/knowledge exchange|\bkx\b/i, "กรุงเทพฯ"],
  [/ธุรกิจบัณฑิต|dhurakij|\bdpu\b/i, "กรุงเทพฯ"],
  [/หอการค้าไทย|utcc/i, "กรุงเทพฯ"],
  [/สวนสุนันทา|สวนดุสิต|suandusit/i, "กรุงเทพฯ"],
  [/เชียงใหม่|cmu/i, "เชียงใหม่"],
  [/ขอนแก่น|kku/i, "ขอนแก่น"],
  [/หาดใหญ่|สงขลา|psu/i, "สงขลา"],
  [/โคราช|นครราชสีมา|สุรนารี/i, "นครราชสีมา"],
  [/มหาสารคาม|msu/i, "มหาสารคาม"],
  [/อุบลราชธานี|ubon/i, "อุบลราชธานี"],
];

function pickProvince(location, title) {
  const text = `${location} ${title}`;
  // ถ้าเขียนชื่อจังหวัดมาตรง ๆ ใช้ชื่อจังหวัดนั้นก่อน
  const explicit = PROVINCES.find((province) => text.includes(province));
  if (explicit) return explicit === "กรุงเทพมหานคร" ? "กรุงเทพฯ" : explicit;
  // ไม่เขียนชื่อจังหวัด ใช้ชื่อสถานที่/มหาวิทยาลัยที่รู้จักแทน
  for (const [pattern, province] of VENUE_PROVINCE) {
    if (pattern.test(text)) return province;
  }
  if (/^ออนไลน์/.test(location.trim())) return "ออนไลน์";
  return "";
}

function pickPrice(feeText) {
  if (!feeText) return null;
  if (/ฟรี/.test(feeText) && !/\d/.test(feeText)) return 0;
  const match = feeText.replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function fetchText(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SeedStackStudentProject/1.0; +https://campalert-puri-z.vercel.app)",
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } catch (error) {
    // เน็ตสะดุดบ่อย ลองซ้ำอีก 2 ครั้งก่อนยอมแพ้
    if (attempt >= 2) throw error;
    await sleep(700 * (attempt + 1));
    return fetchText(url, attempt + 1);
  }
}

function parseListing(html) {
  const found = [];
  for (const [, className, body] of html.matchAll(/<article class="([^"]*)"([\s\S]*?)<\/article>/g)) {
    const link = body.match(/href="(https:\/\/www\.camphub\.in\.th\/[a-z0-9-]+\/)"/i)?.[1];
    const title = body.match(/title="([^"]+)"/)?.[1];
    if (!link || !title) continue;
    found.push({
      url: link,
      title: decodeEntities(title),
      slugs: categorySlugs(className),
    });
  }
  return found;
}

function parseCampPage(html) {
  const facts = parseFacts(html);
  const regto = html.match(/data-regto="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
  const evlast = html.match(/data-evlast="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
  const when =
    facts["จัดเมื่อไหร่"] ??
    facts["แข่งเมื่อไหร่"] ??
    facts["จัดกิจกรรมเมื่อไหร่"] ??
    facts["จัดงานเมื่อไหร่"] ??
    facts["วันจัดงาน"] ??
    facts["กำหนดการ"] ??
    "";
  const range = parseThaiRange(when);
  const level = facts["ใครสมัครได้"] ?? "";
  const location = facts["จัดที่ไหน"] ?? facts["แข่งที่ไหน"] ?? "";
  const fee = facts["ค่าใช้จ่าย"] ?? facts["ค่าสมัคร"] ?? "";

  return {
    facts,
    startDate: range?.start ?? null,
    endDate: range?.end ?? evlast ?? null,
    deadline: regto,
    level,
    levels: pickLevels(level),
    location,
    province: pickProvince(location, ""),
    fee,
    price: pickPrice(fee),
    seats: facts["รับจำนวน"] ?? "",
    organizer: facts["จัดโดย"] ?? "",
    registration: facts["สมัครเข้าร่วม"] ?? "",
    dateText: when,
    certificate: Boolean(facts["ประกาศนียบัตร"]) || /เกียรติบัตร|ประกาศนียบัตร/.test(facts["ข้อมูลอื่นๆ"] ?? ""),
    overnight: /ค้างคืน/.test(when),
    online: /ออนไลน์/.test(level) || /ออนไลน์/.test(location),
  };
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

// ค่ายยังเปิดรับไหม: ถ้ามีวันปิดรับให้ดูวันปิดรับ ถ้าไม่มีให้ดูวันจบกิจกรรม
function stillOpen(details, today) {
  const lastDay = details.deadline ?? details.endDate ?? details.startDate;
  return Boolean(lastDay) && lastDay >= today;
}

async function main() {
  const collect = new Map();

  for (const path of LIST_PAGES) {
    try {
      const html = await fetchText(BASE + path);
      for (const item of parseListing(html)) {
        if (!collect.has(item.url)) collect.set(item.url, item);
      }
      console.log("list", path, "→ รวม", collect.size);
    } catch (error) {
      console.log("ข้าม list", path, error.message);
    }
    await sleep(DELAY);
  }

  const known = new Set();
  const camps = [];
  const today = todayISO();
  let index = 0;
  let noEventDate = 0;
  const skipped = [];

  for (const item of collect.values()) {
    index += 1;
    try {
      const html = await fetchText(item.url);
      const { facts, ...details } = parseCampPage(html);

      // ต้องรู้ "วันจัดค่าย" จริง ๆ เพราะปฏิทินโชว์วันจัด ไม่ใช่วันปิดรับสมัคร
      // ถ้าอ่านไม่ได้ ยังเก็บค่ายไว้ในรายการ แต่จะไม่ขึ้นปฏิทิน
      if (!details.startDate) {
        noEventDate += 1;
        if (skipped.length < 80) {
          skipped.push({
            url: item.url,
            dateText: details.dateText,
            factKeys: Object.keys(facts),
            facts: facts,
          });
        }
      }

      // เก็บเฉพาะค่ายที่ยังเปิดรับสมัครเท่านั้น
      if (!stillOpen(details, today)) continue;

      const id = item.url.split("/").filter(Boolean).pop();
      if (known.has(id)) continue;
      known.add(id);

      camps.push({
        ...details,
        id,
        title: item.title,
        type: firstType(item.slugs),
        field: firstField(item.slugs),
        slugs: item.slugs,
        startDate: details.startDate,
        endDate: details.endDate ?? details.startDate,
        deadline: details.deadline,
        province: details.province || pickProvince(details.location, item.title),
        sourceUrl: item.url,
      });
      console.log(`[${index}/${collect.size}] ok ${item.title.slice(0, 40)}`);
    } catch (error) {
      console.log(`[${index}/${collect.size}] ข้าม`, item.url, error.message);
    }
    await sleep(DELAY);
  }

  if (noEventDate > 0) {
    console.log(
      `อ่านวันจัดไม่ได้ ${noEventDate} รายการ (ยังอยู่ในรายการ แต่ไม่ขึ้นปฏิทิน)`,
    );
    await mkdir(new URL("../logs/", import.meta.url), { recursive: true });
    await writeFile(
      new URL("../logs/skipped-no-date.json", import.meta.url),
      JSON.stringify({ checkedAt: new Date().toISOString(), count: noEventDate, samples: skipped }, null, 2) + "\n",
      "utf8",
    );
    console.log("เก็บตัวอย่างที่อ่านไม่ได้ไว้ที่ logs/skipped-no-date.json");
  }

  camps.sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));

  const summary = {
    source: "CAMPHUB",
    sourceUrl: BASE + "/",
    fetchedAt: new Date().toISOString(),
    sourcePages: LIST_PAGES.length,
    foundLinks: collect.size,
    keptCamps: camps.length,
    note:
      "รวบรวมจากหน้า list สาธารณะของ CAMPHUB (หน้าแรก + หมวดหมู่) เฉพาะค่ายที่ยังเปิดรับสมัคร ข้อมูลเป็นของผู้จัดและ CAMPHUB ควรตรวจสอบกับต้นฉบับก่อนสมัคร",
  };

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });

  // กันข้อมูลแย่ทับของดี: ถ้ารอบนี้ได้ค่ายน้อยกว่ารอบก่อนมาก (เช่นเน็ตหลุดครึ่งทาง)
  // ให้เก็บไฟล์เดิมไว้แล้วแจ้ง error เพื่อให้รอบถัดไปลองใหม่
  let previousCount = 0;
  try {
    const previous = JSON.parse(
      await readFile(new URL("../data/camps.json", import.meta.url), "utf8"),
    );
    previousCount = previous.camps?.length ?? 0;
  } catch {
    previousCount = 0;
  }

  if (previousCount >= 50 && camps.length < previousCount * 0.7) {
    console.log(
      `ยกเลิก: รอบนี้ได้ ${camps.length} ค่าย น้อยกว่ารอบก่อน (${previousCount}) เกิน 30% จึงไม่เขียนทับ`,
    );
    process.exit(2);
  }

  await writeFile(
    new URL("../data/camps.json", import.meta.url),
    JSON.stringify({ ...summary, camps }, null, 2) + "\n",
    "utf8",
  );

  console.log(`บันทึก ${camps.length} ค่าย จากลิงก์ที่พบ ${collect.size} รายการ`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
