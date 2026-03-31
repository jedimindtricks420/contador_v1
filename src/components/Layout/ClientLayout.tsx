"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AIChat from "../AIChat";
import { useUI } from "@/lib/ui-context";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { isChatOpen } = useUI();

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {!isLoginPage && <Sidebar />}
      
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out bg-white min-h-screen ${
          !isLoginPage ? "ml-64" : ""
        } ${
          isChatOpen && !isLoginPage ? "pr-0 lg:pr-[400px]" : "pr-0"
        }`}
      >
        <div className={`transition-all duration-300 ${
          !isLoginPage ? "max-w-7xl mx-auto p-8" : "w-full min-h-screen"
        }`}>
          {children}
        </div>
      </main>

      {!isLoginPage && <AIChat />}
    </div>
  );
}
