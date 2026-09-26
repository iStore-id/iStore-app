import React, { useEffect, useState, useRef } from "react";
import { 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { PublicBlogItem } from "../../types/blog";
import BlogCard from "../blog/BlogCard";

export default function BlogPreviewSection() {
  const [blogs, setBlogs] = useState<PublicBlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLatestBlogs = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/public/blog?limit=6");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setBlogs(json.data);
        }
      } catch (err) {
        console.warn("Notice: Failed to load blog previews", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLatestBlogs();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 280;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

  // If loading is finished and there are no blogs at all, do not disrupt the homepage layout
  if (!loading && blogs.length === 0) {
    return null;
  }

  return (
    <section className="py-8 sm:py-10 lg:py-12 border-t border-slate-200/80 px-4 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
        
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="ui-section-title text-slate-900">
            Blog & Berita
          </h2>

          {/* Desktop & Tablet Header Actions */}
          {blogs.length > 2 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200 shadow-2xs" style={{ backgroundColor: 'var(--surface-color)' }}>
              <button
                type="button"
                onClick={() => handleScroll("left")}
                aria-label="Geser ke kiri"
                className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll("right")}
                aria-label="Geser ke kanan"
                className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Adaptive Cards Container */}
        {loading ? (
          <div className="flex sm:grid sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 sm:gap-5 lg:gap-6 overflow-x-auto sm:overflow-visible pb-3 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-[190px] xs:w-[215px] sm:w-auto shrink-0 bg-white rounded-3xl p-3 border border-slate-200/70 shadow-2xs flex flex-col justify-between animate-pulse"
              >
                <div className="aspect-[16/10] w-full rounded-2xl bg-slate-200 mb-3.5"></div>
                <div className="space-y-2.5 flex-1">
                  <div className="h-3 w-1/3 bg-slate-200 rounded-md"></div>
                  <div className="h-4 w-5/6 bg-slate-200 rounded-md"></div>
                  <div className="h-3 w-full bg-slate-200 rounded-md"></div>
                </div>
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex justify-between items-center">
                  <div className="h-3 w-16 bg-slate-200 rounded-md"></div>
                  <div className="h-3 w-12 bg-slate-200 rounded-md"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* 
              Responsive & Adaptive container:
              - Mobile (< 640px): Flexible horizontal snap-carousel with compact proportional cards (w-[190px] to w-[215px]).
                Multiple cards peek in one viewport so user immediately notices it is scrollable.
                Never a rigid 1-card-full-screen block!
              - Tablet & Desktop (>= 640px): CSS Auto-fill grid (minmax 260px, 1fr) adapting fluidly to container width.
            */}
            <div
              ref={scrollContainerRef}
              className="flex sm:grid sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 sm:gap-5 lg:gap-6 overflow-x-auto sm:overflow-visible pb-3 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory no-scrollbar scroll-smooth"
            >
              {blogs.map((blog) => (
                <BlogCard
                  key={blog.id}
                  blog={blog}
                  variant="compact"
                  className="w-[190px] xs:w-[215px] sm:w-auto shrink-0 snap-start"
                  headingLevel="h3"
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
