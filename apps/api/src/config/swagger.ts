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
        },
        PropiedadCobroConsulta: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            direccion: { type: 'string' },
            numero: { type: 'integer' },
            piso: { type: 'string', nullable: true },
            barrio: { type: 'string' },
            ciudad: { type: 'string' }
          }
        },
        PersonaCobroConsulta: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            apellido: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email' },
            telefono: { type: 'string', nullable: true }
          }
        },
        CargoCobroConsulta: {
          type: 'object',
          properties: {
            concepto: { type: 'string', enum: ['alquiler', 'intereses_mora'] },
            monto: { type: 'number' },
            dias_mora: { type: 'integer' },
            dias_interes: { type: 'integer' }
          }
        },
        CobroRegistradoConsulta: {
          type: 'object',
          properties: {
            id_cobro: { type: 'integer' },
            numero_comprobante: { type: 'string' },
            fecha_cobro: { type: 'string', format: 'date' },
            monto: { type: 'number' },
            medio: { type: 'string', enum: ['transferencia', 'efectivo', 'cheque', 'mercadopago_externo', 'otro'] },
            nota: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            usuario_registro: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
                apellido: { type: 'string', nullable: true }
              }
            },
            tiene_adjunto: { type: 'boolean' },
            adjunto_url: { type: 'string', format: 'uri', nullable: true },
            comprobante_url: { type: 'string', format: 'uri' }
          }
        },
        PeriodoCobroEventoConsulta: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['periodo_generado', 'cobro_registrado', 'periodo_pagado'] },
            fecha_hora: { type: 'string', format: 'date-time' },
            usuario: {
              type: 'object',
              nullable: true,
              properties: {
                nombre: { type: 'string' },
                apellido: { type: 'string', nullable: true }
              }
            },
            datos: { type: 'object', additionalProperties: true }
          }
        },
        PeriodoCobroConsulta: {
          type: 'object',
          properties: {
            id_periodo: { type: 'integer' },
            id_contrato: { type: 'integer' },
            codigo_contrato: { type: 'string', nullable: true },
            periodo: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
            estado: { type: 'string', enum: ['pendiente', 'vencido', 'pagado'] },
            fecha_inicio: { type: 'string', format: 'date' },
            fecha_fin: { type: 'string', format: 'date' },
            fecha_vencimiento: { type: 'string', format: 'date' },
            propiedad: { $ref: '#/components/schemas/PropiedadCobroConsulta' },
            locatario: { allOf: [{ $ref: '#/components/schemas/PersonaCobroConsulta' }], nullable: true },
            monto_base_alquiler: { type: 'number' },
            intereses_mora: { type: 'number' },
            dias_atraso: { type: 'integer' },
            dias_interes: { type: 'integer' },
            monto_exigible: { type: 'number' },
            total_cobrado: { type: 'number' },
            saldo: { type: 'number' },
            cantidad_cobros: { type: 'integer' },
            tiene_adjunto: { type: 'boolean' },
            comprobante_url: { type: 'string', nullable: true }
          }
        },
        HistorialCobrosLocador: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/PeriodoCobroConsulta' } },
            resumen: {
              type: 'object',
              properties: {
                cobrado: { type: 'number' },
                vencido: { type: 'number' },
                cantidades: {
                  type: 'object',
                  properties: {
                    pendiente: { type: 'integer' },
                    vencido: { type: 'integer' },
                    pagado: { type: 'integer' }
                  }
                }
              }
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            filtros: { type: 'object' }
          }
        },
        PagoLocatarioConsulta: {
          allOf: [
            { $ref: '#/components/schemas/PeriodoCobroConsulta' },
            {
              type: 'object',
              properties: {
                fecha_pago: { type: 'string', format: 'date' },
                monto_pagado: { type: 'number' },
                medio: { type: 'string', enum: ['transferencia', 'efectivo', 'cheque', 'mercadopago_externo', 'otro'] },
                recargo_pagado: { type: 'number' },
                pagos_a_termino: { type: 'boolean' }
              }
            }
          ]
        },
        PagosLocatario: {
          type: 'object',
          properties: {
            proximo_periodo: {
              allOf: [{ $ref: '#/components/schemas/PeriodoCobroConsulta' }],
              nullable: true
            },
            items: { type: 'array', items: { $ref: '#/components/schemas/PagoLocatarioConsulta' } },
            resumen_anual: {
              type: 'object',
              properties: {
                anio: { type: 'integer' },
                total_pagado: { type: 'number' },
                pagos_a_termino: { type: 'integer' },
                recargos_pagados: { type: 'number' }
              }
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            filtros: { type: 'object' }
          }
        },
        DetalleCobroConsulta: {
          type: 'object',
          properties: {
            id_periodo: { type: 'integer' },
            id_contrato: { type: 'integer' },
            propiedad: { $ref: '#/components/schemas/PropiedadCobroConsulta' },
            locador: { $ref: '#/components/schemas/PersonaCobroConsulta' },
            locatario: { $ref: '#/components/schemas/PersonaCobroConsulta' },
            contrato: {
              type: 'object',
              properties: {
                codigo: { type: 'string', nullable: true },
                fecha_inicio: { type: 'string', format: 'date', nullable: true },
                fecha_fin: { type: 'string', format: 'date', nullable: true }
              }
            },
            periodo: {
              type: 'object',
              properties: {
                periodo: { type: 'string' },
                estado: { type: 'string', enum: ['pendiente', 'vencido', 'pagado'] },
                fecha_inicio: { type: 'string', format: 'date' },
                fecha_fin: { type: 'string', format: 'date' },
                fecha_vencimiento: { type: 'string', format: 'date' }
              }
            },
            cargos: { type: 'array', items: { $ref: '#/components/schemas/CargoCobroConsulta' } },
            total_exigible: { type: 'number' },
            total_cobrado: { type: 'number' },
            saldo: { type: 'number' },
            cobros: { type: 'array', items: { $ref: '#/components/schemas/CobroRegistradoConsulta' } },
            historial: { type: 'array', items: { $ref: '#/components/schemas/PeriodoCobroEventoConsulta' } }
          }
        },
      }
    }
  },
  apis: ['./src/routes/**/*.ts', './src/gateway/**/*.ts', './src/dtos/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
