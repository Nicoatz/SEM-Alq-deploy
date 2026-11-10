import { Router, Request, Response, NextFunction } from 'express';
import v1Router from '../routes/v1';
import { redactarUrl } from './redactar-url';

const gatewayRouter = Router();

// Middleware de Gateway: identificación, logging y desacoplamiento
gatewayRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Gateway-Version', '1.0.0');
  res.setHeader('X-Service-Layer', 'RentAR-Core-Backend');
  console.log(`[API Gateway] ${new Date().toISOString()} | ${req.method} ${redactarUrl(req.originalUrl)}`);
  next();
});

// Health check para monitoreo y gateway status
gatewayRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    gateway: 'RentAR API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Enrutamiento versionado: todas las APIs actuales bajo /api/v1
gatewayRouter.use('/v1', v1Router);

export default gatewayRouter;
