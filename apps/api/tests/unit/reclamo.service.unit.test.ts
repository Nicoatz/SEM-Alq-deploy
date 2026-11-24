import { ReclamoService } from '../../src/services/reclamo.service';
import type { IReclamoRepository } from '../../src/repositories/reclamo.repository';
import type { IConversacionRepository } from '../../src/repositories/conversacion.repository';
import type { IMensajeRepository } from '../../src/repositories/mensaje.repository';
import type { AuthenticatedUser } from '../../src/gateway/middlewares/auth.middleware';
import type { ReclamoResponse, TipoReclamoDTO, ConversacionResponse } from '../../src/dtos';

describe('US-14, US-15 y US-18: Reclamos (ReclamoService Unit Tests)', () => {
  let service: ReclamoService;
  let mockReclamoRepo: jest.Mocked<IReclamoRepository>;
  let mockInmuebleRepo: any;
  let mockConversacionRepo: jest.Mocked<IConversacionRepository>;
  let mockMensajeRepo: jest.Mocked<IMensajeRepository>;

  const locatarioUser: AuthenticatedUser = {
    id: 15,
    nombre: 'Martín',
    apellido: 'Inquilino',
    email: 'martin@example.test',
    numero_documento: '35123456',
    roles: ['locatario'],
    authUserId: 'uuid-locatario-15'
  };

  const locadorUser: AuthenticatedUser = {
    id: 5,
    nombre: 'Lucía',
    apellido: 'Propietaria',
    email: 'lucia@example.test',
    numero_documento: '25123456',
    roles: ['locador'],
    authUserId: 'uuid-locador-5'
  };

  const terceroUser: AuthenticatedUser = {
    id: 99,
    nombre: 'Intruso',
    apellido: 'Ajeno',
    email: 'intruso@example.test',
    numero_documento: '39123456',
    roles: ['locatario'],
    authUserId: 'uuid-tercero-99'
  };

  const tipoReclamoValido: TipoReclamoDTO = {
    id: 1,
    nombre: 'pintura',
    descripcion: 'Pintura'
  };

  const mensajeValido50Chars = 'Este es un mensaje de reclamo válido con más de cincuenta caracteres para probar.';

  const reclamoMock: ReclamoResponse = {
    id: 100,
    id_inmueble: 10,
    id_locatario: 15,
    id_contrato: 1,
    id_tipo_reclamo: 1,
    id_estado_reclamo: 1, // Pendiente / Abierto
    titulo: 'Reclamo: Pintura',
    descripcion: mensajeValido50Chars,
    fecha_creacion: '2026-11-24T18:00:00Z',
    fecha_actualizacion: '2026-11-24T18:00:00Z',
    tipo_reclamo: tipoReclamoValido,
    estado: 'pendiente',
    fotos: [
      { id: 1, id_reclamo: 100, url: 'https://example.test/foto1.jpg', peso_kb: 120, formato: 'jpg', orden: 1 }
    ],
    inmueble: {
      id: 10,
      direccion: 'Av. Colón',
      numero: 1200,
      piso: '3A',
      barrio: 'Alberdi',
      ciudad: 'Córdoba',
      foto_principal: 'https://example.test/inmueble.jpg'
    },
    locador: { id: 5, nombre: 'Lucía', apellido: 'Propietaria', email: 'lucia@example.test', telefono: null },
    locatario: { id: 15, nombre: 'Martín', apellido: 'Inquilino', email: 'martin@example.test', telefono: null }
  };

  beforeEach(() => {
    mockReclamoRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByLocatarioId: jest.fn(),
      findByLocadorId: jest.fn(),
      findTiposReclamo: jest.fn(),
      findTipoReclamoById: jest.fn(),
      findTipoReclamoByNombre: jest.fn(),
      findContratoVigenteLocatarioInmueble: jest.fn(),
      actualizarEstado: jest.fn()
    };

    mockInmuebleRepo = {
      findById: jest.fn()
    };

    mockConversacionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUsuarioId: jest.fn(),
      findByReclamoId: jest.fn(),
      existeContratoVigente: jest.fn(),
      actualizarFechaActividad: jest.fn()
    };

    mockMensajeRepo = {
      create: jest.fn(),
      findByConversacionId: jest.fn(),
      findById: jest.fn(),
      marcarEliminado: jest.fn(),
      countByConversacionId: jest.fn(),
      podarMensajesAntiguos: jest.fn()
    };

    service = new ReclamoService(
      mockReclamoRepo,
      mockInmuebleRepo,
      mockConversacionRepo,
      mockMensajeRepo
    );
  });

  // ─────────────────────────────────────────────────────────────
  // US-14: REGISTRAR RECLAMO
  // ─────────────────────────────────────────────────────────────
  describe('US-14: Validación de Sesión y Rol al Registrar', () => {
    it('debe fallar con 401 si no se ha iniciado sesión', async () => {
      await expect(
        service.registrarReclamo(null as any, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Debe iniciar sesión para registrar un reclamo.'
      });
    });

    it('debe fallar con 403 si el usuario autenticado no posee el rol locatario', async () => {
      await expect(
        service.registrarReclamo(locadorUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        codigo: 'ROL_NO_AUTORIZADO',
        message: 'Solo un locatario puede registrar un reclamo.'
      });
    });
  });

  describe('US-14: Validación de Propiedad y Contrato Vigente', () => {
    it('debe fallar con 400 si no se selecciona una propiedad', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 0 as any,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Debe seleccionar una propiedad para registrar el reclamo.'
      });
    });

    it('debe fallar con 404 si la propiedad seleccionada no existe', async () => {
      mockInmuebleRepo.findById.mockResolvedValue(null);

      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 999,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'La propiedad seleccionada no existe.'
      });
    });

    it('debe fallar con 403 si el locatario no posee un contrato de alquiler vigente en esa propiedad', async () => {
      mockInmuebleRepo.findById.mockResolvedValue({ id: 10, direccion: 'Av. Colón 1200' });
      mockReclamoRepo.findContratoVigenteLocatarioInmueble.mockResolvedValue(null);

      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        codigo: 'SIN_CONTRATO_VIGENTE',
        message: 'No posee un contrato de alquiler vigente para la propiedad seleccionada.'
      });
    });
  });

  describe('US-14: Validación de Tipo de Reclamo', () => {
    beforeEach(() => {
      mockInmuebleRepo.findById.mockResolvedValue({ id: 10, direccion: 'Av. Colón 1200' });
      mockReclamoRepo.findContratoVigenteLocatarioInmueble.mockResolvedValue({ id: 1, estado: 2 });
    });

    it('debe fallar con 400 si no se selecciona un tipo de reclamo', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Debe seleccionar un tipo de reclamo.'
      });
    });

    it('debe fallar con 400 si el tipo de reclamo seleccionado no existe', async () => {
      mockReclamoRepo.findTipoReclamoById.mockResolvedValue(null);

      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 99,
          mensaje: mensajeValido50Chars
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El tipo de reclamo seleccionado no es válido.'
      });
    });
  });

  describe('US-14: Validación de Mensaje de Reclamo (50 a 5000 caracteres)', () => {
    beforeEach(() => {
      mockInmuebleRepo.findById.mockResolvedValue({ id: 10, direccion: 'Av. Colón 1200' });
      mockReclamoRepo.findContratoVigenteLocatarioInmueble.mockResolvedValue({ id: 1, estado: 2 });
      mockReclamoRepo.findTipoReclamoById.mockResolvedValue(tipoReclamoValido);
    });

    it('debe fallar con 400 si no se redacta un mensaje de reclamo', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: '   '
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Debe redactar un mensaje de reclamo.'
      });
    });

    it('debe fallar con 400 si el mensaje tiene menos de 50 caracteres', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: 'Se cayó la pintura del techo.' // 29 caracteres
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El mensaje de reclamo debe tener entre 50 y 5000 caracteres.'
      });
    });

    it('debe fallar con 400 si el mensaje supera los 5000 caracteres', async () => {
      const mensajeExcesivo = 'a'.repeat(5001);

      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeExcesivo
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El mensaje de reclamo debe tener entre 50 y 5000 caracteres.'
      });
    });
  });

  describe('US-14: Validación de Imágenes Adjuntas (hasta 10 fotos, JPG/PNG, <= 350kb)', () => {
    beforeEach(() => {
      mockInmuebleRepo.findById.mockResolvedValue({ id: 10, direccion: 'Av. Colón 1200' });
      mockReclamoRepo.findContratoVigenteLocatarioInmueble.mockResolvedValue({ id: 1, estado: 2 });
      mockReclamoRepo.findTipoReclamoById.mockResolvedValue(tipoReclamoValido);
    });

    it('debe permitir registrar el reclamo sin adjuntar imágenes', async () => {
      mockReclamoRepo.create.mockResolvedValue(reclamoMock);

      const resultado = await service.registrarReclamo(locatarioUser, {
        id_inmueble: 10,
        id_tipo_reclamo: 1,
        mensaje: mensajeValido50Chars
      });

      expect(resultado.id).toBe(100);
      expect(mockReclamoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id_inmueble: 10,
          id_locatario: 15,
          id_contrato: 1,
          id_tipo_reclamo: 1,
          descripcion: mensajeValido50Chars
        }),
        []
      );
    });

    it('debe fallar con 400 si se intentan adjuntar más de 10 imágenes', async () => {
      const fotosExcesivas = Array.from({ length: 11 }, (_, i) => ({
        url: `https://example.test/foto-${i}.jpg`,
        peso_kb: 200,
        formato: 'jpg'
      }));

      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars,
          fotos: fotosExcesivas
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'No se pueden adjuntar más de 10 imágenes.'
      });
    });

    it('debe fallar con 400 si una imagen tiene un formato distinto a JPG o PNG (ej. PDF o GIF)', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars,
          fotos: [
            {
              url: 'https://example.test/documento.pdf',
              peso_kb: 100,
              formato: 'pdf'
            }
          ]
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Las imágenes deben estar en formato JPG o PNG.'
      });
    });

    it('debe fallar con 400 si una imagen excede los 350kb', async () => {
      await expect(
        service.registrarReclamo(locatarioUser, {
          id_inmueble: 10,
          id_tipo_reclamo: 1,
          mensaje: mensajeValido50Chars,
          fotos: [
            {
              url: 'https://example.test/foto-pesada.png',
              peso_kb: 351,
              formato: 'png'
            }
          ]
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Las imágenes no deben exceder los 350kb cada una.'
      });
    });

    it('debe registrar el reclamo exitosamente con hasta 10 imágenes válidas (JPG/PNG <= 350kb)', async () => {
      const fotosValidas = [
        { url: 'https://example.test/foto1.jpg', peso_kb: 150, formato: 'jpg' },
        { url: 'https://example.test/foto2.png', peso_kb: 350, formato: 'png' }
      ];

      mockReclamoRepo.create.mockResolvedValue({
        ...reclamoMock,
        id: 101,
        fotos: [
          { id: 1, id_reclamo: 101, url: 'https://example.test/foto1.jpg', peso_kb: 150, formato: 'jpg', orden: 1 },
          { id: 2, id_reclamo: 101, url: 'https://example.test/foto2.png', peso_kb: 350, formato: 'png', orden: 2 }
        ]
      });

      const resultado = await service.registrarReclamo(locatarioUser, {
        id_inmueble: 10,
        id_tipo_reclamo: 1,
        titulo: 'Reclamo de prueba',
        mensaje: mensajeValido50Chars,
        fotos: fotosValidas
      });

      expect(resultado.id).toBe(101);
      expect(resultado.fotos).toHaveLength(2);
      expect(mockReclamoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id_inmueble: 10,
          id_locatario: 15,
          id_contrato: 1,
          id_tipo_reclamo: 1,
          titulo: 'Reclamo de prueba',
          descripcion: mensajeValido50Chars
        }),
        fotosValidas
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-15: CONSULTAR RECLAMOS
  // ─────────────────────────────────────────────────────────────
  describe('US-15: Consultar Reclamos (Listado y Detalle)', () => {
    it('debe fallar con 401 si no se ha iniciado sesión', async () => {
      await expect(
        service.consultarReclamos(null as any)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Debe iniciar sesión para consultar reclamos.'
      });
    });

    it('debe retornar lista vacía si no hay reclamos asociados al usuario', async () => {
      mockReclamoRepo.findByLocatarioId.mockResolvedValue([]);

      const resultado = await service.consultarReclamos(locatarioUser);

      expect(resultado).toEqual([]);
      expect(mockReclamoRepo.findByLocatarioId).toHaveBeenCalledWith(15, undefined);
    });

    it('debe permitir a un locatario consultar sus reclamos con los datos del locador, fotos e inmueble', async () => {
      mockReclamoRepo.findByLocatarioId.mockResolvedValue([reclamoMock]);

      const resultado = await service.consultarReclamos(locatarioUser);

      expect(resultado).toHaveLength(1);
      const primero = resultado[0];
      expect(primero.id).toBe(100);
      expect(primero.descripcion).toBe(mensajeValido50Chars);
      expect(primero.inmueble.foto_principal).toBe('https://example.test/inmueble.jpg');
      expect(primero.inmueble.direccion).toBe('Av. Colón');
      expect(primero.locador.nombre).toBe('Lucía');
      expect(primero.locatario.nombre).toBe('Martín');
      expect(primero.fotos).toHaveLength(1);
      expect(mockReclamoRepo.findByLocatarioId).toHaveBeenCalledWith(15, undefined);
    });

    it('debe permitir a un locador consultar los reclamos de sus inmuebles con los datos del locatario', async () => {
      mockReclamoRepo.findByLocadorId.mockResolvedValue([reclamoMock]);

      const resultado = await service.consultarReclamos(locadorUser);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].locatario.nombre).toBe('Martín');
      expect(mockReclamoRepo.findByLocadorId).toHaveBeenCalledWith(5, undefined);
    });

    it('debe permitir consultar el detalle de un reclamo por ID al locatario del reclamo', async () => {
      mockReclamoRepo.findById.mockResolvedValue(reclamoMock);

      const resultado = await service.consultarDetalleReclamo(locatarioUser, 100);

      expect(resultado.id).toBe(100);
      expect(resultado.descripcion).toBe(mensajeValido50Chars);
      expect(resultado.fotos).toHaveLength(1);
    });

    it('debe permitir consultar el detalle de un reclamo por ID al locador del inmueble', async () => {
      mockReclamoRepo.findById.mockResolvedValue(reclamoMock);

      const resultado = await service.consultarDetalleReclamo(locadorUser, 100);

      expect(resultado.id).toBe(100);
      expect(resultado.locador.id).toBe(5);
    });

    it('debe fallar con 403 si un usuario ajeno intenta consultar el detalle del reclamo', async () => {
      mockReclamoRepo.findById.mockResolvedValue(reclamoMock);

      await expect(
        service.consultarDetalleReclamo(terceroUser, 100)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'No tienes permiso para ver este reclamo.'
      });
    });

    it('debe fallar con 404 si el reclamo solicitado no existe', async () => {
      mockReclamoRepo.findById.mockResolvedValue(null);

      await expect(
        service.consultarDetalleReclamo(locatarioUser, 999)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'El reclamo solicitado no existe.'
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // US-18: RESPONDER RECLAMO
  // ─────────────────────────────────────────────────────────────
  describe('US-18: Responder Reclamo', () => {
    const conversacionMock: ConversacionResponse = {
      id: 50,
      id_locador: 5,
      id_locatario: 15,
      iniciado_por: 5,
      tipo_tema: 'reclamo',
      asunto: 'Reclamo: Pintura',
      id_inmueble: 10,
      id_reclamo: 100,
      id_contrato: 1,
      activo: true,
      fecha_creacion: '2026-11-24T18:10:00Z',
      fecha_actualizacion: '2026-11-24T18:10:00Z',
      otro_participante: { id: 15, nombre: 'Martín', apellido: 'Inquilino', email: 'martin@example.test', telefono: null }
    };

    it('debe fallar con 401 si no se ha iniciado sesión al responder', async () => {
      await expect(
        service.responderReclamo(null as any, 100, 'Respuesta')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Debe iniciar sesión para responder al reclamo.'
      });
    });

    it('debe fallar con 403 si un usuario que no es el locador de la propiedad intenta responder', async () => {
      mockReclamoRepo.findById.mockResolvedValue(reclamoMock); // Locador es id: 5

      await expect(
        service.responderReclamo(terceroUser, 100, 'Respuesta intrusa') // id: 99
      ).rejects.toMatchObject({
        statusCode: 403,
        codigo: 'SOLO_LOCADOR_PROPIETARIO',
        message: 'Solo el locador dueño de la propiedad asociada puede responder al reclamo.'
      });
    });

    it('debe fallar con 400 si el mensaje de respuesta está vacío o compuesto solo por espacios', async () => {
      mockReclamoRepo.findById.mockResolvedValue(reclamoMock);

      await expect(
        service.responderReclamo(locadorUser, 100, '    ')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El mensaje de respuesta no puede estar vacío.'
      });
    });

    it('debe fallar con 400 si el reclamo ya se encuentra resuelto o cancelado', async () => {
      mockReclamoRepo.findById.mockResolvedValue({
        ...reclamoMock,
        id_estado_reclamo: 3, // Resuelto
        estado: 'resuelto'
      });

      await expect(
        service.responderReclamo(locadorUser, 100, 'Ya fue arreglado.')
      ).rejects.toMatchObject({
        statusCode: 400,
        codigo: 'ESTADO_INVALIDO',
        message: 'Solo se puede responder a un reclamo que se encuentre en estado abierto o en proceso.'
      });
    });

    it('debe responder exitosamente a un reclamo abierto: pasar estado a en_proceso e iniciar conversación vinculada', async () => {
      mockReclamoRepo.findById.mockResolvedValue({
        ...reclamoMock,
        id_estado_reclamo: 1, // Abierto / Pendiente
        estado: 'pendiente'
      });
      mockConversacionRepo.findByReclamoId.mockResolvedValue(null); // No existe conversación previa
      mockConversacionRepo.create.mockResolvedValue(conversacionMock);
      const now = new Date().toISOString();
      mockMensajeRepo.create.mockResolvedValue({
        id: 201,
        id_conversacion: 50,
        id_emisor: 5,
        contenido: 'Hola Martín, voy a enviar al pintor mañana por la mañana.',
        fecha_envio: now,
        eliminado: false
      });
      mockMensajeRepo.findByConversacionId.mockResolvedValue([
        {
          id: 201,
          id_conversacion: 50,
          id_emisor: 5,
          contenido: 'Hola Martín, voy a enviar al pintor mañana por la mañana.',
          fecha_envio: now,
          eliminado: false
        }
      ]);

      const resultado = await service.responderReclamo(
        locadorUser,
        100,
        'Hola Martín, voy a enviar al pintor mañana por la mañana.'
      );

      // Verificar cambio de estado en BD
      expect(mockReclamoRepo.actualizarEstado).toHaveBeenCalledWith(100, 2);
      // Verificar creación de conversación vinculada
      expect(mockConversacionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id_locador: 5,
          id_locatario: 15,
          tipo_tema: 'reclamo',
          id_reclamo: 100
        })
      );
      // Verificar creación del mensaje
      expect(mockMensajeRepo.create).toHaveBeenCalledWith({
        id_conversacion: 50,
        id_emisor: 5,
        contenido: 'Hola Martín, voy a enviar al pintor mañana por la mañana.'
      });
      // Verificar reclamo original fijado en la respuesta
      expect(resultado.reclamo_original.id).toBe(100);
      expect(resultado.reclamo_original.descripcion).toBe(mensajeValido50Chars);
      expect(resultado.reclamo_original.fotos).toHaveLength(1);
      expect(resultado.mensajes).toHaveLength(1);
      expect(resultado.mensajes[0].contenido).toBe('Hola Martín, voy a enviar al pintor mañana por la mañana.');
    });

    it('debe responder a un reclamo en_proceso reutilizando la conversación existente sin crear una nueva', async () => {
      mockReclamoRepo.findById.mockResolvedValue({
        ...reclamoMock,
        id_estado_reclamo: 2, // Ya en proceso
        estado: 'en_proceso'
      });
      mockConversacionRepo.findByReclamoId.mockResolvedValue(conversacionMock); // Ya existe conversación
      const now = new Date().toISOString();
      mockMensajeRepo.create.mockResolvedValue({
        id: 202,
        id_conversacion: 50,
        id_emisor: 5,
        contenido: 'El pintor me confirmó que va a las 10hs.',
        fecha_envio: now,
        eliminado: false
      });
      mockMensajeRepo.findByConversacionId.mockResolvedValue([
        { id: 201, id_conversacion: 50, id_emisor: 5, contenido: 'Mensaje anterior', fecha_envio: now, eliminado: false },
        { id: 202, id_conversacion: 50, id_emisor: 5, contenido: 'El pintor me confirmó que va a las 10hs.', fecha_envio: now, eliminado: false }
      ]);

      const resultado = await service.responderReclamo(
        locadorUser,
        100,
        'El pintor me confirmó que va a las 10hs.'
      );

      // No debe actualizar estado porque ya estaba en proceso (id: 2)
      expect(mockReclamoRepo.actualizarEstado).not.toHaveBeenCalled();
      // No debe crear nueva conversación
      expect(mockConversacionRepo.create).not.toHaveBeenCalled();
      // Debe crear el mensaje en la conversación existente
      expect(mockMensajeRepo.create).toHaveBeenCalledWith({
        id_conversacion: 50,
        id_emisor: 5,
        contenido: 'El pintor me confirmó que va a las 10hs.'
      });
      expect(resultado.conversacion.id).toBe(50);
      expect(resultado.mensajes).toHaveLength(2);
    });

    it('debe permitir consultar la conversación del reclamo mostrando el reclamo original fijado', async () => {
      mockReclamoRepo.findById.mockResolvedValue({
        ...reclamoMock,
        id_estado_reclamo: 2,
        estado: 'en_proceso'
      });
      mockConversacionRepo.findByReclamoId.mockResolvedValue(conversacionMock);
      mockMensajeRepo.findByConversacionId.mockResolvedValue([]);

      const resultado = await service.obtenerConversacionReclamo(locatarioUser, 100);

      expect(resultado.reclamo_original.id).toBe(100);
      expect(resultado.reclamo_original.descripcion).toBe(mensajeValido50Chars);
      expect(resultado.reclamo_original.fotos).toHaveLength(1);
      expect(resultado.conversacion.id).toBe(50);
    });
  });
});
