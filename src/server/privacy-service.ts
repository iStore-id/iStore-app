import { supabaseAdmin } from "./supabase-admin.js";
import { PrivacySettings, PublicPrivacySettings } from "../types/privacy.js";
import { logCoreAudit } from "./core-service.js";

const PRIVACY_DOC_PATH = "privacySettings/global";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  id: "global",
  privacyPolicy: {
    title: "Kebijakan Privasi iStore.id",
    content: `## 1. Pendahuluan
Selamat datang di iStore.id. Kami menghargai dan berkomitmen untuk melindungi privasi serta keamanan data pribadi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi informasi pribadi yang Anda berikan saat menggunakan layanan top-up game dan voucher digital kami.

## 2. Informasi yang Kami Kumpulkan
Kami hanya mengumpulkan informasi yang diperlukan untuk memproses transaksi Anda secara aman dan cepat:
- **Informasi Transaksi**: User ID game, Zone ID/Server ID, email, nomor WhatsApp untuk notifikasi resi.
- **Informasi Pembayaran**: Metode pembayaran yang dipilih, status transaksi dari Payment Gateway resmi (kami tidak pernah menyimpan nomor kartu kredit atau PIN).
- **Informasi Perangkat & Akses**: Alamat IP, jenis browser, dan log akses untuk pencegahan penipuan (*fraud prevention*).

## 3. Penggunaan Informasi
Informasi yang dikumpulkan digunakan untuk:
- Memproses dan memvalidasi pesanan top-up game Anda ke server provider resmi.
- Mengirimkan bukti transaksi, notifikasi status pembayaran, dan resi secara otomatis.
- Menyediakan bantuan customer service dan menangani kendala transaksi atau refund.
- Mencegah aktivitas ilegal, transaksi mencurigakan, dan manipulasi sistem.

## 4. Perlindungan & Keamanan Data
- Seluruh komunikasi data dilindungi dengan enkripsi SSL/TLS 256-bit standar industri.
- Kami menerapkan kontrol akses ketat berbasis peran (Role-Based Access Control) sehingga hanya staf operasional berwenang yang dapat mengakses data terkait pesanan Anda.
- Kami tidak pernah menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan pemasaran tanpa izin Anda.

## 5. Hak Pelanggan
Anda berhak untuk:
- Mengakses dan memeriksa riwayat transaksi Anda kapan saja melalui halaman Cek Transaksi.
- Mengajukan permohonan pembaruan data kontak atau penghapusan data akun melalui Customer Support kami.
- Menolak pelacakan non-esensial melalui pengaturan consent cookie di peramban Anda.

## 6. Kontak Perlindungan Data
Jika Anda memiliki pertanyaan mengenai kebijakan privasi atau perlakuan data Anda, silakan hubungi Tim Perlindungan Data kami melalui email resmi yang tertera pada platform ini.`,
    lastUpdated: new Date().toISOString(),
    version: "1.0.0"
  },
  termsOfService: {
    title: "Syarat & Ketentuan Layanan iStore.id",
    content: `## 1. Ketentuan Umum
Dengan mengakses atau menggunakan platform iStore.id, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan yang berlaku. Jika Anda tidak menyetujui salah satu poin ketentuan, mohon untuk tidak melanjutkan penggunaan layanan ini.

## 2. Layanan Top-Up & Pembelian Voucher
- iStore.id bertindak sebagai penyedia platform perantara resmi untuk pembelian mata uang game dan voucher digital dari penyedia layanan terdaftar.
- Pengguna bertanggung jawab penuh atas keakuratan User ID, Server ID, atau data akun game yang dimasukkan saat checkout. Kesalahan input data dari pihak pengguna tidak dapat dibatalkan atau direfund setelah voucher berhasil terkirim.

## 3. Pembayaran & Konfirmasi
- Pembayaran wajib dilakukan sesuai nominal tagihan yang tertera termasuk kode unik (jika ada) dan dalam batas waktu pembayaran yang ditentukan.
- Pembayaran yang terverifikasi otomatis oleh payment gateway akan langsung diproses oleh sistem ke antrean pemenuhan pesanan secara kilat.

## 4. Kebijakan Refund & Komplain
- Refund hanya dapat diajukan jika terjadi kegagalan sistem pada provider yang mengakibatkan item tidak terkirim dalam batas SLA resmi dan pembayaran telah berhasil dipotong.
- Komplain kendala transaksi wajib menyertakan nomor Invoice resmi iStore.id dan bukti pembayaran yang valid maksimal 1x24 jam sejak transaksi dilakukan.

## 5. Perubahan Ketentuan
iStore.id berhak sewaktu-waktu memperbarui Syarat & Ketentuan ini untuk menyesuaikan regulasi dan peningkatan keamanan operasional. Perubahan akan berlaku seketika sejak diumumkan pada halaman ini.`,
    lastUpdated: new Date().toISOString(),
    version: "1.0.0"
  },
  dpoContact: {
    name: "Data Protection Officer",
    email: "privacy@istore.co.id",
    phone: "",
    address: ""
  },
  cookieConsent: {
    enabled: true,
    title: "Pemberitahuan Cookie & Privasi",
    message: "Kami menggunakan cookie untuk memastikan keamanan transaksi, mengingat preferensi Anda, dan mengoptimalkan kecepatan pengalaman belanja Anda.",
    allowDecline: true
  },
  dataRetention: {
    retentionMonths: 24,
    allowCustomerDataExport: true,
    allowCustomerAccountDeletion: true,
    anonymizeDeletedOrders: true,
    retentionNote: "Data transaksi finansial disimpan minimal sesuai regulasi akuntansi dan audit, kemudian dianonimkan setelah periode retensi."
  },
  updatedAt: new Date().toISOString(),
  updatedBy: "system"
};

// In-memory cache
let cachedPrivacySettings: PrivacySettings | null = null;
let lastCacheTime = 0;

export async function getPrivacySettings(): Promise<PrivacySettings> {
  const now = Date.now();
  if (cachedPrivacySettings && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedPrivacySettings;
  }

  try {
    const docRef = supabaseAdmin!.from('privacy').select('*').eq('id', 'singleton');
    const { data: snapData, error: snapError } = await docRef.maybeSingle();

    if (!snapData) {
      // Seed default
      await supabaseAdmin!.from('privacy').upsert({ ...DEFAULT_PRIVACY_SETTINGS, id: 'singleton' });
      cachedPrivacySettings = { ...DEFAULT_PRIVACY_SETTINGS };
      lastCacheTime = now;
      return cachedPrivacySettings;
    }

    const data = snapData as Partial<PrivacySettings>;
    const merged: PrivacySettings = {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...data,
      privacyPolicy: {
        ...DEFAULT_PRIVACY_SETTINGS.privacyPolicy,
        ...(data.privacyPolicy || {})
      },
      termsOfService: {
        ...DEFAULT_PRIVACY_SETTINGS.termsOfService,
        ...(data.termsOfService || {})
      },
      dpoContact: {
        ...DEFAULT_PRIVACY_SETTINGS.dpoContact,
        ...(data.dpoContact || {})
      },
      cookieConsent: {
        ...DEFAULT_PRIVACY_SETTINGS.cookieConsent,
        ...(data.cookieConsent || {})
      },
      dataRetention: {
        ...DEFAULT_PRIVACY_SETTINGS.dataRetention,
        ...(data.dataRetention || {})
      }
    };

    cachedPrivacySettings = merged;
    lastCacheTime = now;
    return merged;
  } catch (error) {
    console.error("[PrivacyService] Failed to get privacy settings:", error);
    if (cachedPrivacySettings) return cachedPrivacySettings;
    return DEFAULT_PRIVACY_SETTINGS;
  }
}

export function getPublicPrivacySettings(settings: PrivacySettings): PublicPrivacySettings {
  const sanitizeBrand = (text: string) => {
    if (!text) return "";
    return text
      .replace(/di Platform\./g, "di iStore.id.")
      .replace(/platform Platform/g, "platform iStore.id")
      .replace(/resmi Platform/g, "resmi iStore.id")
      .replace(/Platform bertindak/g, "iStore.id bertindak")
      .replace(/Platform berhak/g, "iStore.id berhak")
      .replace(/Layanan Platform/g, "Layanan iStore.id")
      .replace(/Privasi Platform/g, "Privasi iStore.id");
  };

  return {
    privacyPolicy: {
      ...settings.privacyPolicy,
      title: sanitizeBrand(settings.privacyPolicy.title),
      content: sanitizeBrand(settings.privacyPolicy.content)
    },
    termsOfService: {
      ...settings.termsOfService,
      title: sanitizeBrand(settings.termsOfService.title),
      content: sanitizeBrand(settings.termsOfService.content)
    },
    dpoContact: {
      name: settings.dpoContact.name,
      email: settings.dpoContact.email,
      phone: settings.dpoContact.phone,
      address: settings.dpoContact.address
    },
    cookieConsent: settings.cookieConsent,
    dataRetention: {
      retentionMonths: settings.dataRetention.retentionMonths,
      allowCustomerDataExport: settings.dataRetention.allowCustomerDataExport,
      allowCustomerAccountDeletion: settings.dataRetention.allowCustomerAccountDeletion,
      anonymizeDeletedOrders: settings.dataRetention.anonymizeDeletedOrders,
      retentionNote: settings.dataRetention.retentionNote
    }
  };
}

export async function updatePrivacySettings(
  actor: { uid: string; email: string },
  role: string,
  updates: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  const current = await getPrivacySettings();

  const merged: PrivacySettings = {
    ...current,
    ...updates,
    privacyPolicy: {
      ...current.privacyPolicy,
      ...(updates.privacyPolicy || {})
    },
    termsOfService: {
      ...current.termsOfService,
      ...(updates.termsOfService || {})
    },
    dpoContact: {
      ...current.dpoContact,
      ...(updates.dpoContact || {})
    },
    cookieConsent: {
      ...current.cookieConsent,
      ...(updates.cookieConsent || {})
    },
    dataRetention: {
      ...current.dataRetention,
      ...(updates.dataRetention || {})
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email
  };

  // If privacy policy or TOS content was edited, bump lastUpdated timestamp
  if (updates.privacyPolicy && updates.privacyPolicy.content !== current.privacyPolicy.content) {
    merged.privacyPolicy.lastUpdated = new Date().toISOString();
  }
  if (updates.termsOfService && updates.termsOfService.content !== current.termsOfService.content) {
    merged.termsOfService.lastUpdated = new Date().toISOString();
  }

  const docRef = supabaseAdmin!.from('privacy').select('*').eq('id', 'singleton');
  await supabaseAdmin!.from('privacy').upsert({ ...merged, id: 'singleton' });

  // Update in-memory cache
  cachedPrivacySettings = merged;
  lastCacheTime = Date.now();

  // Audit log
  await logCoreAudit(
    actor,
    role,
    "UPDATE_PRIVACY_SETTINGS",
    PRIVACY_DOC_PATH,
    current,
    merged,
    "Pembaruan Pengaturan Privasi & Kebijakan Legal"
  );

  return merged;
}

export async function resetPrivacySettings(
  actor: { uid: string; email: string },
  role: string
): Promise<PrivacySettings> {
  const current = await getPrivacySettings();
  const resetData: PrivacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email
  };

  const docRef = supabaseAdmin!.from('privacy').select('*').eq('id', 'singleton');
  await supabaseAdmin!.from('privacy').upsert({ ...resetData, id: 'singleton' });

  cachedPrivacySettings = resetData;
  lastCacheTime = Date.now();

  await logCoreAudit(
    actor,
    role,
    "RESET_PRIVACY_SETTINGS",
    PRIVACY_DOC_PATH,
    current,
    resetData,
    "Reset Pengaturan Privasi ke Nilai Standar Pabrik"
  );

  return resetData;
}
