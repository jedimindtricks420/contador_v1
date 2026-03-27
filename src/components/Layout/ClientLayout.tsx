"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="flex min-h-screen">
      {!isLoginPage && <Sidebar />}
      <main className={`flex-1 ${!isLoginPage ? "ml-64" : ""} bg-white min-h-screen`}>
        <div className={!isLoginPage ? "max-w-7xl mx-auto p-8" : "w-full min-h-screen"}>
          {children}
        </div>
      </main>
    </div>
  );
}
