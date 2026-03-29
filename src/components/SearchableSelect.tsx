"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  id: string;
  code?: string;
  name: string;
  type?: string; 
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Активный", color: "text-blue-500 bg-blue-50" },
  CONTRA_ACTIVE: { label: "Контрактивный", color: "text-blue-700 bg-blue-100" },
  PASSIVE: { label: "Пассивный", color: "text-amber-600 bg-amber-50" },
  CONTRA_PASSIVE: { label: "Контрпассивный", color: "text-amber-700 bg-amber-100" },
  TRANSIT: { label: "Транзитный", color: "text-purple-600 bg-purple-50" },
  OFF_BALANCE: { label: "Забалансовый", color: "text-emerald-600 bg-emerald-50" },
  ACTIVE_PASSIVE: { label: "Акт.-Пасс.", color: "text-gray-600 bg-gray-50" },
};

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function SearchableSelect({ options, value, onChange, placeholder }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => options.find((opt: Option) => opt.id === value), [options, value]);

  // Sync search input with selected option when not open
  useEffect(() => {
    if (!isOpen) {
      if (selectedOption) {
        // Show only the code if it exists, otherwise the name
        setSearch(selectedOption.code || selectedOption.name);
      } else {
        setSearch("");
      }
    }
  }, [selectedOption, isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search || (selectedOption && search === (selectedOption.code || selectedOption.name))) {
        return options;
    }
    const s = search.toLowerCase();
    return options.filter((opt: Option) => 
      opt.name.toLowerCase().includes(s) || 
      (opt.code && opt.code.toLowerCase().includes(s))
    );
  }, [options, search, selectedOption]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full border-gray-200 border text-sm rounded px-3 py-2 pr-10 outline-none focus:border-black transition-colors bg-white font-semibold placeholder:font-normal placeholder:text-gray-300"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
            {search && isOpen && (
                <button onClick={() => { setSearch(""); inputRef.current?.focus(); }} className="text-gray-300 hover:text-black">
                    <X size={12} />
                </button>
            )}
            <ChevronDown 
                size={14} 
                className={`text-gray-300 transition-transform cursor-pointer ${isOpen ? 'rotate-180 text-black' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            />
        </div>
      </div>

      {/* Selected Name Subtitle (Only shown when closed and an option with code was chosen) */}
      {!isOpen && selectedOption && selectedOption.code && (
        <div className="mt-1 px-1 flex items-center justify-between">
          <p className="text-[11px] text-gray-400 font-medium leading-tight truncate">
            {selectedOption.name}
          </p>
          {selectedOption.type && TYPE_LABELS[selectedOption.type] && (
            <span className={`text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded ml-2 whitespace-nowrap ${TYPE_LABELS[selectedOption.type].color}`}>
              {TYPE_LABELS[selectedOption.type].label}
            </span>
          )}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-200 rounded shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                onMouseDown={(e: React.MouseEvent) => {
                  e.preventDefault();
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 group transition-colors flex flex-col border-b border-gray-100 last:border-0 ${
                  value === opt.id ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  {opt.code && (
                      <span className={`text-[14px] font-semibold leading-tight ${
                          value === opt.id ? "text-black" : "text-gray-900"
                      }`}>
                          {opt.code}
                      </span>
                  )}
                  {opt.type && TYPE_LABELS[opt.type] && (
                    <span className={`text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded ${TYPE_LABELS[opt.type].color}`}>
                      {TYPE_LABELS[opt.type].label}
                    </span>
                  )}
                </div>
                <span className={`text-[13px] font-normal leading-snug break-words mt-1 ${
                    value === opt.id ? "text-black" : "text-gray-500"
                }`}>
                    {opt.name}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest bg-gray-50">
              Ничего не найдено
            </div>
          )}
        </div>
      )}
    </div>
  );
}
