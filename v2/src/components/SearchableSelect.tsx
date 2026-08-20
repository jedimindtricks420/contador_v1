"use client";
import { useEffect, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  // Extra text matched against the search query but not shown (e.g. account/document code).
  searchText?: string;
}

// Shared searchable combobox: text input + filtered dropdown, replacing plain <select>
// across the app. Click/focus opens the list; typing filters by label and searchText;
// clicking outside closes it. `compact` gives the tighter inline-table-cell styling
// used by category pickers, otherwise it uses the standard form-field styling.
export default function SearchableSelect({
  options,
  value,
  onChange,
  allOption,
  placeholder,
  compact = false,
  disabled = false,
  className = "",
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  allOption?: { value: string; label: string };
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allOptions = allOption ? [{ value: allOption.value, label: allOption.label }, ...options] : options;
  const selectedLabel = allOptions.find(o => o.value === value)?.label ?? "";

  const filtered = query.length > 0
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.searchText ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : allOptions;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (disabled) {
    return (
      <span className={`text-gray-400 ${compact ? "text-xs px-1" : "text-xs"} ${className}`}>
        {selectedLabel || "—"}
      </span>
    );
  }

  const inputClassName = compact
    ? "w-full bg-white border border-gray-300 py-1 px-1 font-semibold text-gray-800 text-xs outline-none"
    : "w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 outline-none focus:border-black";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {compact && !open ? (
        <div
          onClick={() => { setOpen(true); setQuery(""); }}
          className="w-full bg-transparent py-1 px-1 font-semibold text-gray-800 text-xs cursor-pointer hover:bg-gray-100 transition-colors leading-tight min-h-[22px]"
        >
          {selectedLabel || <span className="text-gray-400 font-normal">{placeholder ?? "— Выберите —"}</span>}
        </div>
      ) : (
        <input
          type="text"
          autoFocus={compact && open}
          className={inputClassName}
          placeholder={open ? "Поиск..." : (selectedLabel || placeholder || "Выберите...")}
          value={open ? query : selectedLabel}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={e => setQuery(e.target.value)}
        />
      )}
      {open && (
        <div className="absolute z-50 left-0 w-full min-w-[220px] mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Ничего не найдено</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.value}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${o.value === value ? "bg-gray-100 font-semibold" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
