import Link from "next/link";
import AccountBar from "@/app/account-bar";

export default function SiteHeader() {
  return (
    <header className="border-b border-[#ece4d6] bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-zinc-900">
            CampAlert<span className="text-orange-600">.</span>
          </span>
          <span className="hidden text-xs font-medium text-zinc-500 sm:inline">
            ค่ายไหนดี
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-orange-400 hover:text-orange-700"
          >
            ตั้งค่าการแจ้งเตือน
          </Link>
          <AccountBar />
        </div>
      </div>
    </header>
  );
}
