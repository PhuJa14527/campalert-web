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

// ตั้งธีมและขนาดก่อนวาดหน้าแรก เพื่อไม่ให้จอวาบสีขาวแล้วค่อยเปลี่ยนเป็นมืด
const displayScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("campalert.theme")||"system";var z=localStorage.getItem("campalert.uiSize")||"md";var m=window.matchMedia("(prefers-color-scheme: dark)").matches;d.classList.toggle("dark",t==="dark"||(t==="system"&&m));if(z==="sm"||z==="md"||z==="lg"){d.setAttribute("data-size",z);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: displayScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
