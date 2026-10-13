import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

interface LandingPreview {
  id: string;
  title: string;
  slug: string;
  description: string;
  mediaUrl?: string;
  ctaText?: string;
}

export const LandingPreviewSection: React.FC = () => {
  const [landings, setLandings] = useState<LandingPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/campaigns')
      .then(res => res.json())
      .then(json => {
        if (json.success) setLandings(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || landings.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--primary-color, #ff4400)" }}>
            Promo & Event
          </p>
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl" style={{ color: "var(--text-color)" }}>
            Promo Hari Ini
          </h2>
        </div>
        {landings.length > 1 && (
          <span className="shrink-0 text-[11px] font-medium" style={{ color: "var(--muted-text-color, #64748b)" }}>
            {landings.length} promo
          </span>
        )}
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {landings.map((landing) => (
          <motion.article
            key={landing.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="group w-[82%] min-w-0 shrink-0 snap-start overflow-hidden rounded-2xl border transition-shadow duration-200 hover:shadow-md sm:w-auto sm:shrink"
            style={{ backgroundColor: "var(--surface-color)", borderColor: "var(--border-color)" }}
          >
            {landing.mediaUrl ? (
              <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundColor: "var(--surface-muted-color, var(--surface-color))" }}>
                <img
                  src={landing.mediaUrl}
                  alt={landing.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center" style={{ backgroundColor: "var(--surface-muted-color, var(--surface-color))" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--muted-text-color, #64748b)" }}>Promo iStore</span>
              </div>
            )}

            <div className="flex h-full flex-col p-3.5 sm:p-4">
              <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-snug sm:text-base" style={{ color: "var(--text-color)" }}>
                {landing.title}
              </h3>
              <p className="mb-4 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--muted-text-color, #64748b)" }}>
                {landing.description}
              </p>
              <Link
                to={`/landing/${landing.slug}`}
                className="storefront-btn-primary mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-[0.98]"
                style={{ backgroundColor: "var(--primary-color, #ff4400)", color: "var(--on-primary-color, #ffffff)" }}
              >
                {landing.ctaText || "Lihat Promo"}
              </Link>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};
