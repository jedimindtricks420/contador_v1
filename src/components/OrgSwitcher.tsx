"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Plus, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function OrgSwitcher() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => fetch("/api/organizations").then((res) => res.json()),
  });

  const activeOrg = organizations?.find((o: any) => o.is_active);

  const switchMutation = useMutation({
    mutationFn: (org_id: string) =>
      fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id }),
      }).then((res) => res.json()),
    onSuccess: () => {
      window.location.reload();
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between space-x-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded hover:border-black transition-all group"
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 rounded bg-black flex items-center justify-center text-white shrink-0">
            <Building2 size={16} strokeWidth={1.5} />
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Организация</p>
            <p className="text-xs font-bold text-gray-900 truncate">{activeOrg?.name || "Загрузка..."}</p>
          </div>
        </div>
        <ChevronDown size={14} className={`text-gray-400 group-hover:text-black transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-gray-200 rounded shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-1">Ваши юрлица</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
            {organizations?.map((org: any) => (
              <button
                key={org.id}
                onClick={() => {
                  if (!org.is_active) switchMutation.mutate(org.id);
                  setIsOpen(false);
                }}
                disabled={org.is_active || switchMutation.isPending}
                className={`w-full text-left px-4 py-3 text-xs font-medium flex items-center justify-between transition-colors
                  ${org.is_active ? "bg-black text-white" : "hover:bg-gray-50 text-gray-700"}`}
              >
                <span className="truncate">{org.name}</span>
                {org.is_active && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/onboarding/step-1?new=true");
              }}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black hover:bg-gray-50 rounded transition-all"
            >
              <Plus size={12} />
              <span>Добавить компанию</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
