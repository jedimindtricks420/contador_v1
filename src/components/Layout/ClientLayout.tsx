"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AIChat from "../AIChat";
import { useUI } from "@/lib/ui-context";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNoLayoutPage = pathname === "/" || pathname === "/login" || pathname === "/register" || pathname?.startsWith("/onboarding");
  const { isChatOpen } = useUI();

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {!isNoLayoutPage && <Sidebar />}
      
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out bg-white min-h-screen ${
          !isNoLayoutPage ? "ml-64" : ""
        } ${
          isChatOpen && !isNoLayoutPage ? "pr-0 lg:pr-[400px]" : "pr-0"
        }`}
      >
        <div className={`transition-all duration-300 ${
          !isNoLayoutPage ? "max-w-7xl mx-auto p-8" : "w-full min-h-screen"
        }`}>
          {children}
        </div>
      </main>

      {!isNoLayoutPage && <AIChat />}
    </div>
  );
}
