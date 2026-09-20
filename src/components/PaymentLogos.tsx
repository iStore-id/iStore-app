import React from 'react';

interface PaymentLogoItem {
  name: string;
  url: string;
  category?: string;
}

const localPaymentLogos: PaymentLogoItem[] = [
  // QR
  { name: 'QRIS', url: '/payment-logos/qris.svg', category: 'QR' },
  
  // E-Wallet
  { name: 'DANA', url: '/payment-logos/dana.svg', category: 'E-Wallet' },
  { name: 'GoPay', url: '/payment-logos/gopay.svg', category: 'E-Wallet' },
  { name: 'OVO', url: '/payment-logos/ovo.svg', category: 'E-Wallet' },
  { name: 'ShopeePay', url: '/payment-logos/shopee-pay.svg', category: 'E-Wallet' },
  { name: 'LinkAja', url: '/payment-logos/linkaja.svg', category: 'E-Wallet' },

  // Bank & VA
  { name: 'BCA', url: '/payment-logos/bca.svg', category: 'Bank' },
  { name: 'BNI', url: '/payment-logos/bni.svg', category: 'Bank' },
  { name: 'BRI', url: '/payment-logos/bri.svg', category: 'Bank' },
  { name: 'Mandiri', url: '/payment-logos/mandiri.svg', category: 'Bank' },
  { name: 'Permata', url: '/payment-logos/permata.svg', category: 'Bank' },
  { name: 'CIMB Niaga', url: '/payment-logos/cimb-niaga.svg', category: 'Bank' },
  { name: 'Danamon', url: '/payment-logos/danamon.svg', category: 'Bank' },
  { name: 'BSI', url: '/payment-logos/bsi.svg', category: 'Bank' },
  { name: 'SeaBank', url: '/payment-logos/seabank.svg', category: 'Bank' },
  { name: 'Bank Saqu', url: '/payment-logos/bank-saqu.svg', category: 'Bank' },
];

export const PaymentMethodLogos = () => {
  // Duplicated list for seamless infinite loop (Right to Left)
  const tickerItems = [...localPaymentLogos, ...localPaymentLogos];

  return (
    <div className="w-full overflow-hidden relative group">
      <style>{`
        @keyframes paymentTicker {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-payment-ticker {
          display: flex;
          width: max-content;
          animation: paymentTicker 26s linear infinite;
        }
        .animate-payment-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      <div className="animate-payment-ticker flex items-center gap-2.5 py-1">
        {tickerItems.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex-shrink-0 bg-white px-2.5 py-1.5 rounded-md flex items-center justify-center h-9 shadow-sm border border-slate-200/50 overflow-hidden select-none transition-transform hover:scale-105"
            title={item.name}
          >
            <img
              src={item.url}
              alt={`Logo ${item.name}`}
              className="h-6 w-auto object-contain pointer-events-none"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
