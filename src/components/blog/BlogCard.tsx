import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import { PublicBlogItem, BlogNavPreview } from "../../types/blog";

export type BlogPostCardData = PublicBlogItem | BlogNavPreview;

interface BlogCardProps {
  blog: BlogPostCardData;
  className?: string;
  headingLevel?: "h3" | "h4";
  onSelect?: (slug: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "default" | "compact";
}

function formatDate(dateString?: string) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

export default function BlogCard({ 
  blog, 
  className = "", 
  headingLevel = "h3", 
  onSelect, 
  onClick,
  variant = "default" 
}: BlogCardProps) {
  const HeadingTag = headingLevel;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
    if (onSelect) {
      e.preventDefault();
      onSelect(blog.slug);
    }
  };

  const isCompact = variant === "compact";

  return (
    <Link
      to={`/blog/${blog.slug}`}
      onClick={handleClick}
      className={`group bg-white rounded-3xl ${
        isCompact 
          ? "p-2 sm:p-3.5 h-[190px] xs:h-[205px] sm:h-auto overflow-hidden" 
          : "p-2.5 sm:p-3.5"
      } border border-slate-200/70 shadow-2xs hover:shadow-md hover:border-brand-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${className}`}
    >
      <div className={isCompact ? "space-y-1 sm:space-y-3" : "space-y-3"}>
        {/* Aspect-Ratio Governed Cover Image with Media Library Source */}
        <div className={`${
          isCompact ? "aspect-[16/9] sm:aspect-[16/10]" : "aspect-[16/10]"
        } w-full rounded-2xl overflow-hidden bg-slate-100 relative border border-slate-100/80`}>
          {blog.coverMediaUrl ? (
            <img
              src={blog.coverMediaUrl}
              alt={blog.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-brand-50/50 to-slate-200 text-slate-400">
              <BookOpen className="w-8 h-8 text-brand-400/80 mb-1" />
              <span className="text-[10px] font-semibold text-slate-400">iStore Blog</span>
            </div>
          )}
        </div>

        {/* Editorial unboxed category kicker and metadata row */}
        <div className="flex flex-wrap items-center gap-1 text-[9px] xs:text-[10px] text-slate-400">
          <span className="font-bold tracking-widest text-brand-600 uppercase truncate max-w-[65px] xs:max-w-none">
            {blog.category || "Berita"}
          </span>
          <span aria-hidden="true" className="text-slate-300">•</span>
          <span>{formatDate(blog.publishedAt)}</span>
          {!isCompact && (
            <>
              <span aria-hidden="true" className="text-slate-300">•</span>
              <span>~{blog.readTime || 1} mnt</span>
            </>
          )}
        </div>

        {/* Title with 2-line clamp */}
        <HeadingTag className={`font-bold ${
          isCompact ? "text-[11px] xs:text-xs sm:text-sm" : "text-xs sm:text-sm"
        } text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug text-left`}>
          {blog.title}
        </HeadingTag>

        {/* Excerpt with 2-line clamp */}
        {blog.excerpt && (
          <p className={`${
            isCompact ? "hidden sm:line-clamp-2" : "line-clamp-2"
          } text-[11px] sm:text-xs text-slate-500 leading-relaxed text-left`}>
            {blog.excerpt}
          </p>
        )}
      </div>

      {/* Card Footer: Author & Read More Link */}
      <div className={`${
        isCompact 
          ? "mt-1 sm:mt-4 pt-0 sm:pt-3 border-t-0 sm:border-t border-slate-100/80" 
          : "mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100/80"
      } flex items-center justify-between text-[11px] sm:text-xs`}>
        <div className={`items-center gap-1.5 text-slate-500 min-w-0 pr-1 ${
          isCompact ? "hidden sm:flex" : "flex"
        }`}>
          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[9px] shrink-0">
            {blog.author ? blog.author.charAt(0).toUpperCase() : "I"}
          </div>
          <span className="truncate max-w-[80px] sm:max-w-[100px] text-[10px] sm:text-[11px] font-medium text-slate-600">
            {blog.author || "Editorial"}
          </span>
        </div>

        <span className={`font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0 ${
          isCompact ? "ml-auto sm:ml-0" : ""
        }`}>
          <span className={isCompact ? "hidden sm:inline" : ""}>Baca</span>
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </span>
      </div>
    </Link>
  );
}
