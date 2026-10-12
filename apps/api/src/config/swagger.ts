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
      },
      schemas: {
        SolicitudResponse: {
          type: 'object',
          required: ['id', 'estado', 'mensaje', 'fecha_creacion', 'fecha_respuesta', 'inmueble', 'postulante', 'legajo'],
          properties: {
            id: { type: 'integer', example: 100 },
            estado: { type: 'string', enum: ['pendiente', 'aceptada', 'rechazada', 'cancelada'] },
            mensaje: { type: 'string', nullable: true, maxLength: 600 },
            fecha_creacion: { type: 'string', format: 'date-time' },
            fecha_respuesta: { type: 'string', format: 'date-time', nullable: true },
            inmueble: {
              type: 'object',
              required: ['id', 'direccion', 'numero', 'barrio', 'foto_principal'],
              properties: {
                id: { type: 'integer' },
                direccion: { type: 'string' },
                numero: { type: 'integer' },
                piso: { type: 'string', nullable: true },
                barrio: { type: 'string' },
                foto_principal: { type: 'string', format: 'uri', nullable: true }
              }
            },
            postulante: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' },
                apellido: { type: 'string', nullable: true },
                dni: { type: 'string', nullable: true },
                telefono: { type: 'string', nullable: true },
                email: { type: 'string', format: 'email', nullable: true }
              }
            },
            legajo: {
              type: 'object',
              nullable: true,
              properties: {
                ocupacion: { type: 'string', enum: ['sin_informar', 'relacion_dependencia', 'monotributista', 'autonoma', 'estudiante', 'jubilada'] },
                ingresos: { type: 'integer', nullable: true },
                convivientes: { type: 'integer', minimum: 1 },
                mascotas: { type: 'boolean' },
                detalle_mascotas: { type: 'string', nullable: true, maxLength: 300 },
                garantias: {
                  type: 'array',
                  items: { type: 'string', enum: ['propietaria', 'caucion', 'otra'] }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/**/*.ts', './src/gateway/**/*.ts', './src/dtos/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
