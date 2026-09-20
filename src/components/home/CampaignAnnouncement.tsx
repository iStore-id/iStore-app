import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

export const CampaignAnnouncement: React.FC<{ campaigns: any[] }> = ({ campaigns }) => {
  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const dragDistanceRef = useRef(0);

  // Paginate function that sets direction and updates index
  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => (prev + newDirection + campaigns.length) % campaigns.length);
  }, [campaigns.length]);

  // Auto-slide every 5s with timer reset on currentIndex change
  useEffect(() => {
    if (campaigns.length <= 1) return;

    const timer = setInterval(() => {
      paginate(1);
    }, 5000);

    return () => clearInterval(timer);
  }, [campaigns.length, currentIndex, paginate]);

  const safeIndex = currentIndex >= campaigns.length ? 0 : currentIndex;
  const currentCampaign = campaigns[safeIndex];
  const url = currentCampaign.targetUrl || (currentCampaign.slug ? `/landing/${currentCampaign.slug}` : "");
  const isExternal = url.startsWith("http://") || url.startsWith("https://");

  const renderCardInner = () => (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 select-none">
      {/* Background Banner Image */}
      {currentCampaign.mediaUrl ? (
        <img
          src={currentCampaign.mediaUrl}
          alt={currentCampaign.title}
          className="w-full h-full object-contain pointer-events-none"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400">
          <Megaphone className="w-8 h-8 pointer-events-none" />
        </div>
      )}

      {/* Elegant Dark Gradient Overlay for legible Text */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent flex flex-col justify-center px-5 sm:px-8 text-white pointer-events-none">
        <div className="max-w-[75%] sm:max-w-[60%] space-y-1">
          {/* Badge & Paginate info */}
          <div className="flex items-center gap-1.5 text-brand-400">
            <Megaphone className="w-3 h-3 shrink-0" />
            <span className="font-bold text-[9px] sm:text-[10px] tracking-widest uppercase">
              Promo Spesial
            </span>
            {campaigns.length > 1 && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 ml-2">
                {safeIndex + 1} / {campaigns.length}
              </span>
            )}
          </div>

          <h3 className="font-bold text-xs sm:text-base text-white leading-tight truncate">
            {currentCampaign.title}
          </h3>

          <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-2 leading-snug">
            {currentCampaign.description || "Dapatkan promo eksklusif dan penawaran game seru sebelum masa berlaku habis."}
          </p>

          {url && (
            <div className="flex items-center text-[10px] sm:text-xs font-semibold text-brand-400 mt-1">
              Selengkapnya <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full py-2 bg-slate-50/10 dark:bg-slate-950/5 border-b border-slate-100 dark:border-slate-900/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div 
          className="w-full h-[120px] rounded-2xl overflow-hidden border shadow-sm hover:shadow-md hover:border-brand-300/30 dark:hover:border-brand-900/30 transition-all duration-300 relative bg-slate-950"
          style={{ borderColor: "var(--border-color)" }}
        >
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentCampaign.id || safeIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.3 },
              }}
              drag={campaigns.length > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragStart={() => {
                dragDistanceRef.current = 0;
              }}
              onDrag={(_, info) => {
                dragDistanceRef.current = Math.abs(info.offset.x);
              }}
              onDragEnd={(_, info) => {
                const swipeThreshold = 50;
                const velocityThreshold = 400;
                if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                  paginate(1);
                } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                  paginate(-1);
                }
              }}
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-pan-y"
            >
              {url ? (
                isExternal ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full w-full"
                    onClick={(e) => {
                      if (dragDistanceRef.current > 10) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {renderCardInner()}
                  </a>
                ) : (
                  <Link
                    to={url}
                    className="block h-full w-full"
                    onClick={(e) => {
                      if (dragDistanceRef.current > 10) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {renderCardInner()}
                  </Link>
                )
              ) : (
                <div className="h-full w-full">{renderCardInner()}</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};



