import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { IpaymuService } from './services/ipaymu';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Body limit

// Logging
app.use(morgan('combined'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Public Endpoints
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: 'ipaymu-proxy', timestamp: new Date().toISOString() });
});

// Private Endpoints (Requires PROXY_AUTH_TOKEN)
app.post('/api/v2/payment/direct', authMiddleware, async (req: Request, res: Response) => {
  const result = await IpaymuService.forwardRequest('/payment/direct', req.body);
  res.status(result.status).json(result.data);
});

app.post('/api/v2/transaction', authMiddleware, async (req: Request, res: Response) => {
  const result = await IpaymuService.forwardRequest('/transaction', req.body);
  res.status(result.status).json(result.data);
});

app.post('/api/v2/payment/refund', authMiddleware, async (req: Request, res: Response) => {
  const result = await IpaymuService.forwardRequest('/payment/refund', req.body);
  res.status(result.status).json(result.data);
});

// Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Unhandled Exception', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
  logger.info(`iPaymu Proxy started on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    logger.info('Process terminated.');
  });
});
