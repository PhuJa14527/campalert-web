"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, hasSupabaseConfig, signInWithDiscord, signOut } from "@/lib/supabase";

type Account = { name: string; avatar: string | null };

function readAccount(session: Session | null): Account | null {
  if (!session) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    name: meta.user_name ?? meta.full_name ?? meta.name ?? "ผู้ใช้ Discord",
    avatar: meta.avatar_url ?? null,
  };
}

export function SignInButton({ label = "เข้าสู่ระบบด้วย Discord" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => signInWithDiscord()}
      className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752c4]"
    >
      {label}
    </button>
  );
}

export default function AccountBar() {
  const enabled = hasSupabaseConfig();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccount(readAccount(data.session));
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAccount(readAccount(session));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!enabled) return null;

  if (!ready) {
    return <span className="text-xs text-zinc-400">กำลังเช็กบัญชี…</span>;
  }

  if (!account) {
    return <SignInButton />;
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1.5 text-sm hover:border-zinc-400"
      >
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.avatar}
            alt=""
            className="h-6 w-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-200 text-xs">
            {account.name.slice(0, 1)}
          </span>
        )}
        <span className="max-w-28 truncate">{account.name}</span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-xs text-zinc-500 underline hover:text-zinc-800"
      >
        ออก
      </button>
    </div>
  );
}
