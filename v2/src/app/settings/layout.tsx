import { SettingsSidebar } from "@/components/Layout/SettingsSidebar";
import ClientLayout from "@/components/Layout/ClientLayout";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientLayout>
      <div className="flex h-full bg-[#f1f5f9]">
        <SettingsSidebar />
        <div className="flex-1 overflow-auto bg-[#f1f5f9] p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </div>
    </ClientLayout>
  );
}
