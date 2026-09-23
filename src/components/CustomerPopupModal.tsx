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
          let popups = data.data || [];
          if (allowedIds) {
            popups = popups.filter((p: PopupItem) => allowedIds.includes(p.id));
          }
          if (popups.length > 0) {
            const popup = popups[0];
            // Check session storage to see if this popup was already dismissed this session
            const dismissedId = sessionStorage.getItem(`istore_popup_dismissed_${popup.id}`);
            if (!dismissedId) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative flex flex-col">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>

        {activePopup.mediaUrl && (
          <div className="w-full max-h-64 bg-gray-100 flex items-center justify-center">
            <img src={activePopup.mediaUrl} alt={activePopup.title} className="max-w-full max-h-64 object-contain" referrerPolicy="no-referrer" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-gray-900">{activePopup.title}</h3>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{activePopup.content}</p>

          {activePopup.target && (
            <div className="pt-2">
              <a
                href={activePopup.target}
                onClick={handleClose}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-brand-700 text-white font-semibold rounded-xl transition shadow-sm"
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
