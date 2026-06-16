"use client";
import Sidebar from "./Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: 256,
          padding: 32,
          minHeight: "100vh",
          background: "var(--background)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
