import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

let snapLoadingPromise: Promise<boolean> | null = null;

export async function loadMidtransSnap(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.snap) return true;

  const existingScript = document.getElementById("midtrans-snap-script") as HTMLScriptElement | null;
  if (existingScript) {
    if (window.snap) return true;
    return new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(!!window.snap), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(!!window.snap), 3000);
    });
  }

  if (snapLoadingPromise) {
    return snapLoadingPromise;
  }

  snapLoadingPromise = (async () => {
    try {
      let clientKey = (import.meta as any).env?.VITE_MIDTRANS_CLIENT_KEY || "";
      let isProduction = (import.meta as any).env?.VITE_MIDTRANS_IS_PRODUCTION === "true";

      if (!clientKey) {
        const response = await fetch("/api/public/config/midtrans");
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.data?.clientKey) {
            clientKey = resData.data.clientKey;
            isProduction = Boolean(resData.data.isProduction);
          }
        }
      }

      if (!clientKey) {
        console.warn("[Midtrans] Client Key tidak ditemukan di environment maupun server config.");
        return false;
      }

      const scriptUrl = isProduction
        ? "https://app.midtrans.com/snap/snap.js"
        : "https://app.sandbox.midtrans.com/snap/snap.js";

      return await new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.id = "midtrans-snap-script";
        script.src = scriptUrl;
        script.setAttribute("data-client-key", clientKey);
        script.async = true;
        script.onload = () => {
          resolve(!!window.snap);
        };
        script.onerror = (err) => {
          console.error("[Midtrans] Gagal memuat script Snap SDK:", err);
          resolve(false);
        };
        document.head.appendChild(script);
      });
    } catch (err) {
      console.error("[Midtrans] Error inisialisasi Snap SDK:", err);
      return false;
    }
  })();

  return snapLoadingPromise;
}

let storeConfigPromise: Promise<any> | null = null;
let storeConfigCache: any = null;

export async function fetchStoreConfig(): Promise<any> {
  if (storeConfigCache) return storeConfigCache;
  if (storeConfigPromise) return storeConfigPromise;

  storeConfigPromise = (async () => {
    try {
      const res = await fetch("/api/public/store-config");
      const data = await res.json();
      if (data.success && data.data) {
        storeConfigCache = data.data;
        return storeConfigCache;
      }
    } catch (err) {
      console.error("Gagal mengambil store config:", err);
    }
    return null;
  })();

  return storeConfigPromise;
}

