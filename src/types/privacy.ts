export interface PrivacySettings {
  id: string; // "global"
  
  // 1. Kebijakan Privasi (Privacy Policy)
  privacyPolicy: {
    title: string;
    content: string; // Markdown / Plain text
    lastUpdated: string; // ISO string
    version: string;
  };

  // 2. Syarat & Ketentuan Layanan (Terms of Service)
  termsOfService: {
    title: string;
    content: string; // Markdown / Plain text
    lastUpdated: string; // ISO string
    version: string;
  };

  // 3. Kontak Perlindungan Data (Data Protection / DPO Contact)
  dpoContact: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };

  // 4. Banner Cookie & Consent
  cookieConsent: {
    enabled: boolean;
    title: string;
    message: string;
    allowDecline: boolean;
  };

  // 5. Retensi & Perlindungan Data (Data Retention & Safeguards)
  dataRetention: {
    retentionMonths: number; // e.g. 12, 24, 36 (0 = simpan selamanya)
    allowCustomerDataExport: boolean;
    allowCustomerAccountDeletion: boolean;
    anonymizeDeletedOrders: boolean;
    retentionNote: string;
  };

  updatedAt?: string;
  updatedBy?: string;
}

export interface PublicPrivacySettings {
  privacyPolicy: {
    title: string;
    content: string;
    lastUpdated: string;
    version: string;
  };
  termsOfService: {
    title: string;
    content: string;
    lastUpdated: string;
    version: string;
  };
  dpoContact: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  cookieConsent: {
    enabled: boolean;
    title: string;
    message: string;
    allowDecline: boolean;
  };
  dataRetention: {
    retentionMonths: number;
    allowCustomerDataExport: boolean;
    allowCustomerAccountDeletion: boolean;
    anonymizeDeletedOrders: boolean;
    retentionNote: string;
  };
}
