import React, { useState } from "react";
import { ChevronDown, Tag, Gamepad2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicFAQItem } from "../types/faq";
import { isSafeUrl } from "./BlogContentRenderer";

interface FaqAccordionProps {
  items: PublicFAQItem[];
  allowMultiple?: boolean;
  defaultOpenIndex?: number;
  className?: string;
  showCategoryBadge?: boolean;
}

// Render safe inline formatted text (bold, italic, inline code, safe links)
function renderSafeInline(text: string): React.ReactNode {
  // Replace bold: **text**
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-primary font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      if (isSafeUrl(url)) {
        const isExternal = url.startsWith("http://") || url.startsWith("https://");
        return (
          <a
            key={index}
            href={url}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="text-primary hover:text-brand-600 underline font-medium"
          >
            {label}
          </a>
        );
      }
      return <span key={index}>{label}</span>;
    }
    return part;
  });
}

// Render formatted safe lines and bullet lists
function renderFaqAnswer(answer: string): React.ReactNode {
  if (!answer) return null;

  const lines = answer.split("\n");
  const nodes: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      nodes.push(
        <ul key={`list-${key}`} className="list-disc list-inside space-y-1.5 my-2 text-slate-600 text-sm sm:text-base leading-relaxed pl-1">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderSafeInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList(idx);
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      currentList.push(trimmed.slice(2));
      return;
    }

    flushList(idx);
    nodes.push(
      <p key={`p-${idx}`} className="text-slate-600 text-sm sm:text-base leading-relaxed my-1.5">
        {renderSafeInline(trimmed)}
      </p>
    );
  });

  flushList(lines.length);
  return nodes;
}

export default function FaqAccordion({
  items,
  allowMultiple = false,
  defaultOpenIndex,
  className = "",
  showCategoryBadge = false
}: FaqAccordionProps) {
  const [openIndices, setOpenIndices] = useState<number[]>(() => {
    return defaultOpenIndex !== undefined && defaultOpenIndex >= 0 ? [defaultOpenIndex] : [];
  });

  const toggleItem = (index: number) => {
    if (allowMultiple) {
      setOpenIndices((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    } else {
      setOpenIndices((prev) => (prev.includes(index) ? [] : [index]));
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <p className="text-slate-500 text-sm font-medium">Tidak ada FAQ yang sesuai dengan pencarian Anda.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => {
        const isOpen = openIndices.includes(index);
        const headingId = `faq-heading-${item.id}`;
        const panelId = `faq-panel-${item.id}`;

        return (
          <div
            key={item.id}
            className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
              isOpen
                ? "bg-white border-brand-200 shadow-sm ring-1 ring-brand-500/10"
                : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
            }`}
          >
            <button
              id={headingId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleItem(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleItem(index);
                }
              }}
              className="w-full text-left px-5 py-4 sm:px-6 sm:py-4.5 flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 select-none"
            >
              <div className="flex-1 min-w-0">
                {showCategoryBadge && item.category && (
                  <span className="inline-block px-2.5 py-0.5 mb-1.5 rounded-full text-xs font-semibold bg-brand-50 text-primary">
                    {item.category}
                  </span>
                )}
                <h3 className={`text-sm sm:text-base font-semibold leading-snug transition-colors ${
                  isOpen ? "text-slate-900" : "text-slate-900"
                }`}>
                  {item.question}
                </h3>
              </div>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                  isOpen
                    ? "bg-brand-100 text-primary rotate-180"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
                aria-hidden="true"
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={headingId}
                className="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 border-t border-slate-100/80"
              >
                <div className="prose prose-sm max-w-none text-slate-600">
                  {renderFaqAnswer(item.answer)}
                </div>

                {/* Optional Related Reference Badges (Zero duplication, read-only preview) */}
                {(item.relatedGame || item.relatedPromo) && (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                    {item.relatedGame && (
                      <Link
                        to={`/games/${item.relatedGame.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-brand-600" />
                        <span>Katalog Game: {item.relatedGame.name}</span>
                        <ArrowRight className="w-3 h-3 text-brand-500" />
                      </Link>
                    )}
                    {item.relatedPromo && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Voucher Promo: {item.relatedPromo.code} ({item.relatedPromo.name})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
