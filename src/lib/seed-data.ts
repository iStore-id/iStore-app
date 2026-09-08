export const defaultProducts = [
  {
    id: "mobile-legends",
    slug: "mobile-legends",
    name: "Mobile Legends: Bang Bang",
    brand: "Moonton",
    category: "game",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80",
    status: "active",
    isPopular: true,
    inputSchema: {
      fields: [
        { name: "userId", label: "User ID", required: true, type: "text" },
        { name: "zoneId", label: "Zone ID", required: true, type: "text" }
      ]
    },
    instructions: "Masukkan User ID dan Zone ID yang tertera di profil game Anda (contoh: 12345678 (1234)).",
    variants: [
      { id: "ml_86", name: "86 Diamonds", sellingPrice: 20000, costPrice: 19000, providerCode: "ML86" },
      { id: "ml_172", name: "172 Diamonds", sellingPrice: 40000, costPrice: 38000, providerCode: "ML172" },
      { id: "ml_257", name: "257 Diamonds", sellingPrice: 60000, costPrice: 57000, providerCode: "ML257" },
      { id: "ml_706", name: "706 Diamonds", sellingPrice: 160000, costPrice: 152000, providerCode: "ML706" },
      { id: "ml_pass", name: "Weekly Diamond Pass", sellingPrice: 30000, costPrice: 27500, providerCode: "MLPASS" }
    ]
  },
  {
    id: "free-fire",
    slug: "free-fire",
    name: "Free Fire",
    brand: "Garena",
    category: "game",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80",
    status: "active",
    isPopular: true,
    inputSchema: {
      fields: [
        { name: "userId", label: "Player ID", required: true, type: "text" }
      ]
    },
    instructions: "Masukkan Player ID Akun Free Fire Anda yang tertera di profil game.",
    variants: [
      { id: "ff_70", name: "70 Diamonds", sellingPrice: 10000, costPrice: 9200, providerCode: "FF70" },
      { id: "ff_140", name: "140 Diamonds", sellingPrice: 20000, costPrice: 18500, providerCode: "FF140" },
      { id: "ff_355", name: "355 Diamonds", sellingPrice: 50000, costPrice: 46500, providerCode: "FF355" },
      { id: "ff_720", name: "720 Diamonds", sellingPrice: 100000, costPrice: 93000, providerCode: "FF720" }
    ]
  },
  {
    id: "genshin-impact",
    slug: "genshin-impact",
    name: "Genshin Impact",
    brand: "HoYoverse",
    category: "game",
    image: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=400&q=80",
    status: "active",
    isPopular: true,
    inputSchema: {
      fields: [
        { name: "userId", label: "UID", required: true, type: "text" },
        { name: "zoneId", label: "Server (Asia/America/Europe/TW)", required: true, type: "text" }
      ]
    },
    instructions: "Masukkan UID dan Server game Genshin Impact Anda.",
    variants: [
      { id: "gi_60", name: "60 Genesis Crystals", sellingPrice: 16000, costPrice: 14500, providerCode: "GI60" },
      { id: "gi_300", name: "300+30 Genesis Crystals", sellingPrice: 79000, costPrice: 73000, providerCode: "GI330" },
      { id: "gi_welkin", name: "Blessing of the Welkin Moon", sellingPrice: 79000, costPrice: 74000, providerCode: "GIWELKIN" }
    ]
  },
  {
    id: "valorant",
    slug: "valorant",
    name: "Valorant",
    brand: "Riot Games",
    category: "game",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80",
    status: "active",
    isPopular: true,
    inputSchema: {
      fields: [
        { name: "userId", label: "Riot ID (Format: Name#Tag)", required: true, type: "text" }
      ]
    },
    instructions: "Masukkan Riot ID lengkap beserta Tagline Anda (contoh: Agent#1234).",
    variants: [
      { id: "val_475", name: "475 Points", sellingPrice: 50000, costPrice: 47000, providerCode: "VAL475" },
      { id: "val_1000", name: "1000 Points", sellingPrice: 100000, costPrice: 95000, providerCode: "VAL1000" },
      { id: "val_2050", name: "2050 Points", sellingPrice: 200000, costPrice: 190000, providerCode: "VAL2050" }
    ]
  },
  {
    id: "pubg-mobile",
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    brand: "Level Infinite",
    category: "game",
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=400&q=80",
    status: "active",
    isPopular: true,
    inputSchema: {
      fields: [
        { name: "userId", label: "Player ID", required: true, type: "text" }
      ]
    },
    instructions: "Masukkan Player ID PUBG Mobile Anda.",
    variants: [
      { id: "pubg_60", name: "60 Unknown Cash (UC)", sellingPrice: 15000, costPrice: 13500, providerCode: "PUBG60" },
      { id: "pubg_300", name: "300+25 Unknown Cash (UC)", sellingPrice: 75000, costPrice: 70000, providerCode: "PUBG325" },
      { id: "pubg_600", name: "600+60 Unknown Cash (UC)", sellingPrice: 150000, costPrice: 140000, providerCode: "PUBG660" }
    ]
  }
];
