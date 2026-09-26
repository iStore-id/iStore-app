import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";

export interface HeroBanner {
  id: string;
  name: string;
  mediaUrl: string;
  mediaWidth?: number;
  mediaHeight?: number;
  displayMode?: 'fit' | 'fill';
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

// Helper to identify transparent image formats (SVG vectors only)
function isTransparentFormat(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes(".svg") ||
    lower.includes("format=svg") ||
    lower.includes("f_svg")
  );
}

const globalAspectCache: Record<string, number> = {};

export default function HeroBannerCarousel({ banners }: HeroBannerCarouselProps) {
  if (!banners || banners.length === 0) {
    return null;
  }

  // Dynamic aspect ratio map with module-level cache and media_library width/height priority
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    banners.forEach((b) => {
      const key = b.id || b.mediaUrl;
      if (typeof b.mediaWidth === 'number' && b.mediaWidth > 0 && typeof b.mediaHeight === 'number' && b.mediaHeight > 0) {
        initial[key] = b.mediaWidth / b.mediaHeight;
      } else if (globalAspectCache[key]) {
        initial[key] = globalAspectCache[key];
      }
    });
    return initial;
  });

  const getBannerRatio = (b: HeroBanner) => {
    const key = b.id || b.mediaUrl;
    if (typeof b.mediaWidth === 'number' && b.mediaWidth > 0 && typeof b.mediaHeight === 'number' && b.mediaHeight > 0) {
      return b.mediaWidth / b.mediaHeight;
    }
    if (globalAspectCache[key]) {
      return globalAspectCache[key];
    }
    if (aspectRatios[key]) {
      return aspectRatios[key];
    }
    return undefined;
  };

  const handleImageLoad = (key: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight && naturalHeight > 0) {
      const ratio = naturalWidth / naturalHeight;
      globalAspectCache[key] = ratio;
      setAspectRatios((prev) => {
        if (prev[key] === ratio) return prev;
        return { ...prev, [key]: ratio };
      });
    }
  };

  // Pre-fetch intrinsic dimensions for all banner images
  useEffect(() => {
    if (!banners || banners.length === 0) return;
    banners.forEach((banner) => {
      const key = banner.id || banner.mediaUrl;
      if (!key || !banner.mediaUrl || globalAspectCache[key]) return;
      const img = new Image();
      img.src = banner.mediaUrl;
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight && img.naturalHeight > 0) {
          const ratio = img.naturalWidth / img.naturalHeight;
          globalAspectCache[key] = ratio;
          setAspectRatios((prev) => {
            if (prev[key] === ratio) return prev;
            return { ...prev, [key]: ratio };
          });
        }
      };
    });
  }, [banners]);

  // JIKA HANYA 1 BANNER: Tampilkan statis tanpa controls, dots, atau auto-slide
  if (banners.length === 1) {
    const banner = banners[0];
    const activeRatio = getBannerRatio(banner);
    const isTransparent = isTransparentFormat(banner.mediaUrl);

    return (
      <div
        className="relative w-full overflow-hidden bg-slate-100 [.public-storefront[data-theme='dark']_&]:bg-slate-950 group transition-[aspect-ratio] duration-500 ease-out"
        style={activeRatio ? { aspectRatio: `${activeRatio}` } : { aspectRatio: "2.5 / 1" }}
      >
        {/* Conditional Background Layer */}
        {isTransparent ? (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/90 [.public-storefront[data-theme='dark']_&]:from-slate-900 [.public-storefront[data-theme='dark']_&]:via-slate-900 [.public-storefront[data-theme='dark']_&]:to-slate-950 pointer-events-none transition-colors duration-300" />
        ) : (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={banner.mediaUrl}
              alt=""
              className="w-full h-full object-cover blur-2xl opacity-35 [.public-storefront[data-theme='dark']_&]:opacity-40 scale-110 select-none pointer-events-none"
              aria-hidden="true"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-900/10 [.public-storefront[data-theme='dark']_&]:bg-slate-950/20" />
          </div>
        )}

        {/* Main Banner Image - Crisp, Uncropped & Original Aspect Ratio */}
        <img
          src={banner.mediaUrl}
          alt={banner.altText || banner.name}
          onLoad={(e) => handleImageLoad(key, e)}
          className={`w-full h-full ${banner.displayMode === 'fill' ? 'object-cover' : 'object-contain'} relative z-10 group-hover:scale-[1.01] transition-transform duration-700 select-none pointer-events-none`}
          referrerPolicy="no-referrer"
        />

        {(banner.title || banner.target) && (
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent [.public-storefront[data-theme='dark']_&]:from-slate-950/85 [.public-storefront[data-theme='dark']_&]:via-slate-950/25 flex flex-col justify-end p-4 sm:p-6 md:p-8 pointer-events-none">
            {banner.title && (
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
                {banner.title}
              </h2>
            )}
            {banner.target && (
              <a
                href={banner.target}
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl w-max shadow-lg shadow-brand-500/25 transition duration-300 pointer-events-auto"
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
  const activeRatio = getBannerRatio(currentBanner);
  const isTransparent = isTransparentFormat(currentBanner.mediaUrl);

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
      className="relative w-full overflow-hidden bg-slate-100 [.public-storefront[data-theme='dark']_&]:bg-slate-950 group focus:outline-none select-none transition-[aspect-ratio] duration-500 ease-out"
      style={activeRatio ? { aspectRatio: `${activeRatio}` } : { aspectRatio: "2.5 / 1" }}
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
            {/* Conditional Background Layer */}
            {isTransparent ? (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/90 [.public-storefront[data-theme='dark']_&]:from-slate-900 [.public-storefront[data-theme='dark']_&]:via-slate-900 [.public-storefront[data-theme='dark']_&]:to-slate-950 pointer-events-none transition-colors duration-300" />
            ) : (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  src={currentBanner.mediaUrl}
                  alt=""
                  className="w-full h-full object-cover blur-2xl opacity-35 [.public-storefront[data-theme='dark']_&]:opacity-40 scale-110 select-none pointer-events-none"
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-900/10 [.public-storefront[data-theme='dark']_&]:bg-slate-950/20" />
              </div>
            )}

            {/* Main Banner Image - Crisp, Uncropped (FIT) or Edge-to-Edge (FILL) */}
            <img
              src={currentBanner.mediaUrl}
              alt={currentBanner.altText || currentBanner.name}
              onLoad={(e) => handleImageLoad(activeKey, e)}
              className={`w-full h-full ${currentBanner.displayMode === 'fill' ? 'object-cover' : 'object-contain'} relative z-10 select-none pointer-events-none`}
              referrerPolicy="no-referrer"
            />

            {/* Overlay only if title or target exists */}
            {(currentBanner.title || currentBanner.target) && (
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent [.public-storefront[data-theme='dark']_&]:from-slate-950/85 [.public-storefront[data-theme='dark']_&]:via-slate-950/25 flex flex-col justify-end p-4 sm:p-6 md:p-8 pointer-events-none">
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
      <div className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/40 [.public-storefront[data-theme='dark']_&]:bg-slate-950/60 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-slate-700/30 [.public-storefront[data-theme='dark']_&]:border-white/10 shadow-lg pointer-events-auto">
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
                  : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-slate-400/60 [.public-storefront[data-theme='dark']_&]:bg-white/40 hover:bg-slate-700 [.public-storefront[data-theme='dark']_&]:hover:bg-white/75"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
