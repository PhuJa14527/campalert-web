import Link from "next/link";
import AccountBar from "@/app/account-bar";
import DisplaySettings from "@/app/display-settings";

export default function SiteHeader() {
  return (
    <header className="border-b border-[#ece4d6] bg-white dark:border-[#332e27] dark:bg-[#1c1a17]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            CampAlert<span className="text-emerald-600 dark:text-emerald-400">.</span>
          </span>
          <span className="hidden text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:inline">
            ค่ายไหนดี
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <DisplaySettings />
          <Link
            href="/settings"
            className="whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-[#3b352d] dark:bg-[#1c1a17] dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
          >
            ตั้งค่าการแจ้งเตือน
          </Link>
          <AccountBar />
        </div>
      </div>
    </header>
  );
}
