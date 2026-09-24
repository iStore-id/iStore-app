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
    fetch('/api/public/landings')
      .then(res => res.json())
      .then(json => {
        if (json.success) setLandings(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || landings.length === 0) return null;

  return (
    <section className="py-8 max-w-7xl mx-auto px-4 lg:px-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brand-600 uppercase mb-4">
        <h2>Promo & Event Spesial</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {landings.map((l) => (
          <motion.div 
            key={l.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-800/80 hover:border-brand-500/30 shadow-2xs hover:shadow-md transition-all duration-300"
          >
            {l.mediaUrl && (
              <div className="overflow-hidden aspect-video bg-slate-50 dark:bg-slate-950">
                <img 
                  src={l.mediaUrl} 
                  alt={l.title} 
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" 
                />
              </div>
            )}
            <div className="p-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-brand-600 transition-colors">{l.title}</h3>
              <p className="text-slate-500 text-xs mb-4 line-clamp-2 leading-relaxed">{l.description}</p>
              <Link 
                to={`/promo/${l.slug}`}
                className="storefront-btn-primary inline-block w-full text-center bg-slate-950 hover:bg-slate-850 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 py-2.5 px-4 rounded-xl text-xs font-bold transition duration-250 shadow-xs active:scale-[0.98]"
              >
                {l.ctaText || "Lihat Promo"}
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
