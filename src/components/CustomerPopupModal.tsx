import React, { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

interface PopupItem {
  id: string;
  name: string;
  title: string;
  content: string;
  mediaUrl?: string;
  placement: string;
  trigger: string;
  target?: string;
}

export default function CustomerPopupModal({ 
  placement = 'homepage',
  allowedIds 
}: { 
  placement?: string;
  allowedIds?: string[];
}) {
  const [activePopup, setActivePopup] = useState<PopupItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const allowedIdsStr = allowedIds ? allowedIds.join(",") : "";

  useEffect(() => {
    async function fetchPopups() {
      try {
        const res = await fetch(`/api/public/popups?placement=${placement}`);
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          const popups: PopupItem[] = data.data || [];
          // Campaign-linked popups get first priority, but campaign linking is optional:
          // unlinked popups remain eligible as a fallback.
          const orderedPopups = allowedIds
            ? [
                ...popups.filter((p: PopupItem) => allowedIds.includes(p.id)),
                ...popups.filter((p: PopupItem) => !allowedIds.includes(p.id))
              ]
            : popups;
          const popup = orderedPopups.find(
            (p: PopupItem) => !sessionStorage.getItem(`istore_popup_dismissed_${p.id}`)
          );

          if (popup) {
            setActivePopup(popup);

            // Handle trigger
            if (popup.trigger === 'delay_3s') {
              setTimeout(() => setIsOpen(true), 3000);
            } else if (popup.trigger === 'immediate') {
              setIsOpen(true);
            } else if (popup.trigger === 'exit_intent') {
              const handleMouseLeave = (e: MouseEvent) => {
                if (e.clientY <= 0) {
                  setIsOpen(true);
                  document.removeEventListener('mouseleave', handleMouseLeave);
                }
              };
              document.addEventListener('mouseleave', handleMouseLeave);
            }
          } else {
            setActivePopup(null);
            setIsOpen(false);
          }
        } else {
          setActivePopup(null);
          setIsOpen(false);
        }
      } catch (e) {
        console.error("Error fetching popups:", e);
      }
    }
    fetchPopups();
  }, [placement, allowedIdsStr]);

  const handleClose = () => {
    if (activePopup) {
      sessionStorage.setItem(`istore_popup_dismissed_${activePopup.id}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !activePopup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 sm:p-5 animate-fade-in">
      <div className="relative flex max-h-[90dvh] w-fit max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-[calc(100vw-2.5rem)]">
        <button
          onClick={handleClose}
          aria-label="Tutup popup"
          className="absolute right-3 top-3 z-10 rounded-full bg-slate-950/65 p-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-950/85 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X className="w-4 h-4" />
        </button>

        {activePopup.mediaUrl && (
          <div className="flex w-full min-w-0 items-center justify-center bg-white p-0">
            <img src={activePopup.mediaUrl} alt={activePopup.title} className="block h-auto w-auto max-w-full max-h-[70dvh] object-contain" referrerPolicy="no-referrer" />
          </div>
        )}

        <div className="space-y-3 p-4 sm:p-5">
          <h3 className="pr-9 text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">{activePopup.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base">{activePopup.content}</p>

          {activePopup.target && (
            <div className="pt-1">
              <a
                href={activePopup.target}
                onClick={handleClose}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 sm:text-base"
              >
                Lihat Selengkapnya <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
