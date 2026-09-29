import express, { Application } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import gatewayRouter from './gateway/gateway.router';
import { swaggerSpec } from './config/swagger';
import { corsOptions } from './config/cors';
import { errorHandler } from './gateway/middlewares/error.middleware';

export const createApp = (): Application => {
  const app = express();

  // Middlewares globales
  app.use(cors(corsOptions()));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Documentación Swagger OpenAPI
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Exposición del API Gateway bajo /api
  // Las rutas quedan versionadas: /api/v1/mis-alquileres, /api/v1/inmuebles, etc.
  app.use('/api', gatewayRouter);

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
};

export const app = createApp();

// Vercel toma src/app.ts como entrypoint y necesita la app como export default.
// El listen() queda solo en src/server.ts, que se usa en local (dev:api / start).
export default app;
