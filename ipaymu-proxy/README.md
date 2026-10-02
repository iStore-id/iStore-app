# iPaymu Production Proxy VPS

Service proxy Node.js minimal untuk meneruskan request dari iStore (Vercel) ke iPaymu Production API melalui IP Statis VPS.

## Arsitektur
`iStore (Vercel) -> HTTPS -> VPS Proxy (IP Terdaftar) -> iPaymu API v2`

## Persyaratan VPS
- Ubuntu 24.04 LTS
- Node.js 20.x (LTS)
- IP Publik Statis (Misal: `45.66.153.148`)
- Reverse Proxy (Caddy atau Nginx) untuk HTTPS

## Setup Environment
Salin `.env.example` ke `.env` dan isi nilainya:
- `PROXY_AUTH_TOKEN`: Token rahasia yang akan dikirim oleh iStore di header `Authorization: Bearer <token>`.
- `IPAYMU_VA` & `IPAYMU_API_KEY`: Kredensial production iPaymu.

## Instalasi & Jalankan (Development)
```bash
npm install
npm run dev
```

## Build & Jalankan (Production)
```bash
npm install
npm run build
npm start
```

## Deployment via Docker
```bash
docker build -t ipaymu-proxy .
docker run -d -p 3000:3000 --env-file .env --name ipaymu-proxy ipaymu-proxy
```

## Konfigurasi Reverse Proxy (Caddy)
Gunakan domain yang diarahkan ke IP VPS.
```caddy
ipaymu-proxy.ist.web.id {
    reverse_proxy localhost:3000
}
```

## Security Checklist
1. **Firewall (UFW):**
   ```bash
   ufw allow 20340/tcp  # SSH Port
   ufw allow 80/tcp     # HTTP
   ufw allow 443/tcp    # HTTPS
   ufw enable
   ```
2. **Whitelist IP:** Pastikan IP VPS sudah terdaftar di [Dashboard iPaymu](https://my.ipaymu.com/ip).
3. **No Logs:** Aplikasi diatur untuk tidak mencatat API Key atau Token di logs.

## Endpoint
- `GET /health`: Health check publik.
- `POST /api/v2/payment/direct`: Proxy Payment Direct.
- `POST /api/v2/transaction`: Proxy Status Check.
- `POST /api/v2/payment/refund`: Proxy Refund.

Semua endpoint private wajib menggunakan header `Authorization: Bearer <PROXY_AUTH_TOKEN>`.
