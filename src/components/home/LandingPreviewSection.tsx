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
    <section className="py-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Promo Spesial</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {landings.map((l) => (
          <motion.div 
            key={l.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100"
          >
            {l.mediaUrl && (
              <img src={l.mediaUrl} alt={l.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{l.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{l.description}</p>
              <Link 
                to={`/promo/${l.slug}`}
                className="storefront-btn-primary inline-block w-full text-center bg-brand-600 text-white py-2 px-4 rounded-lg hover:bg-brand-500 font-medium transition duration-200 shadow-xs"
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
