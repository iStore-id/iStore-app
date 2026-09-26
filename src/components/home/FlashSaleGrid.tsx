import React, { useState, useEffect } from "react";
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

export const FlashSaleGrid: React.FC<FlashSaleGridProps> = ({ allowedIds }) => {
  const [flashSales, setFlashSales] = useState<FlashSaleItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            setFlashSales(data.slice(0, 3)); // Max 3 items
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

  if (loading || flashSales.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-4 sm:py-5 lg:py-6 px-4 border-b border-slate-200/70 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brand-600 uppercase">
            <Zap className="w-4 h-4 text-brand-600 fill-brand-100" />
            <h2>Flash Sale Terbatas</h2>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5">
          {flashSales.map((item, index) => (
            <FlashSaleCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

const FlashSaleCard: React.FC<{ item: FlashSaleItem; index: number }> = ({ item, index }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const entranceTimer = setTimeout(() => setIsVisible(true), index * 80);
    return () => clearTimeout(entranceTimer);
  }, [index]);

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

  return (
    <div className={`transition-all duration-700 ease-out transform-gpu ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
      <Link to={`/games/${item.gameSlug}`} className="block group">
        <div 
          className="relative aspect-[1/1.15] overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/80 transition-all duration-300 ease-out hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 hover:-translate-y-1 active:scale-[0.98]"
          style={{ backgroundColor: 'var(--surface-color)' }}
        >
          {/* Main Visual / Logo Section (Full Bleed) */}
          <div className="absolute inset-0">
            {item.image ? (
              <img 
                src={item.image} 
                alt={item.gameName}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-700">
                <Zap className="w-8 h-8 opacity-20" />
              </div>
            )}
          </div>

          {/* Gradient Overlay for Legibility (Bottom-up) */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />

          {/* Discount Badge Overlay (Zero-Pill Minimalist look) */}
          {item.discount && item.discount > 0 && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <span className="inline-flex items-center bg-red-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider">
                -{item.discount}%
              </span>
            </div>
          )}

          {/* Pricing & Progress Overlay (At the bottom) */}
          <div className="absolute inset-x-0 bottom-0 p-3 z-20">
            <div className="flex items-baseline gap-1.5 flex-wrap mb-1.5">
              <span className="text-sm sm:text-base font-extrabold text-white leading-none tracking-tight font-mono tabular-nums">
                Rp {item.salePrice.toLocaleString("id-ID")}
              </span>
              {item.normalPrice > item.salePrice && (
                <span className="text-[10px] text-white/50 line-through leading-none font-mono tabular-nums">
                  Rp {item.normalPrice.toLocaleString("id-ID")}
                </span>
              )}
            </div>
            
            {item.totalQuota && item.remainingQuota !== null && item.remainingQuota !== undefined && (
              <div className="w-full bg-white/20 rounded-full h-[2px] overflow-hidden">
                <div 
                  className="bg-red-500 h-full transition-all duration-1000" 
                  style={{ width: `${Math.max(5, (item.remainingQuota / item.totalQuota) * 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* Subtle Hover Countdown */}
          {timeLeft && (
            <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
              <Clock className="w-3 h-3 text-yellow-400" />
              <span className="font-mono tabular-nums">
                {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}:
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};
