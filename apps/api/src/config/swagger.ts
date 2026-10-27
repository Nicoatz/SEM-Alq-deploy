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
        },
        AlquilerLocatarioItem: {
          type: 'object',
          required: ['id_contrato', 'codigo', 'estado', 'inmueble', 'locador', 'monto_actual'],
          properties: {
            id_contrato: { type: 'integer' },
            codigo: { type: 'string' },
            estado: { type: 'string', enum: ['pendiente_firma', 'vigente', 'finalizado'] },
            inmueble: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                direccion: { type: 'string' },
                numero: { type: 'integer' },
                piso: { type: 'string', nullable: true },
                barrio: { type: 'string' },
                ciudad: { type: 'string' },
                foto_principal: { type: 'string', format: 'uri', nullable: true }
              }
            },
            locador: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                nombre: { type: 'string' },
                apellido: { type: 'string', nullable: true },
                email: { type: 'string', format: 'email' },
                telefono: { type: 'string', nullable: true }
              }
            },
            monto_actual: { type: 'number', format: 'double' },
            expensas: { type: 'number', format: 'double' },
            fecha_inicio_contrato: { type: 'string', format: 'date', nullable: true },
            fecha_fin_contrato: { type: 'string', format: 'date', nullable: true },
            deposito: { type: 'number', format: 'double', nullable: true },
            indice_ajuste: { type: 'string', nullable: true },
            frecuencia_ajuste: { type: 'string', nullable: true },
            fecha_ultimo_ajuste: { type: 'string', format: 'date', nullable: true },
            fecha_proximo_ajuste: { type: 'string', format: 'date', nullable: true }
          }
        },
        AlquilerLocatarioDetalle: {
          allOf: [
            { $ref: '#/components/schemas/AlquilerLocatarioItem' },
            {
              type: 'object',
              properties: {
                dias_para_vencimiento: { type: 'integer', nullable: true },
                fecha_proximo_vencimiento_pago: { type: 'string', format: 'date', nullable: true },
                pdf_url: { type: 'string', format: 'uri', nullable: true },
                medios_pago: { type: 'array', items: { type: 'string' } },
                garantes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nombre: { type: 'string' },
                      apellido: { type: 'string', nullable: true },
                      email: { type: 'string', format: 'email' },
                      telefono: { type: 'string', nullable: true }
                    }
                  }
                },
                firmas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tipo: { type: 'string', enum: ['locador', 'locatario', 'garante'] },
                      estado: { type: 'string', enum: ['pendiente', 'firmado', 'rechazado', 'desconocido'] },
                      fecha_conformidad: { type: 'string', format: 'date-time', nullable: true },
                      fecha_firma: { type: 'string', format: 'date-time', nullable: true },
                      fecha_rechazo: { type: 'string', format: 'date-time', nullable: true },
                      motivo_rechazo: { type: 'string', nullable: true }
                    }
                  }
                },
                puede_firmar: { type: 'boolean' },
                monto_proximo_ajuste: { type: 'string', enum: ['a definir'], nullable: true }
              }
            }
          ]
        }
      }
    }
  },
  apis: ['./src/routes/**/*.ts', './src/gateway/**/*.ts', './src/dtos/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
