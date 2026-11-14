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

/**
 * รายชื่อมหาวิทยาลัยสำหรับตัวกรอง (slug เดียวกับหน้า search ของ CAMPHUB)
 * CAMPHUB ไม่ได้เก็บช่อง "มหาวิทยาลัย" เป็นข้อมูลแยกบนหน้าค่าย เราจึงอ่านจากชื่อผู้จัด
 * ด้วยคำสำคัญ เช่น "คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์" → มหาวิทยาลัยเกษตรศาสตร์
 */
const UNIVERSITY_RULES: { id: string; label: string; pattern: RegExp }[] = [
  // เรียงจากชื่อเฉพาะไปชื่อกว้าง เพราะใช้ตัวแรกที่ตรง (เช่น ราชมงคลพระนคร ก่อน ราชมงคล)
  { id: "chulalongkorn-university", label: "จุฬาลงกรณ์มหาวิทยาลัย", pattern: /จุฬาลงกรณ์|chulalongkorn/i },
  { id: "kasetsart-university", label: "มหาวิทยาลัยเกษตรศาสตร์", pattern: /เกษตรศาสตร์|kasetsart/i },
  { id: "thammasat-university", label: "มหาวิทยาลัยธรรมศาสตร์", pattern: /ธรรมศาสตร์|thammasat/i },
  { id: "mahidol-university", label: "มหาวิทยาลัยมหิดล", pattern: /มหิดล|ศิริราช|รามาธิบดี|mahidol/i },
  {
    id: "kmitl-king-mongkuts-institute-of-technology-ladkrabang",
    label: "สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง",
    pattern: /ลาดกระบัง|สจล|kmitl/i,
  },
  {
    id: "kmutt-king-mongkuts-university-of-technology-thonburi",
    label: "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี",
    pattern: /ธนบุรี|มจธ|kmutt/i,
  },
  {
    id: "kmutnb-king-mongkuts-university-of-technology-north-bangkok",
    label: "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ",
    pattern: /พระนครเหนือ|มจพ|kmutnb/i,
  },
  { id: "thai-nichi-institute-of-technology", label: "สถาบันเทคโนโลยีไทย-ญี่ปุ่น", pattern: /ไทย-?ญี่ปุ่น|thai-?nichi/i },
  { id: "silpakorn-university", label: "มหาวิทยาลัยศิลปากร", pattern: /ศิลปากร|silpakorn/i },
  { id: "chiang-mai-university", label: "มหาวิทยาลัยเชียงใหม่", pattern: /เชียงใหม่|chiangmai|chiang mai/i },
  { id: "prince-of-songkla-university", label: "มหาวิทยาลัยสงขลานครินทร์", pattern: /สงขลานครินทร์|songkhla|songkla/i },
  { id: "khon-kaen-university", label: "มหาวิทยาลัยขอนแก่น", pattern: /ขอนแก่น|khonkaen|khon kaen/i },
  { id: "srinakharinwirot-university", label: "มหาวิทยาลัยศรีนครินทรวิโรฒ", pattern: /ศรีนครินทรวิโรฒ|srinakharinwirot/i },
  {
    id: "university-of-the-thai-chamber-of-commerce",
    label: "มหาวิทยาลัยหอการค้าไทย",
    pattern: /หอการค้าไทย|chamber of commerce/i,
  },
  { id: "assumption-university", label: "มหาวิทยาลัยอัสสัมชัญ", pattern: /อัสสัมชัญ|assumption/i },
  { id: "naresuan-university", label: "มหาวิทยาลัยนเรศวร", pattern: /นเรศวร|naresuan/i },
  { id: "dhurakij-pundit-university", label: "มหาวิทยาลัยธุรกิจบัณฑิตย์", pattern: /ธุรกิจบัณฑิตย์|dhurakij/i },
  { id: "burapha-university", label: "มหาวิทยาลัยบูรพา", pattern: /บูรพา|burapha/i },
  { id: "suranaree-university-of-technology", label: "มหาวิทยาลัยเทคโนโลยีสุรนารี", pattern: /สุรนารี|suranaree/i },
  { id: "walailak-university", label: "มหาวิทยาลัยวลัยลักษณ์", pattern: /วลัยลักษณ์|walailak/i },
  {
    id: "rajamangala-university-of-technology-phra-nakhon",
    label: "มหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร",
    pattern: /ราชมงคลพระนคร/i,
  },
  { id: "rajamangala-university-of-technology", label: "มหาวิทยาลัยเทคโนโลยีราชมงคล", pattern: /ราชมงคล/i },
  { id: "mahasarakham-university", label: "มหาวิทยาลัยมหาสารคาม", pattern: /มหาสารคาม|mahasarakham/i },
  {
    id: "suan-sunandha-rajabhat-university",
    label: "มหาวิทยาลัยราชภัฏสวนสุนันทา",
    pattern: /สวนสุนันทา/i,
  },
  { id: "rajabhat-university", label: "มหาวิทยาลัยราชภัฏ", pattern: /ราชภัฏ/i },
  { id: "raffles-international-college", label: "วิทยาลัยนานาชาติราฟเฟิลส์", pattern: /ราฟเฟิลส์|raffles/i },
  { id: "maejo-university", label: "มหาวิทยาลัยแม่โจ้", pattern: /แม่โจ้|maejo/i },
  { id: "ubon-ratchathani-university", label: "มหาวิทยาลัยอุบลราชธานี", pattern: /อุบลราชธานี/i },
  { id: "rpc-technological-college", label: "วิทยาลัยเทคโนโลยีโอลิมปิก", pattern: /โอลิมปิก/i },
  { id: "ramkhamhaeng-university", label: "มหาวิทยาลัยรามคำแหง", pattern: /รามคำแหง|ramkhamhaeng/i },
  { id: "university-of-phayao", label: "มหาวิทยาลัยพะเยา", pattern: /พะเยา|phayao/i },
  {
    id: "srisavarindhira-thai-red-cross-institute-of-nursing",
    label: "สถาบันการพยาบาลศรีสวรินทิรา สภากาชาดไทย",
    pattern: /ศรีสวรินทิรา|สภากาชาดไทย/i,
  },
  { id: "stamford-international-university", label: "มหาวิทยาลัยนานาชาติแสตมฟอร์ด", pattern: /แสตมฟอร์ด|stamford/i },
  {
    id: "phramongkutklao-college-of-medicine",
    label: "วิทยาลัยแพทยศาสตร์พระมงกุฎเกล้า",
    pattern: /พระมงกุฎเกล้า|phramongkutklao/i,
  },
  { id: "pccms", label: "ราชวิทยาลัยจุฬาภรณ์", pattern: /จุฬาภรณ์/i },
  { id: "suan-dusit-university", label: "มหาวิทยาลัยสวนดุสิต", pattern: /สวนดุสิต/i },
  { id: "civil-aviation-training-center", label: "สถาบันการบินพลเรือน", pattern: /การบินพลเรือน/i },
  { id: "thaksin-university", label: "มหาวิทยาลัยทักษิณ", pattern: /ทักษิณ|thaksin/i },
  { id: "navamindradhiraj-university", label: "มหาวิทยาลัยนวมินทราธิราช", pattern: /นวมินทราธิราช/i },
  { id: "chitralada-technology-institute", label: "สถาบันเทคโนโลยีจิตรลดา", pattern: /จิตรลดา/i },
  { id: "สถาบันเทคโนโลยีปทุมวัน", label: "สถาบันเทคโนโลยีปทุมวัน", pattern: /ปทุมวัน/i },
  {
    id: "panyapiwat-institute-of-management",
    label: "สถาบันการจัดการปัญญาภิวัฒน์",
    pattern: /ปัญญาภิวัฒน์|panyapiwat/i,
  },
  { id: "rangsit-university", label: "มหาวิทยาลัยรังสิต", pattern: /รังสิต|rangsit/i },
  { id: "sripatum-university", label: "มหาวิทยาลัยศรีปทุม", pattern: /ศรีปทุม|sripatum|\bspu\b/i },
  { id: "christian-university-of-thailand", label: "มหาวิทยาลัยคริสเตียน", pattern: /คริสเตียน|christian university/i },
  { id: "kasem-bundit-university", label: "มหาวิทยาลัยเกษมบัณฑิต", pattern: /เกษมบัณฑิต|kasem/i },
  { id: "bangkok-university", label: "มหาวิทยาลัยกรุงเทพ", pattern: /มหาวิทยาลัยกรุงเทพ|bangkok university/i },
  { id: "huachiew-chalermprakiet-university", label: "มหาวิทยาลัยหัวเฉียวเฉลิมพระเกียรติ", pattern: /หัวเฉียว|huachiew/i },
  { id: "western-university", label: "มหาวิทยาลัยเวสเทิร์น", pattern: /เวสเทิร์น|western university/i },
  // มีอยู่ในข้อมูลของเรา แต่ไม่มีในลิสต์หน้า search ของ CAMPHUB
  { id: "wongchawalitkul-university", label: "มหาวิทยาลัยวงษ์ชวลิตกุล", pattern: /วงษ์ชวลิตกุล/i },
];

/** ชื่อมหาวิทยาลัยของผู้จัดค่าย (null = ไม่ใช่ค่ายของมหาวิทยาลัย หรืออ่านไม่ได้) */
export function universityOf(camp: Camp): string | null {
  const name = camp.organizer ?? "";
  const found = UNIVERSITY_RULES.find((rule) => rule.pattern.test(name));
  return found ? found.id : null;
}

export const universityLabels: Record<string, string> = Object.fromEntries(
  UNIVERSITY_RULES.map((rule) => [rule.id, rule.label]),
);

/** เฉพาะมหาวิทยาลัยที่มีค่ายในรอบนี้ เรียงจากที่มีค่ายมากไปน้อย */
export const campUniversities = UNIVERSITY_RULES.map((rule) => ({
  id: rule.id,
  label: rule.label,
  count: camps.filter((camp) => universityOf(camp) === rule.id).length,
}))
  .filter((item) => item.count > 0)
  .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));


