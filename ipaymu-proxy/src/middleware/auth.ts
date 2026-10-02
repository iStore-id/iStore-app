import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const PROXY_AUTH_TOKEN = process.env.PROXY_AUTH_TOKEN;

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!PROXY_AUTH_TOKEN) {
    logger.error('PROXY_AUTH_TOKEN is not defined in environment variables');
    return res.status(500).json({ success: false, message: 'Internal Server Configuration Error' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  if (token !== PROXY_AUTH_TOKEN) {
    logger.warn(`Invalid token used from ${req.ip}`);
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }

  next();
};
