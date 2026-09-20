import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";

export interface HeroBanner {
  id: string;
  name: string;
  mediaUrl: string;
  title?: string;
  altText?: string;
  target?: string;
  placement?: string;
  sortOrder?: number;
}

interface HeroBannerCarouselProps {
  banners: HeroBanner[];
}

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

export default function HeroBannerCarousel({ banners }: HeroBannerCarouselProps) {
  if (!banners || banners.length === 0) {
    return null;
  }

  // JIKA HANYA 1 BANNER: Tampilkan statis tanpa controls, dots, atau auto-slide
  if (banners.length === 1) {
    const banner = banners[0];
    return (
      <div className="relative w-full overflow-hidden shadow-xl aspect-[16/9] sm:aspect-[21/9] bg-slate-900 group">
        <img
          src={banner.mediaUrl}
          alt={banner.altText || banner.name}
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 select-none pointer-events-none"
          referrerPolicy="no-referrer"
        />
        {(banner.title || banner.target) && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex flex-col justify-end p-4 sm:p-6 md:p-8">
            {banner.title && (
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
                {banner.title}
              </h2>
            )}
            {banner.target && (
              <a
                href={banner.target}
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl w-max shadow-lg shadow-brand-500/25 transition duration-300"
              >
                Lihat Detail <ArrowRight className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // JIKA 2+ BANNER: Carousel interaktif tanpa tombol panah
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDistanceRef = useRef(0);

  // Looping pagination
  const paginate = useCallback(
    (newDirection: number) => {
      setDirection(newDirection);
      setCurrentIndex((prev) => (prev + newDirection + banners.length) % banners.length);
    },
    [banners.length]
  );

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Auto-slide interval (~5 detik), otomatis pause saat hover/touch/drag
  useEffect(() => {
    if (isHovered || isDragging) return;

    const timer = setInterval(() => {
      paginate(1);
    }, 5000);

    return () => clearInterval(timer);
  }, [isHovered, isDragging, paginate]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      paginate(-1);
    } else if (e.key === "ArrowRight") {
      paginate(1);
    }
  };

  const safeIndex = currentIndex >= banners.length ? 0 : currentIndex;
  const currentBanner = banners[safeIndex] || banners[0];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero Banners"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsDragging(true)}
      onTouchEnd={() => setIsDragging(false)}
      className="relative w-full overflow-hidden shadow-xl aspect-[16/9] sm:aspect-[21/9] bg-slate-900 group focus:outline-none select-none"
    >
      {/* Animated Slide Viewport */}
      <div className="w-full h-full relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentBanner.id || safeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 280, damping: 32 },
              opacity: { duration: 0.25 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => {
              setIsDragging(true);
              dragDistanceRef.current = 0;
            }}
            onDrag={(_, info) => {
              dragDistanceRef.current = Math.abs(info.offset.x);
            }}
            onDragEnd={(_, info) => {
              setIsDragging(false);
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
            <img
              src={currentBanner.mediaUrl}
              alt={currentBanner.altText || currentBanner.name}
              className="w-full h-full object-cover select-none pointer-events-none"
              referrerPolicy="no-referrer"
            />
            {/* Dark gradient overlay only if title or target exists */}
            {(currentBanner.title || currentBanner.target) && (
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex flex-col justify-end p-4 sm:p-6 md:p-8 pointer-events-none">
                <div className="max-w-xl">
                  {currentBanner.title && (
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
                      {currentBanner.title}
                    </h2>
                  )}
                  {currentBanner.target && (
                    <a
                      href={currentBanner.target}
                      onClick={(e) => {
                        if (dragDistanceRef.current > 10) {
                          e.preventDefault();
                        }
                      }}
                      className="storefront-btn-primary inline-flex items-center gap-1.5 sm:gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl w-max shadow-lg shadow-brand-500/25 transition duration-300 pointer-events-auto"
                    >
                      Lihat Detail <ArrowRight className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Indicators / Dots - Clean, unobtrusive bottom positioning */}
      <div className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 bg-slate-950/50 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
        {banners.map((b, index) => {
          const isActive = index === safeIndex;
          return (
            <button
              key={b.id || index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(index);
              }}
              aria-label={`Pindah ke banner ${index + 1}`}
              aria-current={isActive ? "true" : undefined}
              className={`transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-400 rounded-full cursor-pointer ${
                isActive
                  ? "w-5 sm:w-6 h-1.5 sm:h-2 bg-brand-500 shadow-sm shadow-brand-500/50"
                  : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/40 hover:bg-white/75"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
