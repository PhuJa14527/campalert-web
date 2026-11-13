import raw from "@/data/camps.json";

export type Camp = {
  id: string;
  title: string;
  /** ประเภทกิจกรรม เช่น พัฒนาทักษะ/เวิร์กชอป, ประกวดแข่งขัน */
  type: string;
  /** สาย/คณะ เช่น คอม/ไอที, แพทย์ */
  field: string;
  /** slug หมวดของ CAMPHUB เผื่อใช้ทำลิงก์หรือกรองละเอียด */
  slugs?: string[];
  startDate: string | null;
  endDate: string | null;
  deadline: string | null;
  level: string;
  levels?: string[];
  location: string;
  province?: string;
  fee: string;
  price?: number | null;
  seats: string;
  organizer: string;
  registration: string;
  dateText: string;
  certificate?: boolean;
  overnight?: boolean;
  online?: boolean;
  sourceUrl: string;
};

export const camps: Camp[] = raw.camps as Camp[];

export const dataFetchedAt: string = raw.fetchedAt;

export const dataSource: string = raw.sourceUrl;

export const dataStats = {
  sourcePages: (raw as { sourcePages?: number }).sourcePages ?? 0,
  foundLinks: (raw as { foundLinks?: number }).foundLinks ?? camps.length,
  keptCamps: camps.length,
};

const byCount = <T extends string>(values: T[]) => {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .map(([value]) => value);
};

/** ลำดับหมวดให้เหมือนหน้า CAMPHUB มากที่สุด (ตัวที่ไม่รู้จักต่อท้าย) */
function inOrder(preferred: string[], values: string[]) {
  const found = new Set(values);
  const ordered = preferred.filter((item) => found.has(item));
  const rest = values.filter((item) => !preferred.includes(item));
  return [...ordered, ...rest];
}

export const campTypes = inOrder(
  [
    "พัฒนาทักษะ/เวิร์กชอป",
    "แนะแนวเรียนต่อ/อาชีพ",
    "งานเปิดบ้าน/นิทรรศการ",
    "เสวนา/สัมมนา",
    "ติวสอบ/ทำพอร์ต",
    "จำลองสนามสอบ",
    "ประกวดแข่งขัน",
    "อาสา/อนุรักษ์",
    "ค่าย/กิจกรรม",
  ],
  byCount(camps.map((camp) => camp.type)),
);

export const campFields = inOrder(
  [
    "คอม/ไอที",
    "วิศวกรรม",
    "วิทยาศาสตร์",
    "แพทย์",
    "ทันตแพทย์",
    "เภสัช",
    "พยาบาล",
    "เทคนิคการแพทย์",
    "จิตวิทยา",
    "สัตวแพทย์",
    "สายสุขภาพ",
    "สถาปัตย์/ออกแบบ",
    "นิเทศ/สื่อสาร",
    "บัญชี/บริหาร",
    "เศรษฐศาสตร์",
    "นิติศาสตร์",
    "รัฐศาสตร์",
    "สังคมศาสตร์",
    "ภาษา/มนุษย์",
    "ครุศาสตร์/ศึกษา",
    "ดนตรี",
    "การบิน",
    "เกษตร/ประมง",
    "โลจิสติกส์",
    "การโรงแรม/ท่องเที่ยว",
  ],
  byCount(camps.map((camp) => camp.field)),
);

export const campLevels = inOrder(
  ["ม.ต้น", "ม.ปลาย", "ปวช.", "ปวส.", "มหาวิทยาลัย", "บุคคลทั่วไป"],
  byCount(camps.flatMap((camp) => camp.levels ?? [])),
);

export const campProvinces = inOrder(
  ["กรุงเทพฯ", "ปทุมธานี", "นครปฐม", "นนทบุรี", "สมุทรปราการ", "เชียงใหม่", "ขอนแก่น", "ชลบุรี"],
  byCount(camps.map((camp) => camp.province ?? "")),
);

export const priceRanges = [
  { id: "free", label: "ฟรี", test: (price?: number | null) => price === 0 },
  {
    id: "low",
    label: "ไม่เกิน 500",
    test: (price?: number | null) => price !== null && price !== undefined && price > 0 && price <= 500,
  },
  {
    id: "mid",
    label: "501 - 1,500",
    test: (price?: number | null) => price !== null && price !== undefined && price > 500 && price <= 1500,
  },
  {
    id: "high",
    label: "มากกว่า 1,500",
    test: (price?: number | null) => price !== null && price !== undefined && price > 1500,
  },
  {
    id: "unknown",
    label: "ไม่ระบุ",
    test: (price?: number | null) => price === null || price === undefined,
  },
] as const;

export type PriceRangeId = (typeof priceRanges)[number]["id"];

export const campFormats = [
  { id: "onsite", label: "ออนไซต์", test: (camp: Camp) => !camp.online },
  { id: "online", label: "ออนไลน์", test: (camp: Camp) => Boolean(camp.online) },
  { id: "overnight", label: "ค้างคืน", test: (camp: Camp) => Boolean(camp.overnight) },
] as const;

export type FormatId = (typeof campFormats)[number]["id"];

/**
 * หมวดแบบ CAMPHUB: สายสุขภาพ / สายวิทย์ / สายศิลป์ / ประกวดแข่งขัน
 * รายชื่อย่อยคัดมาจากเมนูหลักบนเว็บ CAMPHUB (slug ตรงกับที่เก็บใน camps.json)
 */
const CAMPHUB_TOPIC_GROUPS = [
  {
    id: "health",
    label: "สายสุขภาพ",
    items: [
      { slug: "doctor", label: "แพทย์" },
      { slug: "dentist", label: "ทันตแพทย์" },
      { slug: "nurse", label: "พยาบาล" },
      { slug: "pharma", label: "เภสัช" },
      { slug: "psychology", label: "จิตแพทย์/จิตวิทยา" },
      { slug: "vet", label: "สัตวแพทย์" },
      { slug: "allied-health-sciences", label: "เทคนิคการแพทย์/สหเวช" },
      { slug: "health-other", label: "สายสุขภาพอื่นๆ" },
    ],
  },
  {
    id: "science",
    label: "สายวิทย์",
    items: [
      { slug: "engineer", label: "วิศวกรรม" },
      { slug: "science", label: "วิทยาศาสตร์" },
      { slug: "computer", label: "คอม/ไอที" },
      { slug: "aviation", label: "การบิน" },
      { slug: "architect-design", label: "สถาปัตย์/ออกแบบ" },
      { slug: "agri-fishery", label: "เกษตร/ประมง" },
    ],
  },
  {
    id: "arts",
    label: "สายศิลป์",
    items: [
      { slug: "law", label: "นิติศาสตร์" },
      { slug: "political", label: "รัฐศาสตร์" },
      { slug: "account-commerce", label: "บัญชี/บริหารธุรกิจ" },
      { slug: "commarts", label: "นิเทศ/สื่อสารมวลชน" },
      { slug: "teacher", label: "ครู" },
      { slug: "lang-human", label: "อักษร/มนุษย์/ศิลปศาสตร์" },
      { slug: "social", label: "สังคมศาสตร์" },
      { slug: "economic", label: "เศรษฐศาสตร์" },
      { slug: "logistics", label: "โลจิสติกส์" },
      { slug: "hospitality", label: "การโรงแรม/ท่องเที่ยว" },
      { slug: "music", label: "ดนตรี" },
    ],
  },
  {
    id: "contest",
    label: "ประกวดแข่งขัน",
    items: [{ slug: "contest", label: "ประกวดแข่งขัน" }],
  },
] as const;

export type TopicOption = { slug: string; label: string; count: number };
export type TopicGroup = { id: string; label: string; options: TopicOption[] };

/** นับจำนวนค่ายของแต่ละตัวเลือก และซ่อนตัวเลือกที่ยังไม่มีค่ายเลย */
export const topicGroups: TopicGroup[] = CAMPHUB_TOPIC_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  options: group.items
    .map((item) => ({
      slug: item.slug,
      label: item.label,
      count: camps.filter((camp) => camp.slugs?.includes(item.slug)).length,
    }))
    .filter((item) => item.count > 0),
})).filter((group) => group.options.length > 0);

/** ใช้แปลง slug ที่เลือกอยู่เป็นชื่อไทยสำหรับแสดงเป็นป้าย */
export const topicLabels: Record<string, string> = Object.fromEntries(
  CAMPHUB_TOPIC_GROUPS.flatMap((group) => group.items.map((item) => [item.slug, item.label])),
);

export type OrganizerKind = "university" | "foundation" | "other";

/**
 * เดาชนิดผู้จัดจากชื่อ (CAMPHUB ไม่มีช่องนี้ ต้องอนุมานจากชื่อที่แสดง)
 * เช็กมูลนิธิก่อน เพราะบางชื่อมีทั้งคำว่ามูลนิธิและสถาบัน
 */
export function organizerKind(camp: Camp): OrganizerKind {
  const name = camp.organizer ?? "";
  if (/มูลนิธิ|foundation/i.test(name)) return "foundation";
  if (/มหาวิทยาลัย|มหาลัย|วิทยาลัย|คณะ|university|college/i.test(name)) return "university";
  return "other";
}

export const organizerKinds = [
  { id: "university", label: "มหาวิทยาลัย" },
  { id: "foundation", label: "มูลนิธิ" },
  { id: "other", label: "อื่น ๆ" },
] as const;

export const organizerCounts: Record<string, number> = Object.fromEntries(
  organizerKinds.map((kind) => [
    kind.id,
    camps.filter((camp) => organizerKind(camp) === kind.id).length,
  ]),
);

