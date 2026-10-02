export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, maskSensitive(data));
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, maskSensitive(error));
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, maskSensitive(data));
  }
};

function maskSensitive(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'apiKey', 'signature', 'authorization', 'token', 
    'va', 'password', 'proxy_auth_token', 'ipaymu_api_key'
  ];
  
  const masked = JSON.parse(JSON.stringify(obj));
  
  const mask = (o: any) => {
    for (const key in o) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        o[key] = '********';
      } else if (typeof o[key] === 'object' && o[key] !== null) {
        mask(o[key]);
      }
    }
  };

  mask(masked);
  return masked;
}
