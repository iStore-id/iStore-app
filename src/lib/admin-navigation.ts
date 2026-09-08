import { 
  LayoutDashboard, 
  Bell, 
  Activity, 
  ShieldAlert,
  Package, 
  Gamepad2, 
  ShoppingCart, 
  TicketPercent, 
  Zap, 
  Heart, 
  Star,
  BookOpen,
  CreditCard, 
  RotateCcw, 
  Receipt, 
  Scale, 
  Banknote, 
  Percent, 
  Users, 
  UserPlus, 
  Contact, 
  Headset, 
  Ticket,
  Truck, 
  Wallet, 
  Database, 
  FileJson, 
  Clock, 
  Calendar,
  Megaphone, 
  Image as ImageIcon, 
  MousePointer2, 
  Layout, 
  FileText, 
  HelpCircle, 
  Library, 
  Search,
  ShieldCheck, 
  Lock, 
  History, 
  Terminal, 
  Flag, 
  Settings as SettingsIcon, 
  Link as LinkIcon, 
  Save,
  Store, 
  Palette, 
  Globe, 
  Mail, 
  MessageSquare, 
  Languages
} from "lucide-react";
import { NavGroup } from "../types/admin-nav";

export const ADMIN_NAVIGATION: NavGroup[] = [
  {
    title: "UTAMA",
    items: [
      { 
        title: "Dashboard", 
        href: "/admin", 
        icon: LayoutDashboard, 
        resource: "dashboard", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Notifikasi", 
        href: "/admin/notifications", 
        icon: Bell, 
        resource: "notifications", 
        action: "view",
        status: "ACTIVE",
        description: "Pusat notifikasi sistem, alert stok, dan pesan pelanggan.",
        dependencies: ["Firebase Cloud Messaging", "Notification Engine"]
      },
      { 
        title: "System Health", 
        href: "/admin/health", 
        icon: Activity, 
        resource: "system", 
        action: "view",
        status: "ACTIVE" 
      },
      { 
        title: "Incident Management", 
        href: "/admin/incidents", 
        icon: ShieldAlert, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Pemantauan insiden API, kegagalan transaksi, dan error log real-time.",
        dependencies: ["Logging Service", "Alert Engine"]
      },
    ]
  },
  {
    title: "COMMERCE",
    items: [
      { 
        title: "Produk", 
        href: "/admin/products", 
        icon: Package, 
        resource: "products", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Game & Kategori", 
        href: "/admin/games", 
        icon: Gamepad2, 
        resource: "games", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen katalog game, kategori, dan pemetaan region.",
        dependencies: ["Catalog Engine"]
      },
      { 
        title: "Pesanan", 
        href: "/admin/orders", 
        icon: ShoppingCart, 
        resource: "orders", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Promo & Voucher", 
        href: "/admin/promos", 
        icon: TicketPercent, 
        resource: "promos", 
        action: "view",
        status: "ACTIVE",
        description: "Pembuatan kupon diskon, voucher otomatis, dan campaign promo.",
        dependencies: ["Pricing Engine", "Promo Logic"]
      },
      { 
        title: "Flash Sale", 
        href: "/admin/flash-sale", 
        icon: Zap, 
        resource: "flash_sale", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan jadwal flash sale terbatas dengan kuota khusus.",
        dependencies: ["Event Scheduler", "Stock Locking"]
      },
      { 
        title: "Poin & Loyalty", 
        href: "/admin/loyalty", 
        icon: Heart, 
        resource: "loyalty", 
        action: "view",
        status: "ACTIVE",
        description: "Sistem reward poin per transaksi dan level loyalitas pengguna.",
        dependencies: ["User Ledger", "Loyalty Rules"]
      },
      { 
        title: "Reward", 
        href: "/admin/rewards", 
        icon: Star, 
        resource: "loyalty", 
        action: "view",
        status: "ACTIVE",
        description: "Penukaran poin dengan item fisik atau voucher digital.",
        dependencies: ["Inventory", "Redemption Logic"]
      },
      { 
        title: "Wishlist & Review", 
        href: "/admin/reviews", 
        icon: BookOpen, 
        resource: "reviews", 
        action: "view",
        status: "ACTIVE",
        description: "Moderasi ulasan pelanggan dan analisis wishlist populer.",
        dependencies: ["Review Service", "Notification Engine"]
      },
    ]
  },
  {
    title: "FINANCE",
    items: [
      { 
        title: "Pembayaran", 
        href: "/admin/payments", 
        icon: CreditCard, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Log transaksi pembayaran dari berbagai gateway.",
        dependencies: ["Payment Gateway", "Midtrans SDK"]
      },
      { 
        title: "Refund", 
        href: "/admin/refunds", 
        icon: RotateCcw, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Proses pengembalian dana dan pembatalan pesanan otomatis.",
        dependencies: ["Finance API", "Bank Transfer"]
      },
      { 
        title: "Fee & Pajak", 
        href: "/admin/taxes", 
        icon: Receipt, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan biaya layanan dan perhitungan pajak per transaksi.",
        dependencies: ["Accounting Module"]
      },
      { 
        title: "Rekonsiliasi", 
        href: "/admin/reconciliation", 
        icon: Scale, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Pencocokan data transaksi antara iStore dan Payment Gateway.",
        dependencies: ["Finance API", "Settlement Engine"]
      },
      { 
        title: "Settlement", 
        href: "/admin/settlement", 
        icon: Banknote, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Pencairan dana dari gateway ke rekening perusahaan.",
        dependencies: ["Bank API", "Settlement Engine"]
      },
      { 
        title: "Commission", 
        href: "/admin/commission", 
        icon: Percent, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Perhitungan komisi mitra dan afiliasi.",
        dependencies: ["Partner API"]
      },
      { 
        title: "Ledger", 
        href: "/admin/ledger", 
        icon: BookOpen, 
        resource: "finance", 
        action: "view",
        status: "ACTIVE",
        description: "Buku besar keuangan seluruh ekosistem iStore.",
        dependencies: ["Accounting Module"]
      },
    ]
  },
  {
    title: "CUSTOMER",
    items: [
      { 
        title: "Pengguna", 
        href: "/admin/users", 
        icon: Users, 
        resource: "users", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Customer Segments", 
        href: "/admin/customer-segments", 
        icon: Users, 
        resource: "users", 
        action: "view",
        status: "ACTIVE",
        description: "Segmentasi pelanggan otomatis dan dinamis berdasarkan profil, transaksi, loyalitas, dan label.",
        dependencies: ["Customer Service", "Loyalty Engine", "Commerce Aggregator"]
      },
      { 
        title: "Referral", 
        href: "/admin/referral", 
        icon: UserPlus, 
        resource: "users", 
        action: "view",
        status: "ACTIVE",
        description: "Program ajak teman dengan sistem reward saldo/poin.",
        dependencies: ["User Ledger", "Referral Logic"]
      },
      { 
        title: "Membership", 
        href: "/admin/membership", 
        icon: Contact, 
        resource: "users", 
        action: "view",
        status: "ACTIVE",
        description: "Program keanggotaan VIP dengan harga khusus.",
        dependencies: ["Pricing Engine", "Tier Logic"]
      },
      { 
        title: "Support / CS", 
        href: "/admin/support", 
        icon: Headset, 
        resource: "support", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen chat bantuan dan bantuan pelanggan.",
        dependencies: ["Support Service", "CS Dashboard"]
      },
      { 
        title: "Tickets", 
        href: "/admin/support", // Point to the same page
        icon: Ticket, 
        resource: "support", 
        action: "view",
        status: "ACTIVE",
        description: "Sistem pelaporan kendala melalui tiket bantuan.",
        dependencies: ["Ticketing Service"]
      },
    ]
  },
  {
    title: "OPERASIONAL",
    items: [
      { 
        title: "Provider", 
        href: "/admin/providers", 
        icon: Truck, 
        resource: "providers", 
        action: "view",
        status: "ACTIVE",
        description: "Koneksi ke API supplier produk digital.",
        dependencies: ["Provider Engine", "API Gateway"]
      },
      { 
        title: "Payment Gateway", 
        href: "/admin/gateways", 
        icon: Wallet, 
        resource: "gateway", 
        action: "view",
        status: "ACTIVE",
        description: "Konfigurasi Midtrans, Xendit, dan gateway lainnya.",
        dependencies: ["Payment API", "Secret Management"]
      },
      { 
        title: "Stock & Quota", 
        href: "/admin/stock", 
        icon: Database, 
        resource: "operasional", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen inventaris stok voucher dan pembatasan kuota operasional provider.",
        dependencies: ["InventoryService", "Reservation Engine"]
      },
      { 
        title: "Digital Delivery", 
        href: "/admin/delivery", 
        icon: FileJson, 
        resource: "operasional", 
        action: "view",
        status: "ACTIVE",
        description: "Log pengiriman item digital (Voucher, Top-up) ke pelanggan dengan sinkronisasi provider.",
        dependencies: ["DeliveryService", "Digital Output Layer"]
      },
      { 
        title: "Queue / Jobs", 
        icon: Clock, 
        href: "/admin/queue", 
        resource: "operasional", 
        action: "view",
        status: "ACTIVE",
        description: "Pusat orkestrasi antrean tugas latar belakang (Fulfillment, Reconciliation, Recovery) dengan lease-based locking.",
        dependencies: ["JobService", "Firestore Lease Queue"]
      },
      { 
        title: "SLA", 
        icon: Activity, 
        href: "/admin/sla", 
        resource: "sla", 
        action: "view",
        status: "ACTIVE",
        description: "Analisis kecepatan pengiriman produk dibanding target.",
        dependencies: ["SLA Service", "Operational Monitoring"]
      },
      { 
        title: "Business Calendar", 
        icon: Calendar, 
        href: "/admin/calendar", 
        resource: "calendar", 
        action: "view",
        status: "ACTIVE",
        description: "Jadwal operasional dan hari libur sistem.",
        dependencies: ["Business Calendar Service"]
      },
    ]
  },
  {
    title: "MARKETING & KONTEN",
    items: [
      { 
        title: "Campaign", 
        href: "/admin/campaigns", 
        icon: Megaphone, 
        resource: "marketing", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen kampanye pemasaran terjadwal.",
        dependencies: ["Marketing API"]
      },
      { 
        title: "Banner & Placement", 
        href: "/admin/banners", 
        icon: ImageIcon, 
        resource: "content", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan banner homepage dan promosi visual.",
        dependencies: ["Media Storage", "CMS Engine"]
      },
      { 
        title: "Popup", 
        href: "/admin/popups", 
        icon: MousePointer2, 
        resource: "content", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan modal popup promosi saat user berkunjung.",
        dependencies: ["CMS Engine"]
      },
      { 
        title: "Landing Pages", 
        href: "/admin/landings", 
        icon: Layout, 
        resource: "content", 
        action: "view",
        status: "ACTIVE",
        description: "Pembuatan halaman landing promosi dan event khusus.",
        dependencies: ["Media Storage", "Catalog", "Promo Engine"]
      },
      { 
        title: "Blog", 
        href: "/admin/blog", 
        icon: FileText, 
        resource: "content", 
        action: "view",
        status: "ACTIVE",
        description: "Sistem manajemen artikel, panduan, dan berita promosi.",
        dependencies: ["Media Library", "Catalog", "Promo Engine"]
      },
      { 
        title: "FAQ", 
        href: "/admin/faq", 
        icon: HelpCircle, 
        resource: "faq", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen daftar pertanyaan yang sering diajukan pelanggan.",
        dependencies: ["Content System", "Catalog", "Promo Engine"]
      },
      { 
        title: "Media Library", 
        href: "/admin/media", 
        icon: Library, 
        resource: "content", 
        action: "view",
        status: "ACTIVE",
        description: "Pusat penyimpanan aset gambar dan file.",
        dependencies: ["Cloud Storage"]
      },
      { 
        title: "SEO", 
        href: "/admin/seo", 
        icon: Search, 
        resource: "seo", 
        action: "view",
        status: "ACTIVE",
        description: "Optimasi meta tag, sitemap XML, robots.txt, dan crawling sistem.",
        dependencies: ["Metadata Service"]
      },
    ]
  },
  {
    title: "SYSTEM",
    items: [
      { 
        title: "Roles & Permissions", 
        href: "/admin/roles", 
        icon: ShieldCheck, 
        resource: "roles", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Security", 
        href: "/admin/security", 
        icon: Lock, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan MFA, blokir IP, dan audit keamanan.",
        dependencies: ["Auth Service", "Security Log"]
      },
      { 
        title: "Audit Log", 
        href: "/admin/audit-logs", 
        icon: History, 
        resource: "audit_logs", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "System Logs", 
        href: "/admin/system-logs", 
        icon: Terminal, 
        resource: "system_logs", 
        action: "view",
        status: "ACTIVE",
        description: "Log mentah sistem, runtime, integrasi provider, dan performa backend.",
        dependencies: ["Logging Service"]
      },
      { 
        title: "Feature Flags", 
        href: "/admin/feature-flags", 
        icon: Flag, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Aktifkan/matikan fitur secara dinamis tanpa deploy.",
        dependencies: ["Config Service"]
      },
      { 
        title: "Configuration", 
        href: "/admin/system-config", 
        icon: SettingsIcon, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Variabel lingkungan dan rahasia sistem.",
        dependencies: ["Secret Manager"]
      },
      { 
        title: "Integrations", 
        href: "/admin/integrations", 
        icon: LinkIcon, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Kelola integrasi Midtrans, API Games, TokoVoucher, dan layanan pihak ketiga.",
        dependencies: ["Integrations Hub", "Secure Storage"]
      },
      { 
        title: "Backup & Recovery", 
        href: "/admin/backup", 
        icon: Save, 
        resource: "system", 
        action: "view",
        status: "ACTIVE",
        description: "Manajemen cadangan database dan pemulihan.",
        dependencies: ["GCP Backup Service"]
      },
    ]
  },
  {
    title: "PENGATURAN",
    items: [
      { 
        title: "Store", 
        href: "/admin/settings", 
        icon: Store, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE"
      },
      { 
        title: "Branding", 
        href: "/admin/branding", 
        icon: Palette, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan warna, logo, dan tema aplikasi.",
        dependencies: ["Theming Engine"]
      },
      { 
        title: "Domain", 
        href: "/admin/domain", 
        icon: Globe, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan nama domain dan SSL.",
        dependencies: ["DNS Manager"]
      },
      { 
        title: "Notification", 
        href: "/admin/notification-settings", 
        icon: Mail, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Template email dan WhatsApp notifikasi.",
        dependencies: ["Messaging API"]
      },
      { 
        title: "Communication", 
        href: "/admin/communication", 
        icon: MessageSquare, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan kanal komunikasi resmi.",
        dependencies: ["Social API"]
      },
      { 
        title: "Privacy", 
        href: "/admin/privacy", 
        icon: ShieldCheck, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan kebijakan privasi dan TOS.",
        dependencies: ["Legal Content"]
      },
      { 
        title: "Regional / Language / Currency", 
        href: "/admin/regional", 
        icon: Languages, 
        resource: "settings", 
        action: "view",
        status: "ACTIVE",
        description: "Pengaturan bahasa, mata uang, format angka/tanggal, dan zona waktu.",
        dependencies: ["Store Configuration"]
      },
    ]
  }
];
