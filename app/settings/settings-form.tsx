"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignInButton } from "@/app/account-bar";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

type Mode = "new" | "deadline" | "both";
type Settings = { mode: Mode; field: string; advance: number };

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "new", label: "ค่ายใหม่", hint: "แจ้งเมื่อมีค่ายใหม่ตรงสายที่สนใจ" },
  { id: "deadline", label: "ใกล้ปิดรับ", hint: "แจ้งก่อนปิดรับสมัครตามจำนวนวันที่ตั้งไว้" },
  { id: "both", label: "ทั้งสองอย่าง", hint: "แจ้งทั้งค่ายใหม่และใกล้ปิดรับ" },
];

export default function SettingsForm({ fields }: { fields: string[] }) {
  const enabled = hasSupabaseConfig();
  const [status, setStatus] = useState<"loading" | "anon" | "signed">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [discordName, setDiscordName] = useState<string>("");
  const [settings, setSettings] = useState<Settings>({
    mode: "both",
    field: "ทั้งหมด",
    advance: 3,
  });
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (!data.session) {
        setStatus("anon");
        return;
      }

      const user = data.session.user;
      setUserId(user.id);
      setDiscordName(user.user_metadata?.user_name ?? user.user_metadata?.name ?? "");

      const [settingsRow, bookmarks] = await Promise.all([
        supabase
          .from("notification_settings")
          .select("mode, field, advance")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("bookmarks")
          .select("camp_id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      if (settingsRow.data) {
        setSettings({
          mode: settingsRow.data.mode as Mode,
          field: settingsRow.data.field as string,
          advance: settingsRow.data.advance as number,
        });
      }
      setBookmarkCount(bookmarks.count ?? 0);
      setStatus("signed");
    })();

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("notification_settings").upsert(
      {
        user_id: userId,
        mode: settings.mode,
        field: settings.field,
        advance: settings.advance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    setMessage(error ? `บันทึกไม่สำเร็จ: ${error.message}` : "บันทึกแล้ว ✅ บอทจะส่ง DM ตามนี้");
  }

  if (!enabled) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
        ยังไม่ได้ตั้งค่า Supabase ใน `.env.local`
      </p>
    );
  }

  if (status === "loading") {
    return <p className="text-sm text-zinc-500">กำลังโหลด…</p>;
  }

  if (status === "anon") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-base font-semibold">เข้าสู่ระบบก่อนตั้งค่า</p>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          ใช้บัญชี Discord ของคุณ เพื่อให้การตั้งค่าตรงกับ DM ที่บอทจะส่ง
          และให้ค่ายที่มาร์กไว้อยู่กับบัญชี ไม่หายเมื่อเปลี่ยนเครื่อง
        </p>
        <div className="mt-4">
          <SignInButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#ebe3d5] bg-white p-5">
        <p className="text-sm text-zinc-500">
          เข้าสู่ระบบในชื่อ <span className="font-medium text-zinc-800">{discordName || "ผู้ใช้ Discord"}</span>
          {" · "}
          <span>มาร์กค่ายไว้ {bookmarkCount} ค่าย</span>
        </p>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">จะให้แจ้งเรื่องอะไร</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODES.map((mode) => (
              <label
                key={mode.id}
                className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                  settings.mode === mode.id
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-orange-300"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={mode.id}
                  checked={settings.mode === mode.id}
                  onChange={() => setSettings((prev) => ({ ...prev, mode: mode.id }))}
                  className="sr-only"
                />
                <span className="block font-medium">{mode.label}</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    settings.mode === mode.id ? "text-white/70" : "text-zinc-500"
                  }`}
                >
                  {mode.hint}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">สายที่สนใจ</span>
            <select
              value={settings.field}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, field: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5"
            >
              <option value="ทั้งหมด">ทุกสาย</option>
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium">แจ้งล่วงหน้ากี่วันก่อนปิดรับ</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={14}
                value={settings.advance}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, advance: Number(event.target.value) }))
                }
                className="w-full accent-orange-600"
              />
              <span className="w-14 shrink-0 rounded-lg border border-zinc-200 px-2 py-1 text-center">
                {settings.advance} วัน
              </span>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
          {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#ebe3d5] bg-white p-5 text-sm leading-6 text-zinc-600">
        <p className="font-semibold text-zinc-900">ค่ายที่มาร์กไว้</p>
        <p className="mt-1">
          กดดาวที่การ์ดค่ายในหน้าแรก ค่ายที่มาร์กจะขึ้นในปฏิทิน (จุดสีเหลือง) และส่งไปบอทเพื่อแจ้งเตือน
          ถ้าอยากดูรายการทั้งหมด <Link href="/" className="text-orange-700 underline underline-offset-2">กลับไปหน้าแรก</Link>
        </p>
      </section>
    </div>
  );
}
