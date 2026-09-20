import React from "react";
import { Info, AlertTriangle, Lightbulb, ExternalLink, Image as ImageIcon } from "lucide-react";

interface BlogContentRendererProps {
  content: string;
  className?: string;
}

export function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return false;
  }
  return trimmed.startsWith("/") || trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

export default function BlogContentRenderer({ content, className = "" }: BlogContentRendererProps) {
  if (!content) {
    return <div className="text-slate-400 italic">Konten artikel belum ditambahkan.</div>;
  }

  // Parse lines into logical blocks
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let listItems: string[] = [];

  const flushList = (keyPrefix: number) => {
    if (!inList || listItems.length === 0) return;
    if (listType === "ul") {
      blocks.push(
        <ul key={`ul-${keyPrefix}`} className="list-disc list-inside space-y-2 my-4 text-slate-700 leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`ol-${keyPrefix}`} className="list-decimal list-inside space-y-2 my-4 text-slate-700 leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    }
    inList = false;
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line
    if (!trimmed) {
      flushList(i);
      continue;
    }

    // Callout info / tip / warning
    if (trimmed.startsWith(":::tip") || trimmed.startsWith(":::info") || trimmed.startsWith(":::warning")) {
      flushList(i);
      const type = trimmed.includes("warning") ? "warning" : trimmed.includes("tip") ? "tip" : "info";
      const calloutLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        calloutLines.push(lines[i]);
        i++;
      }
      const calloutText = calloutLines.join("\n").trim();
      
      blocks.push(
        <div 
          key={`callout-${i}`}
          className={`p-4 sm:p-5 rounded-2xl border my-6 flex items-start gap-3.5 ${
            type === "warning"
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : type === "tip"
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : "bg-brand-50/80 border-brand-200 text-brand"
          }`}
        >
          {type === "warning" ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          ) : type === "tip" ? (
            <Lightbulb className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm sm:text-base leading-relaxed">
            {renderInline(calloutText)}
          </div>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("#### ")) {
      flushList(i);
      blocks.push(
        <h4 key={`h4-${i}`} className="text-lg font-bold text-slate-900 mt-6 mb-3">
          {renderInline(trimmed.replace(/^####\s+/, ""))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList(i);
      blocks.push(
        <h3 key={`h3-${i}`} className="text-xl font-bold text-slate-900 mt-8 mb-3 tracking-tight">
          {renderInline(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList(i);
      blocks.push(
        <h2 key={`h2-${i}`} className="text-2xl sm:text-3xl font-bold text-slate-900 mt-10 mb-4 tracking-tight pb-2 border-b border-slate-100">
          {renderInline(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
      continue;
    }

    // Image markdown: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      flushList(i);
      const alt = imgMatch[1];
      const url = imgMatch[2];
      const safe = isSafeUrl(url);

      blocks.push(
        <figure key={`img-${i}`} className="my-8">
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm max-h-[500px] flex items-center justify-center">
            {safe ? (
              <img 
                src={url} 
                alt={alt || "Ilustrasi artikel"} 
                className="w-full h-auto object-cover max-h-[500px]"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs">Gambar diblokir demi keamanan</span>
              </div>
            )}
          </div>
          {alt && (
            <figcaption className="text-center text-xs sm:text-sm text-slate-500 mt-2.5 italic">
              {alt}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList(i);
      blocks.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-brand-600 pl-4 py-1.5 my-6 text-slate-700 italic bg-slate-50/50 rounded-r-xl">
          {renderInline(trimmed.replace(/^>\s+/, ""))}
        </blockquote>
      );
      continue;
    }

    // Unordered list item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList || listType !== "ul") {
        flushList(i);
        inList = true;
        listType = "ul";
      }
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Ordered list item
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        flushList(i);
        inList = true;
        listType = "ol";
      }
      listItems.push(olMatch[1]);
      continue;
    }

    // Standard paragraph
    flushList(i);
    blocks.push(
      <p key={`p-${i}`} className="text-slate-700 text-base sm:text-lg leading-relaxed my-4">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList(lines.length);

  return <div className={`article-content ${className}`}>{blocks}</div>;
}

/**
 * Render inline tokens: bold (**text**), italic (*text*), inline code (`code`), and safe links ([text](url))
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex to split inline tokens
  // Matches [text](url), **bold**, *italic*, `code`
  const tokenRegex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Link [label](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      const safe = isSafeUrl(url);

      if (!safe) {
        return <span key={index} className="text-slate-500 underline decoration-dotted">{label}</span>;
      }

      const isExternal = url.startsWith("http://") || url.startsWith("https://");
      return (
        <a
          key={index}
          href={url}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2 inline-flex items-center gap-0.5 transition-colors"
        >
          {label}
          {isExternal && <ExternalLink className="w-3 h-3 ml-0.5 inline-block opacity-70" />}
        </a>
      );
    }

    // Bold **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Code `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={index} className="bg-slate-100 text-brand-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Plain text
    return <span key={index}>{part}</span>;
  });
}
