import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export type CustomerThemePreference = "light" | "dark" | "system";

export interface ThemeToggleProps {
  currentPreference: CustomerThemePreference;
  effectiveTheme: "light" | "dark";
  onSelectPreference: (preference: CustomerThemePreference) => void;
  variant?: "header" | "mobile";
  className?: string;
}

const themeOptions: {
  id: CustomerThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "light", label: "Terang", icon: Sun },
  { id: "dark", label: "Gelap", icon: Moon },
  { id: "system", label: "Sistem", icon: Monitor },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  currentPreference,
  effectiveTheme,
  onSelectPreference,
  variant = "header",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mobile drawer variant: inline segmented row
  if (variant === "mobile") {
    return (
      <div className={`pt-2 pb-1 ${className}`} id="mobile-customer-theme-control">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary-color)" }}>
            Tema Tampilan
          </span>
          <span className="text-xs capitalize" style={{ color: "var(--text-secondary-color)" }}>
            {currentPreference === "system"
              ? `Sistem (${effectiveTheme === "dark" ? "Gelap" : "Terang"})`
              : currentPreference === "dark"
              ? "Gelap"
              : "Terang"}
          </span>
        </div>
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--background-color)", border: "1px solid var(--border-color)" }}
          role="radiogroup"
          aria-label="Pilih tema tampilan"
        >
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentPreference === opt.id;
            return (
              <button
                key={opt.id}
                id={`mobile-theme-opt-${opt.id}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectPreference(opt.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "text-brand-600 shadow-sm font-semibold"
                    : "hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop header variant: compact icon button with dropdown
  const ActiveIcon =
    currentPreference === "system"
      ? Monitor
      : currentPreference === "dark"
      ? Moon
      : Sun;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        id="desktop-customer-theme-toggle-btn"
        type="button"
        aria-label="Pilih tema tampilan"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 hover:text-brand-600 rounded-full transition-all flex items-center justify-center" style={{ color: "var(--header-text)" }}
        style={{ color: "var(--header-text)" }}
        title={`Tema: ${
          currentPreference === "system"
            ? "Sistem"
            : currentPreference === "dark"
            ? "Gelap"
            : "Terang"
        }`}
      >
        <ActiveIcon className="w-5 h-5 transition-transform duration-200" />
      </button>

      {isOpen && (
        <div
          id="desktop-customer-theme-dropdown"
          className="absolute right-0 mt-2 w-40 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100" style={{ backgroundColor: "var(--surface-color)", border: "1px solid var(--border-color)" }}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary-color)" }}>
            Tema Tampilan
          </div>
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentPreference === opt.id;
            return (
              <button
                key={opt.id}
                id={`desktop-theme-opt-${opt.id}`}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelectPreference(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                  isSelected
                    ? "font-semibold text-brand-600"
                    : "hover:text-brand-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
