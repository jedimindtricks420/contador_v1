"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  id: string;
  code?: string;
  name: string;
}

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

  const selectedOption = useMemo(() => options.find((opt) => opt.id === value), [options, value]);

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
    // If typing but it precisely matches current code, still show list?
    // Let's allow typing to filter.
    if (!search || (selectedOption && search === (selectedOption.code || selectedOption.name))) {
        return options;
    }
    const s = search.toLowerCase();
    return options.filter(opt => 
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
        <div className="mt-1 px-1">
          <p className="text-[11px] text-gray-400 font-medium leading-tight">
            {selectedOption.name}
          </p>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-200 rounded shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 cursor-pointer hover:bg-black group transition-colors flex flex-col border-b border-gray-50 last:border-0 ${
                  value === opt.id ? "bg-gray-50" : ""
                }`}
              >
                {opt.code && (
                    <span className={`text-[14px] font-semibold leading-tight group-hover:text-white ${
                        value === opt.id ? "text-black" : "text-gray-900"
                    }`}>
                        {opt.code}
                    </span>
                )}
                <span className={`text-[13px] font-normal leading-snug break-words group-hover:text-gray-300 ${
                    value === opt.id ? "text-gray-500" : "text-gray-500"
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
