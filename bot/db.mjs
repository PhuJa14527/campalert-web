// อ่าน/เขียนการตั้งค่าจาก Supabase ให้บอทกับเว็บใช้ค่าเดียวกัน
// ใช้ service_role key ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่ส่งไปเบราว์เซอร์)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasDb() {
  return Boolean(url && key);
}

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function userIdForDiscord(discordId) {
  const rows = await rest(
    `profiles?discord_id=eq.${encodeURIComponent(discordId)}&select=id`,
  );
  return rows?.[0]?.id ?? null;
}

// คืนค่าเป็น { [discordId]: { mode, field, advance } }
export async function loadDbUsers() {
  if (!hasDb()) return {};

  const [profiles, settings] = await Promise.all([
    rest("profiles?select=id,discord_id&discord_id=not.is.null"),
    rest("notification_settings?select=user_id,mode,field,advance"),
  ]);

  const discordById = new Map((profiles ?? []).map((row) => [row.id, row.discord_id]));
  const users = {};

  for (const row of settings ?? []) {
    const discordId = discordById.get(row.user_id);
    if (!discordId) continue;
    users[discordId] = {
      mode: row.mode,
      field: row.field,
      advance: row.advance,
      source: "db",
    };
  }

  return users;
}

// คืนค่า true ถ้าเขียนลงฐานข้อมูลได้ (แปลว่าผู้ใช้เคยล็อกอินเว็บ)
export async function saveDbUser(discordId, config) {
  if (!hasDb()) return false;
  const userId = await userIdForDiscord(discordId);
  if (!userId) return false;

  await rest("notification_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      mode: config.mode,
      field: config.field,
      advance: config.advance,
      updated_at: new Date().toISOString(),
    }),
  });

  return true;
}

export async function deleteDbUser(discordId) {
  if (!hasDb()) return false;
  const userId = await userIdForDiscord(discordId);
  if (!userId) return false;

  await rest(`notification_settings?user_id=eq.${userId}`, { method: "DELETE" });
  return true;
}
