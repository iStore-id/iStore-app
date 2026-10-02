import axios from 'axios';
import * as crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const IPAYMU_VA = process.env.IPAYMU_VA || '';
const IPAYMU_API_KEY = process.env.IPAYMU_API_KEY || '';
const IPAYMU_BASE_URL = process.env.IPAYMU_BASE_URL || 'https://my.ipaymu.com/api/v2';

export class IpaymuService {
  private static getTimestamp(): string {
    const d = new Date();
    return d.toISOString().replace(/[-:.]/g, '').slice(0, 14);
  }

  private static generateSignature(bodyString: string): string {
    const hashBody = crypto.createHash('sha256').update(bodyString).digest('hex');
    const stringToSign = `POST:${IPAYMU_VA}:${hashBody}:${IPAYMU_API_KEY}`;
    return crypto.createHmac('sha256', IPAYMU_API_KEY).update(stringToSign).digest('hex');
  }

  public static async forwardRequest(path: string, body: any) {
    if (!IPAYMU_VA || !IPAYMU_API_KEY) {
      throw new Error('iPaymu credentials (VA/API_KEY) not configured on proxy');
    }

    const endpoint = `${IPAYMU_BASE_URL}${path}`;
    
    // Ensure we only talk to iPaymu
    const urlObj = new URL(endpoint);
    if (!urlObj.hostname.endsWith('ipaymu.com')) {
      throw new Error(`Forbidden upstream host: ${urlObj.hostname}`);
    }

    const bodyString = JSON.stringify(body);
    const signature = this.generateSignature(bodyString);
    const timestamp = this.getTimestamp();

    logger.info(`Forwarding request to iPaymu: ${path}`);

    try {
      const response = await axios.post(endpoint, bodyString, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': IPAYMU_VA,
          'signature': signature,
          'timestamp': timestamp
        },
        timeout: 10000 // 10 seconds timeout
      });

      return {
        status: response.status,
        data: response.data
      };
    } catch (error: any) {
      const status = error.response?.status || 500;
      const data = error.response?.data || { message: error.message };
      
      logger.error(`iPaymu Upstream Error (${status}): ${path}`, data);
      
      return { status, data };
    }
  }
}
