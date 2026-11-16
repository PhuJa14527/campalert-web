import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CampAlert · ค่ายไหนดี รวมค่ายที่ยังเปิดรับสมัคร",
  description:
    "CampAlert รวมค่ายและกิจกรรมจาก CAMPHUB ที่ยังเปิดรับสมัครไว้ในที่เดียว พร้อมวันจัด สถานที่ ค่าใช้จ่าย และกำหนดปิดรับสมัคร",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
