import { MensajeService } from '../../src/services/mensaje.service';
import type { IConversacionRepository } from '../../src/repositories/conversacion.repository';
import type { IMensajeRepository } from '../../src/repositories/mensaje.repository';
import type { AuthenticatedUser } from '../../src/gateway/middlewares/auth.middleware';
import type { ConversacionDTO, MensajeDTO, ConversacionDetalleResponse } from '../../src/dtos';

describe('US-24: Enviar mensajes (MensajeService Unit Tests)', () => {
  let service: MensajeService;
  let mockConversacionRepo: jest.Mocked<IConversacionRepository>;
  let mockMensajeRepo: jest.Mocked<IMensajeRepository>;
  let mockLookupRepo: any;
  let mockInmuebleRepo: any;

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

    service = new MensajeService(
      mockConversacionRepo,
      mockMensajeRepo,
      mockLookupRepo,
      mockInmuebleRepo
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

      expect(resultado.id).toBe(1);
      expect(resultado.iniciado_por).toBe(10);
      expect(resultado.id_locador).toBe(20);
      expect(resultado.id_locatario).toBe(10);
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

      expect(resultado.id).toBe(2);
      expect(resultado.iniciado_por).toBe(20);
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

      expect(resultado.ultimo_mensaje?.contenido).toBe('Hola, quería consultar si se aceptan mascotas pequeñas.');
      expect(resultado.total_mensajes).toBe(1);
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

      await service.eliminarMensaje(locatarioUser, 88);

      expect(mockMensajeRepo.marcarEliminado).toHaveBeenCalledWith(88);
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
