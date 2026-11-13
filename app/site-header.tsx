import Link from "next/link";
import AccountBar from "@/app/account-bar";

export default function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          ค่ายไหนดี<span className="text-emerald-600">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-400"
          >
            ตั้งค่าการแจ้งเตือน
          </Link>
          <AccountBar />
        </div>
      </div>
    </header>
  );
}
