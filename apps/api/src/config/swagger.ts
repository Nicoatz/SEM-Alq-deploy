import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RentAR - API Gateway & Backend Services',
      version: '1.0.0',
      description: 'Documentación oficial de la API de RentAR para la gestión integral de alquileres, inmuebles, contratos y publicaciones.',
      contact: {
        name: 'Equipo de Desarrollo RentAR'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local (API Gateway)'
      }
    ],
    components: {
      securitySchemes: {
        SupabaseBearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
          description: 'JWT de acceso emitido por Supabase Auth'
        }
      }
    }
  },
  apis: ['./src/routes/**/*.ts', './src/gateway/**/*.ts', './src/dtos/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
