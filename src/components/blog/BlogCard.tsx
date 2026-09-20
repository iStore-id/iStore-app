import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, Clock, ChevronRight } from "lucide-react";
import { PublicBlogItem, BlogNavPreview } from "../../types/blog";

export type BlogPostCardData = PublicBlogItem | BlogNavPreview;

interface BlogCardProps {
  blog: BlogPostCardData;
  className?: string;
  headingLevel?: "h3" | "h4";
  onSelect?: (slug: string) => void;
  onClick?: (e: React.MouseEvent) => void;
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

export default function BlogCard({ blog, className = "", headingLevel = "h3", onSelect, onClick }: BlogCardProps) {
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

  return (
    <Link
      to={`/blog/${blog.slug}`}
      onClick={handleClick}
      className={`group bg-white rounded-3xl p-2.5 sm:p-3.5 border border-slate-200/70 shadow-2xs hover:shadow-xl hover:shadow-slate-200/40 hover:border-brand-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${className}`}
    >
      <div className="space-y-3">
        {/* Aspect-Ratio Governed Cover Image with Media Library Source */}
        <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-slate-100 relative border border-slate-100/80">
          {blog.coverMediaUrl ? (
            <img
              src={blog.coverMediaUrl}
              alt={blog.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-brand-50/50 to-slate-200 text-slate-400">
              <BookOpen className="w-8 h-8 text-brand-400/80 mb-1" />
              <span className="text-[10px] font-semibold text-slate-400">iStore Blog</span>
            </div>
          )}

          {/* Category Badge */}
          <span className="absolute top-2.5 left-2.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/95 backdrop-blur-xs text-brand-700 text-[10px] sm:text-[11px] font-extrabold rounded-lg shadow-2xs border border-brand-100/60 uppercase tracking-wider">
            {blog.category || "Berita"}
          </span>
        </div>

        {/* Metadata: Date & Reading Time */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{formatDate(blog.publishedAt)}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>~{blog.readTime || 1} mnt</span>
          </div>
        </div>

        {/* Title with 2-line clamp */}
        <HeadingTag className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug text-left">
          {blog.title}
        </HeadingTag>

        {/* Excerpt with 2-line clamp */}
        {blog.excerpt && (
          <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 leading-relaxed text-left">
            {blog.excerpt}
          </p>
        )}
      </div>

      {/* Card Footer: Author & Read More Link */}
      <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px] sm:text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 min-w-0 pr-1">
          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[9px] shrink-0">
            {blog.author ? blog.author.charAt(0).toUpperCase() : "I"}
          </div>
          <span className="truncate max-w-[80px] sm:max-w-[100px] text-[10px] sm:text-[11px] font-medium text-slate-600">
            {blog.author || "Editorial"}
          </span>
        </div>

        <span className="font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
          <span>Baca</span>
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </span>
      </div>
    </Link>
  );
}
