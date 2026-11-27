import { MensajeService } from '../../src/services/mensaje.service';
import type { IConversacionRepository } from '../../src/repositories/conversacion.repository';
import type { IMensajeRepository } from '../../src/repositories/mensaje.repository';
import type { IReclamoRepository } from '../../src/repositories/reclamo.repository';
import type { AuthenticatedUser } from '../../src/gateway/middlewares/auth.middleware';
import type { ConversacionDTO, ConversacionResponse, MensajeDTO, ConversacionDetalleResponse } from '../../src/dtos';

describe('US-24: Enviar mensajes (MensajeService Unit Tests)', () => {
  let service: MensajeService;
  let mockConversacionRepo: jest.Mocked<IConversacionRepository>;
  let mockMensajeRepo: jest.Mocked<IMensajeRepository>;
  let mockLookupRepo: any;
  let mockInmuebleRepo: any;
  let mockReclamoRepo: jest.Mocked<Pick<IReclamoRepository, 'findById'>>;

  const locatarioUser: AuthenticatedUser = {
    id: 10,
    nombre: 'Lucas',
    apellido: 'Locatario',
    email: 'lucas@example.test',
    numero_documento: '38123456',
    roles: ['locatario'],
    authUserId: 'uuid-locatario-10'
  };

  const locadorUser: AuthenticatedUser = {
    id: 20,
    nombre: 'Laura',
    apellido: 'Locadora',
    email: 'laura@example.test',
    numero_documento: '28123456',
    roles: ['locador', 'locatario'],
    authUserId: 'uuid-locador-20'
  };

  const terceroUser: AuthenticatedUser = {
    id: 99,
    nombre: 'Tercero',
    apellido: 'Intruso',
    email: 'tercero@example.test',
    numero_documento: '30123456',
    roles: ['locatario'],
    authUserId: 'uuid-tercero-99'
  };

  beforeEach(() => {
    mockConversacionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUsuarioId: jest.fn(),
      findActivaPorParticipantesEInmueble: jest.fn(),
      findByReclamoId: jest.fn(),
      existeContratoVigente: jest.fn(),
      actualizarFechaActividad: jest.fn()
    };

    mockMensajeRepo = {
      create: jest.fn(),
      createEnConversacionReclamo: jest.fn(),
      findResumenPorConversacionIds: jest.fn(),
      findByConversacionId: jest.fn(),
      findById: jest.fn(),
      marcarEliminado: jest.fn(),
      marcarEliminadoEnConversacionReclamo: jest.fn(),
      countByConversacionId: jest.fn().mockResolvedValue(0),
      podarMensajesAntiguos: jest.fn()
    };

    mockLookupRepo = {
      getUsuarioById: jest.fn().mockImplementation((id: number) => {
        if (id === 10) return Promise.resolve({ id: 10, nombre: 'Lucas', apellido: 'Locatario', email: 'lucas@example.test' });
        if (id === 20) return Promise.resolve({ id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' });
        return Promise.resolve(null);
      }),
      getRolesByUsuarioId: jest.fn().mockImplementation((id: number) => {
        if (id === 10) return Promise.resolve([{ id: 1, descripcion: 'locatario' }]);
        if (id === 20) return Promise.resolve([{ id: 1, descripcion: 'locatario' }, { id: 2, descripcion: 'locador' }]);
        return Promise.resolve([]);
      })
    };

    mockInmuebleRepo = {
      findById: jest.fn()
    };

    mockReclamoRepo = {
      findById: jest.fn()
    };

    service = new MensajeService(
      mockConversacionRepo,
      mockMensajeRepo,
      mockLookupRepo,
      mockInmuebleRepo,
      mockReclamoRepo
    );
  });

  describe('Iniciar Conversación', () => {
    it('debe fallar con 401 si no se ha iniciado sesión', async () => {
      await expect(
        service.iniciarConversacion(null as any, { id_destinatario: 20, asunto: 'Consulta' })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Debe iniciar sesión para enviar mensajes.'
      });
    });

    it('debe fallar con 400 si se intenta iniciar conversación consigo mismo', async () => {
      await expect(
        service.iniciarConversacion(locatarioUser, { id_destinatario: 10, asunto: 'Auto-conversación' })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'No puedes iniciar una conversación contigo mismo.'
      });
    });

    it('debe fallar con 400 si el asunto está vacío', async () => {
      await expect(
        service.iniciarConversacion(locatarioUser, { id_destinatario: 20, asunto: '   ' })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'El asunto de la conversación no puede estar vacío.'
      });
    });

    it('debe fallar con 404 si la propiedad asociada no existe', async () => {
      mockInmuebleRepo.findById.mockResolvedValue(null);

      await expect(service.iniciarConversacion(locatarioUser, {
        id_destinatario: 20,
        asunto: 'Consulta sobre la propiedad',
        id_inmueble: 999
      })).rejects.toMatchObject({ statusCode: 404 });

      expect(mockConversacionRepo.create).not.toHaveBeenCalled();
    });

    it('debe permitir que un locatario inicie conversación con un locador sin tener contrato vigente', async () => {
      const convCreada: ConversacionDTO = {
        id: 1,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 10,
        tipo_tema: 'general',
        asunto: 'Consulta sobre departamento',
        id_inmueble: null,
        id_reclamo: null,
        id_contrato: null,
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
      };
      mockConversacionRepo.create.mockResolvedValue(convCreada);

      const resultado = await service.iniciarConversacion(locatarioUser, {
        id_destinatario: 20,
        asunto: 'Consulta sobre departamento'
      });

      expect(resultado.conversacion.id).toBe(1);
      expect(resultado.conversacion.iniciado_por).toBe(10);
      expect(resultado.conversacion.id_locador).toBe(20);
      expect(resultado.conversacion.id_locatario).toBe(10);
      expect(resultado.creada).toBe(true);
      // No debe consultar contrato vigente porque inicia el locatario
      expect(mockConversacionRepo.existeContratoVigente).not.toHaveBeenCalled();
      expect(mockConversacionRepo.create).toHaveBeenCalled();
    });

    it('debe fallar con 403 si un locador intenta iniciar conversación con un locatario sin contrato vigente', async () => {
      mockConversacionRepo.existeContratoVigente.mockResolvedValue(false);

      await expect(
        service.iniciarConversacion(locadorUser, {
          id_destinatario: 10,
          asunto: 'Aviso importante',
          rol_iniciador: 'locador'
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        codigo: 'REQUIERE_CONTRATO_VIGENTE'
      });

      expect(mockConversacionRepo.existeContratoVigente).toHaveBeenCalledWith(20, 10);
      expect(mockConversacionRepo.create).not.toHaveBeenCalled();
    });

    it('debe permitir que un locador inicie conversación con un locatario si existe contrato vigente', async () => {
      mockConversacionRepo.existeContratoVigente.mockResolvedValue(true);
      const convCreada: ConversacionDTO = {
        id: 2,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 20,
        tipo_tema: 'general',
        asunto: 'Notificación de expensas',
        id_inmueble: null,
        id_reclamo: null,
        id_contrato: null,
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
      };
      mockConversacionRepo.create.mockResolvedValue(convCreada);

      const resultado = await service.iniciarConversacion(locadorUser, {
        id_destinatario: 10,
        asunto: 'Notificación de expensas',
        rol_iniciador: 'locador'
      });

      expect(resultado.conversacion.id).toBe(2);
      expect(resultado.conversacion.iniciado_por).toBe(20);
      expect(mockConversacionRepo.existeContratoVigente).toHaveBeenCalledWith(20, 10);
      expect(mockConversacionRepo.create).toHaveBeenCalled();
    });

    it('debe permitir enviar el primer mensaje en la misma operación de creación', async () => {
      const convCreada: ConversacionDTO = {
        id: 3,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 10,
        tipo_tema: 'inmueble',
        asunto: '¿Aceptan mascotas?',
        id_inmueble: 5,
        id_reclamo: null,
        id_contrato: null,
        activo: true,
        fecha_creacion: '2026-11-24T18:00:00Z',
        fecha_actualizacion: '2026-11-24T18:00:00Z'
      };
      mockConversacionRepo.create.mockResolvedValue(convCreada);
      mockInmuebleRepo.findById.mockResolvedValue({ id: 5, id_locador: 20 });
      mockMensajeRepo.countByConversacionId.mockResolvedValue(1);
      mockMensajeRepo.create.mockResolvedValue({
        id: 101,
        id_conversacion: 3,
        id_emisor: 10,
        contenido: 'Hola, quería consultar si se aceptan mascotas pequeñas.',
        fecha_envio: '2026-11-24T18:00:00Z',
        eliminado: false
      });

      const resultado = await service.iniciarConversacion(locatarioUser, {
        id_destinatario: 20,
        id_inmueble: 5,
        asunto: '¿Aceptan mascotas?',
        primer_mensaje: 'Hola, quería consultar si se aceptan mascotas pequeñas.'
      });

      expect(resultado.conversacion.ultimo_mensaje?.contenido).toBe('Hola, quería consultar si se aceptan mascotas pequeñas.');
      expect(resultado.conversacion.total_mensajes).toBe(1);
    });

    it('debe devolver la conversación activa existente sin crear otra', async () => {
      const conversacionExistente: ConversacionResponse = {
        id: 9,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 10,
        tipo_tema: 'inmueble',
        asunto: 'Consulta previa',
        id_inmueble: 5,
        id_reclamo: null,
        id_contrato: null,
        activo: true,
        fecha_creacion: '2026-11-24T10:00:00Z',
        fecha_actualizacion: '2026-11-24T10:00:00Z',
        otro_participante: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' }
      };
      mockInmuebleRepo.findById.mockResolvedValue({ id: 5, id_locador: 20 });
      mockConversacionRepo.findActivaPorParticipantesEInmueble.mockResolvedValue(conversacionExistente);
      mockMensajeRepo.findByConversacionId.mockResolvedValue([]);
      mockMensajeRepo.countByConversacionId.mockResolvedValue(4);

      const resultado = await service.iniciarConversacion(locatarioUser, {
        id_destinatario: 20,
        id_inmueble: 5,
        asunto: 'Nueva consulta'
      });

      expect(resultado.creada).toBe(false);
      expect(resultado.conversacion.id).toBe(9);
      expect(resultado.conversacion.total_mensajes).toBe(4);
      expect(mockConversacionRepo.create).not.toHaveBeenCalled();
    });

    it('debe fallar si el primer mensaje contiene únicamente espacios en blanco', async () => {
      await expect(
        service.iniciarConversacion(locatarioUser, {
          id_destinatario: 20,
          asunto: 'Consulta',
          primer_mensaje: '    '
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco.'
      });
    });
  });

  describe('Enviar Mensaje en conversación existente', () => {
    const conversacionMock: ConversacionDetalleResponse = {
      id: 1,
      id_locador: 20,
      id_locatario: 10,
      iniciado_por: 10,
      tipo_tema: 'general',
      asunto: 'Consulta inicial',
      activo: true,
      fecha_creacion: '2026-11-24T10:00:00Z',
      fecha_actualizacion: '2026-11-24T10:00:00Z',
      locador: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' },
      locatario: { id: 10, nombre: 'Lucas', apellido: 'Locatario', email: 'lucas@example.test' },
      otro_participante: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' }
    };

    it('debe permitir que el locador responda en una conversación iniciada por el locatario sin verificar alquiler vigente', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);
      const now = new Date().toISOString();
      mockMensajeRepo.create.mockResolvedValue({
        id: 50,
        id_conversacion: 1,
        id_emisor: 20,
        contenido: 'Hola Lucas, sí, está disponible.',
        fecha_envio: now,
        eliminado: false
      });

      const resultado = await service.enviarMensaje(locadorUser, 1, 'Hola Lucas, sí, está disponible.');

      expect(resultado.id).toBe(50);
      expect(resultado.contenido).toBe('Hola Lucas, sí, está disponible.');
      expect(resultado.es_propio).toBe(true);
      expect(mockConversacionRepo.existeContratoVigente).not.toHaveBeenCalled();
      expect(mockMensajeRepo.podarMensajesAntiguos).toHaveBeenCalledWith(1, 100);
    });

    it('debe fallar con 400 si el mensaje está vacío o contiene solo espacios', async () => {
      await expect(
        service.enviarMensaje(locatarioUser, 1, '   ')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco.'
      });
    });

    it('debe fallar con 403 si un usuario ajeno a la conversación intenta enviar un mensaje', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);

      await expect(
        service.enviarMensaje(terceroUser, 1, 'Mensaje intruso')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'No tienes permiso para enviar mensajes en esta conversación.'
      });
    });

    it('debe registrar y retornar la fecha y hora de envío exacta', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);
      const fechaEnvio = '2026-11-24T18:30:15.123Z';
      mockMensajeRepo.create.mockResolvedValue({
        id: 51,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Perfecto, gracias.',
        fecha_envio: fechaEnvio,
        eliminado: false
      });

      const resultado = await service.enviarMensaje(locatarioUser, 1, 'Perfecto, gracias.');

      expect(resultado.fecha_envio).toBe(fechaEnvio);
    });

    it('debe usar el envío transaccional del reclamo al responder su locador', async () => {
      mockConversacionRepo.findById.mockResolvedValue({
        ...conversacionMock,
        tipo_tema: 'reclamo',
        id_reclamo: 100
      });
      mockReclamoRepo.findById.mockResolvedValue({
        id: 100,
        id_locatario: 10,
        id_estado_reclamo: 1,
        locador: { id: 20 }
      } as any);
      mockMensajeRepo.createEnConversacionReclamo.mockResolvedValue({
        id: 52,
        id_conversacion: 1,
        id_emisor: 20,
        contenido: 'Voy a coordinar la reparación.',
        fecha_envio: '2026-11-24T18:35:00Z',
        eliminado: false
      });

      await service.enviarMensaje(locadorUser, 1, 'Voy a coordinar la reparación.');

      expect(mockMensajeRepo.createEnConversacionReclamo).toHaveBeenCalledWith({
        id_conversacion: 1,
        id_emisor: 20,
        contenido: 'Voy a coordinar la reparación.'
      });
      expect(mockMensajeRepo.create).not.toHaveBeenCalled();
      expect(mockMensajeRepo.podarMensajesAntiguos).not.toHaveBeenCalled();
    });

    it('no debe actualizar el estado del reclamo cuando escribe el locatario', async () => {
      mockConversacionRepo.findById.mockResolvedValue({
        ...conversacionMock,
        tipo_tema: 'reclamo',
        id_reclamo: 100
      });
      mockReclamoRepo.findById.mockResolvedValue({
        id: 100,
        id_locatario: 10,
        id_estado_reclamo: 2,
        locador: { id: 20 }
      } as any);
      mockMensajeRepo.create.mockResolvedValue({
        id: 53,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Gracias por responder.',
        fecha_envio: '2026-11-24T18:36:00Z',
        eliminado: false
      });
      mockMensajeRepo.createEnConversacionReclamo.mockResolvedValue({
        id: 53,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Gracias por responder.',
        fecha_envio: '2026-11-24T18:36:00Z',
        eliminado: false
      });

      await service.enviarMensaje(locatarioUser, 1, 'Gracias por responder.');

      expect(mockReclamoRepo.findById).toHaveBeenCalledWith(100);
      expect(mockMensajeRepo.createEnConversacionReclamo).toHaveBeenCalled();
    });

    it.each([3, 4])('debe rechazar al locador si el reclamo está en estado %i', async estado => {
      mockConversacionRepo.findById.mockResolvedValue({
        ...conversacionMock,
        tipo_tema: 'reclamo',
        id_reclamo: 100
      });
      mockReclamoRepo.findById.mockResolvedValue({
        id: 100,
        id_locatario: 10,
        id_estado_reclamo: estado,
        locador: { id: 20 }
      } as any);

      await expect(
        service.enviarMensaje(locadorUser, 1, 'Mensaje posterior al cierre.')
      ).rejects.toMatchObject({
        statusCode: 409,
        codigo: 'ESTADO_INVALIDO'
      });

      expect(mockMensajeRepo.create).not.toHaveBeenCalled();
      expect(mockMensajeRepo.createEnConversacionReclamo).not.toHaveBeenCalled();
    });

    it.each([1, 3, 4])('debe impedir que el locatario escriba si el reclamo está en estado %i', async estado => {
      mockConversacionRepo.findById.mockResolvedValue({
        ...conversacionMock,
        tipo_tema: 'reclamo',
        id_reclamo: 100
      });
      mockReclamoRepo.findById.mockResolvedValue({
        id: 100,
        id_locatario: 10,
        id_estado_reclamo: estado,
        locador: { id: 20 }
      } as any);

      await expect(
        service.enviarMensaje(locatarioUser, 1, '¿Hay novedades?')
      ).rejects.toMatchObject({ statusCode: 409, codigo: 'ESTADO_INVALIDO' });
      expect(mockMensajeRepo.createEnConversacionReclamo).not.toHaveBeenCalled();
    });

    it('debe permitir que el locatario escriba cuando el reclamo está en proceso', async () => {
      mockConversacionRepo.findById.mockResolvedValue({
        ...conversacionMock,
        tipo_tema: 'reclamo',
        id_reclamo: 100
      });
      mockReclamoRepo.findById.mockResolvedValue({
        id: 100,
        id_locatario: 10,
        id_estado_reclamo: 2,
        locador: { id: 20 }
      } as any);
      mockMensajeRepo.createEnConversacionReclamo.mockResolvedValue({
        id: 54,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Gracias por la actualización.',
        fecha_envio: '2026-11-25T10:00:00Z',
        eliminado: false
      });

      const mensaje = await service.enviarMensaje(locatarioUser, 1, 'Gracias por la actualización.');

      expect(mensaje.id).toBe(54);
      expect(mockMensajeRepo.createEnConversacionReclamo).toHaveBeenCalled();
    });
  });

  describe('Eliminar Mensaje', () => {
    it('debe permitir eliminar un mensaje propio ya enviado', async () => {
      const mensajePropio: MensajeDTO = {
        id: 88,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Mensaje que quiero borrar',
        fecha_envio: '2026-11-24T12:00:00Z',
        eliminado: false
      };
      mockMensajeRepo.findById.mockResolvedValue(mensajePropio);
      mockConversacionRepo.findById.mockResolvedValue({
        id: 1,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 10,
        tipo_tema: 'general',
        asunto: 'Consulta',
        activo: true,
        fecha_creacion: '2026-11-24T10:00:00Z',
        fecha_actualizacion: '2026-11-24T10:00:00Z',
        locador: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' },
        locatario: { id: 10, nombre: 'Lucas', apellido: 'Locatario', email: 'lucas@example.test' },
        otro_participante: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' }
      });

      await service.eliminarMensaje(locatarioUser, 88);

      expect(mockMensajeRepo.marcarEliminado).toHaveBeenCalledWith(88);
    });

    it('debe usar la operación protegida de reclamo al borrar un mensaje propio', async () => {
      mockMensajeRepo.findById.mockResolvedValue({
        id: 90,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Mensaje del locatario',
        fecha_envio: '2026-11-24T12:00:00Z',
        eliminado: false
      });
      mockConversacionRepo.findById.mockResolvedValue({
        id: 1,
        id_locador: 20,
        id_locatario: 10,
        iniciado_por: 10,
        tipo_tema: 'reclamo',
        id_reclamo: 100,
        asunto: 'Reclamo',
        activo: true,
        fecha_creacion: '2026-11-24T10:00:00Z',
        fecha_actualizacion: '2026-11-24T10:00:00Z',
        locador: { id: 20, nombre: 'Laura', email: 'laura@example.test' },
        locatario: { id: 10, nombre: 'Lucas', email: 'lucas@example.test' },
        otro_participante: { id: 20, nombre: 'Laura', email: 'laura@example.test' }
      });

      await service.eliminarMensaje(locatarioUser, 90);

      expect(mockMensajeRepo.marcarEliminadoEnConversacionReclamo).toHaveBeenCalledWith(90, 10);
      expect(mockMensajeRepo.marcarEliminado).not.toHaveBeenCalled();
    });

    it('debe fallar con 403 si un usuario intenta eliminar un mensaje enviado por la otra parte', async () => {
      const mensajeDeLaura: MensajeDTO = {
        id: 89,
        id_conversacion: 1,
        id_emisor: 20, // Enviado por Laura (locador)
        contenido: 'Mensaje de Laura',
        fecha_envio: '2026-11-24T12:05:00Z',
        eliminado: false
      };
      mockMensajeRepo.findById.mockResolvedValue(mensajeDeLaura);

      await expect(
        service.eliminarMensaje(locatarioUser, 89) // Intenta eliminar Lucas (locatario)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'No puedes eliminar mensajes enviados por el otro participante.'
      });

      expect(mockMensajeRepo.marcarEliminado).not.toHaveBeenCalled();
    });

    it('debe fallar con 404 si el mensaje no existe', async () => {
      mockMensajeRepo.findById.mockResolvedValue(null);

      await expect(
        service.eliminarMensaje(locatarioUser, 999)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'El mensaje solicitado no existe.'
      });
    });

    it('debe fallar con 409 si el mensaje ya estaba eliminado', async () => {
      mockMensajeRepo.findById.mockResolvedValue({
        id: 91,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Mensaje ya eliminado',
        fecha_envio: '2026-11-24T12:00:00Z',
        eliminado: true
      });

      await expect(service.eliminarMensaje(locatarioUser, 91)).rejects.toMatchObject({
        statusCode: 409,
        codigo: 'MENSAJE_YA_ELIMINADO'
      });
      expect(mockMensajeRepo.marcarEliminado).not.toHaveBeenCalled();
      expect(mockMensajeRepo.marcarEliminadoEnConversacionReclamo).not.toHaveBeenCalled();
    });
  });

  describe('Historial y Límite de 100 mensajes', () => {
    const conversacionMock: ConversacionDetalleResponse = {
      id: 1,
      id_locador: 20,
      id_locatario: 10,
      iniciado_por: 10,
      tipo_tema: 'general',
      asunto: 'Historial largo',
      activo: true,
      fecha_creacion: '2026-11-24T10:00:00Z',
      fecha_actualizacion: '2026-11-24T10:00:00Z',
      locador: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' },
      locatario: { id: 10, nombre: 'Lucas', apellido: 'Locatario', email: 'lucas@example.test' },
      otro_participante: { id: 20, nombre: 'Laura', apellido: 'Locadora', email: 'laura@example.test' }
    };

    it('debe pedir un límite de 100 mensajes al repositorio al listar', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);
      mockMensajeRepo.findByConversacionId.mockResolvedValue([]);

      await service.listarMensajes(locatarioUser, 1);

      expect(mockMensajeRepo.findByConversacionId).toHaveBeenCalledWith(1, 100);
    });

    it('debe resumir todas las conversaciones con una sola consulta de mensajes por lote', async () => {
      const conversaciones: ConversacionResponse[] = [
        {
          id: 1,
          id_locador: 20,
          id_locatario: 10,
          iniciado_por: 10,
          tipo_tema: 'general',
          asunto: 'Primera',
          activo: true,
          fecha_creacion: '2026-11-24T10:00:00Z',
          fecha_actualizacion: '2026-11-24T10:00:00Z',
          otro_participante: { id: 20, nombre: 'Laura', email: 'laura@example.test' }
        },
        {
          id: 2,
          id_locador: 20,
          id_locatario: 10,
          iniciado_por: 10,
          tipo_tema: 'inmueble',
          asunto: 'Segunda',
          activo: true,
          fecha_creacion: '2026-11-24T11:00:00Z',
          fecha_actualizacion: '2026-11-24T11:00:00Z',
          otro_participante: { id: 20, nombre: 'Laura', email: 'laura@example.test' }
        }
      ];
      mockConversacionRepo.findByUsuarioId.mockResolvedValue(conversaciones);
      mockMensajeRepo.findResumenPorConversacionIds.mockResolvedValue([
        {
          id_conversacion: 1,
          total_mensajes: 2,
          ultimo_id: 2,
          ultimo_contenido: 'Último',
          ultimo_fecha_envio: '2026-11-24T10:02:00Z',
          ultimo_id_emisor: 20,
          ultimo_eliminado: false
        },
        {
          id_conversacion: 2,
          total_mensajes: 1,
          ultimo_id: 3,
          ultimo_contenido: 'Único',
          ultimo_fecha_envio: '2026-11-24T11:01:00Z',
          ultimo_id_emisor: 10,
          ultimo_eliminado: false
        }
      ]);

      const resultado = await service.listarConversaciones(locatarioUser);

      expect(mockMensajeRepo.findResumenPorConversacionIds).toHaveBeenCalledTimes(1);
      expect(mockMensajeRepo.findResumenPorConversacionIds).toHaveBeenCalledWith([1, 2]);
      expect(mockMensajeRepo.findByConversacionId).not.toHaveBeenCalled();
      expect(mockMensajeRepo.countByConversacionId).not.toHaveBeenCalled();
      expect(resultado[0].ultimo_mensaje?.contenido).toBe('Último');
      expect(resultado[0].total_mensajes).toBe(2);
      expect(resultado[1].total_mensajes).toBe(1);
    });

    it('debe solicitar la poda de mensajes antiguos manteniendo 100 al enviar un nuevo mensaje', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);
      mockMensajeRepo.create.mockResolvedValue({
        id: 101,
        id_conversacion: 1,
        id_emisor: 10,
        contenido: 'Mensaje 101',
        fecha_envio: new Date().toISOString(),
        eliminado: false
      });

      await service.enviarMensaje(locatarioUser, 1, 'Mensaje 101');

      expect(mockMensajeRepo.podarMensajesAntiguos).toHaveBeenCalledWith(1, 100);
    });

    it('debe ocultar el contenido de mensajes eliminados al listarlos', async () => {
      mockConversacionRepo.findById.mockResolvedValue(conversacionMock);
      mockMensajeRepo.findByConversacionId.mockResolvedValue([
        {
          id: 1,
          id_conversacion: 1,
          id_emisor: 10,
          contenido: 'Texto original confidencial',
          fecha_envio: '2026-11-24T10:01:00Z',
          eliminado: true,
          fecha_eliminacion: '2026-11-24T10:05:00Z'
        },
        {
          id: 2,
          id_conversacion: 1,
          id_emisor: 20,
          contenido: 'Respuesta visible',
          fecha_envio: '2026-11-24T10:06:00Z',
          eliminado: false
        }
      ]);

      const mensajes = await service.listarMensajes(locatarioUser, 1);

      expect(mensajes[0].contenido).toBe('Este mensaje fue eliminado');
      expect(mensajes[0].eliminado).toBe(true);
      expect(mensajes[1].contenido).toBe('Respuesta visible');
      expect(mensajes[1].eliminado).toBe(false);
    });
  });
});
