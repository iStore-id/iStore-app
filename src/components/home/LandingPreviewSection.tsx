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
    <section className="mx-auto w-full max-w-4xl px-4 py-3 sm:py-5">
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

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {landings.map((landing) => (
          <motion.article
            key={landing.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="group min-w-0 overflow-hidden rounded-lg border transition-shadow duration-200 hover:shadow-md"
            style={{ backgroundColor: "var(--surface-color)", borderColor: "var(--border-color)" }}
          >
            {landing.mediaUrl ? (
              <div className="relative aspect-[2/1] overflow-hidden" style={{ backgroundColor: "var(--surface-muted-color, var(--surface-color))" }}>
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
              <div className="flex aspect-[2/1] items-center justify-center" style={{ backgroundColor: "var(--surface-muted-color, var(--surface-color))" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--muted-text-color, #64748b)" }}>Promo iStore</span>
              </div>
            )}

            <div className="flex flex-col p-2 sm:p-2.5">
              <h3 className="mb-1 line-clamp-2 text-[13px] font-bold leading-snug" style={{ color: "var(--text-color)" }}>
                {landing.title}
              </h3>
              <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--muted-text-color, #64748b)" }}>
                {landing.description}
              </p>
              <Link
                to={`/landing/${landing.slug}`}
                className="storefront-btn-primary mt-1 inline-flex min-h-7 w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition active:scale-[0.98] sm:min-h-8 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
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
