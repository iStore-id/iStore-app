import React, { useState, useEffect, useRef } from "react";
import { Zap, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface FlashSaleItem {
  id: string;
  name: string;
  salePrice: number;
  startAt: string;
  endAt: string;
  remainingQuota: number | null;
  totalQuota: number | null;
  variantId: string;
  productId: string;
  gameSlug: string;
  gameName: string;
  productName: string;
  variantName: string;
  image: string;
  normalPrice: number;
  discount?: number;
}

interface FlashSaleGridProps {
  allowedIds?: string[];
}

const FLASH_SALE_MARQUEE_SPEED = 120; // px/sec

export const FlashSaleGrid: React.FC<FlashSaleGridProps> = ({ allowedIds }) => {
  const [flashSales, setFlashSales] = useState<FlashSaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [setAWidth, setSetAWidth] = useState(0);
  const setARef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  
  // Motion & Drag State (Single Source of Truth)
  const positionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const wasDraggedRef = useRef(false);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const allowedIdsStr = allowedIds ? allowedIds.join(",") : "";

  useEffect(() => {
    const fetchFlashSales = async () => {
      try {
        const res = await fetch("/api/public/flash-sales");
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            let data = json.data || [];
            if (allowedIds) {
              data = data.filter((item: FlashSaleItem) => allowedIds.includes(item.id));
            }
            setFlashSales(data); 
          }
        }
      } catch (err) {
        console.error("Failed to fetch flash sales", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFlashSales();
  }, [allowedIdsStr]);

  // Geometry Tracking: Measure Set A width for speed calculation
  useEffect(() => {
    if (flashSales.length === 0 || !setARef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setSetAWidth(width);
        }
      }
    });

    observer.observe(setARef.current);
    
    const initialWidth = setARef.current.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setSetAWidth(initialWidth);
    }

    return () => observer.disconnect();
  }, [flashSales.length, loading]);

  // Unified Motion Engine (Auto + Drag)
  useEffect(() => {
    if (loading || flashSales.length === 0 || setAWidth <= 0) return;

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Auto-motion only if not dragging
      if (!isDraggingRef.current) {
        positionRef.current -= FLASH_SALE_MARQUEE_SPEED * deltaTime;
        
        // Loop logic: if we passed the end of Set A, wrap around
        if (positionRef.current <= -setAWidth) {
          positionRef.current += setAWidth;
        }
      }

      // Apply transform directly for highest performance
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = 0;
    };
  }, [loading, flashSales.length, setAWidth]);

  // Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = positionRef.current;
    
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - dragStartXRef.current;
    
    // Threshold to distinguish between tap and drag
    if (Math.abs(deltaX) > 4) {
      wasDraggedRef.current = true;
    }
    
    let newPos = dragStartPosRef.current + deltaX;
    
    // Normalize position during drag to maintain the "infinite" feel
    if (setAWidth > 0) {
      // Use modulo-like logic to keep within [ -setAWidth, 0 ]
      while (newPos <= -setAWidth) newPos += setAWidth;
      while (newPos > 0) newPos -= setAWidth;
    }
    
    positionRef.current = newPos;
    // Transform is updated in the next rAF frame
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (loading || flashSales.length === 0) {
    return null;
  }

  const sequenceItems = flashSales;

  return (
    <section className="w-full py-4 sm:py-5 lg:py-6 border-b border-slate-200/70 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-3 sm:mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brand-600 uppercase">
            <Zap className="w-4 h-4 text-brand-600 fill-brand-100" />
            <h2>Flash Sale Terbatas</h2>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
              Penawaran terbaru • Gerak otomatis
            </span>
          </div>
        </div>
      </div>

      <div 
        className="flash-sale-viewport relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_16px,black_calc(100%-16px),transparent_100%)] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_32px,black_calc(100%-32px),transparent_100%)] touch-pan-y select-none"
        aria-label="Flash sale conveyor marquee"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div 
          ref={trackRef}
          className="flash-sale-track flex flex-nowrap w-max py-1 will-change-transform cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate3d(${positionRef.current}px, 0, 0)`
          }}
        >
          {/* Set A: Primary Sequence */}
          <div 
            ref={setARef} 
            className="flex flex-nowrap gap-2.5 sm:gap-4 lg:gap-5 pr-2.5 sm:pr-4 lg:pr-5 shrink-0"
          >
            {sequenceItems.map((item, index) => (
              <FlashSaleCard 
                key={`primary-${item.id}-${index}`} 
                item={item} 
                index={index} 
                wasDraggedRef={wasDraggedRef}
              />
            ))}
          </div>

          {/* Set B: Identical Clone for Seamless Infinite Loop */}
          <div 
            className="flex flex-nowrap gap-2.5 sm:gap-4 lg:gap-5 pr-2.5 sm:pr-4 lg:pr-5 shrink-0" 
            aria-hidden="true"
          >
            {sequenceItems.map((item, index) => (
              <FlashSaleCard 
                key={`clone-${item.id}-${index}`} 
                item={item} 
                index={index} 
                isDuplicate={true} 
                wasDraggedRef={wasDraggedRef}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .flash-sale-track {
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </section>
  );
};



interface FlashSaleCardProps {
  item: FlashSaleItem;
  index: number;
  isDuplicate?: boolean;
  wasDraggedRef: React.RefObject<boolean>;
}

const FlashSaleCard: React.FC<FlashSaleCardProps> = ({ item, isDuplicate = false, wasDraggedRef }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!item.endAt) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(item.endAt).getTime();
      const distance = end - now;

      if (distance <= 0) {
        setIsExpired(true);
        return { hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) + Math.floor(distance / (1000 * 60 * 60 * 24)) * 24,
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft.hours === 0 && newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [item.endAt]);

  if (isExpired) return null;

  const displayName = item.variantName || item.productName || item.name;

  return (
    <Link 
      to={`/games/${item.gameSlug}`} 
      tabIndex={isDuplicate ? -1 : 0}
      aria-hidden={isDuplicate ? "true" : undefined}
      onClick={(e) => {
        if (wasDraggedRef.current) {
          e.preventDefault();
        }
      }}
      className="group flex flex-col w-[104px] sm:w-[132px] lg:w-[152px] shrink-0 aspect-[1/1.38] rounded-2xl overflow-hidden border shadow-2xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 sm:hover:-translate-y-1 active:scale-[0.98] cursor-pointer motion-reduce:transition-none motion-reduce:transform-none select-none"
      style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
    >
      {/* Zona 1: Clean Artwork Zone (~68%) */}
      <div 
        className="relative w-full h-[68%] overflow-hidden bg-slate-100 dark:bg-slate-800 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {item.image ? (
          <img 
            src={item.image} 
            alt={displayName}
            className="w-full h-full object-cover object-top transition-transform duration-500 will-change-transform group-hover:scale-[1.025] motion-reduce:transform-none"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
            <Zap className="w-8 h-8 opacity-25" />
          </div>
        )}

        {/* Refined Single Editorial Discount Accent Badge */}
        {item.discount && item.discount > 0 && (
          <div className="absolute top-1.5 left-1.5 z-10">
            <span className="inline-flex items-center px-1 py-0.5 sm:px-1.5 sm:py-0.5 lg:px-2 lg:py-0.5 rounded-md text-[9px] sm:text-[9.5px] lg:text-[10px] font-extrabold tracking-tight text-white shadow-xs transition-transform duration-250 ease-out group-hover:scale-105 motion-reduce:transform-none" style={{ backgroundColor: "var(--accent-color)" }}>
              -{item.discount}%
            </span>
          </div>
        )}

        {/* Countdown Overlay in the top-right of artwork */}
        {timeLeft && (
          <div className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-0.5 px-1 py-0.5 sm:px-1.5 sm:py-0.5 lg:px-2 lg:py-0.5 bg-slate-950/75 text-white backdrop-blur-[2px] border border-white/10 rounded-md font-mono text-[8px] sm:text-[8.5px] lg:text-[9px] leading-none shrink-0 tracking-tight">
            <Clock className="w-2.5 h-2.5 text-white/90 shrink-0" />
            <span>
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {/* Zona 2: Dedicated Editorial Plinth (~32%) */}
      <div className="w-full h-[32%] flex flex-col justify-between p-1.5 sm:p-2 bg-white transition-colors">
        {/* Product / Variant Name (line-clamp-2 for better text breathing room) */}
        <h3 className="font-semibold text-slate-800 text-[10px] sm:text-[11px] leading-tight line-clamp-2 tracking-tight group-hover:text-brand-600 transition-colors">
          {displayName}
        </h3>

        {/* Price Row: Primary Flash Sale Price + Line-through Original Price */}
        <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-black text-brand-600 leading-none tracking-tight">
            Rp {item.salePrice.toLocaleString("id-ID")}
          </span>
          {item.normalPrice > item.salePrice && (
            <span className="text-[9px] sm:text-[10px] text-slate-400 line-through leading-none tabular-nums">
              Rp {item.normalPrice.toLocaleString("id-ID")}
            </span>
          )}
        </div>

        {/* Subtle Metadata Row: Remaining Quota (Subtle & Non-Obtrusive, at the bottom) */}
        {item.remainingQuota !== null && item.remainingQuota !== undefined && (
          <div className="text-[8px] sm:text-[9px] text-slate-500 leading-none pt-0.5">
            <span className="truncate font-semibold text-slate-500">Sisa {item.remainingQuota}</span>
          </div>
        )}
      </div>
    </Link>
  );
};
