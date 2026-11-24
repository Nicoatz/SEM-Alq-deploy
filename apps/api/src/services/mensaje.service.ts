import type {
  CrearConversacionRequest,
  ConversacionResponse,
  ConversacionDetalleResponse,
  MensajeResponse,
  TipoTemaConversacionDTO
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import {
  IConversacionRepository,
  conversacionRepository
} from '../repositories/conversacion.repository';
import {
  IMensajeRepository,
  mensajeRepository
} from '../repositories/mensaje.repository';
import { lookupRepository } from '../repositories/lookup.repository';
import { IInmuebleRepository, inmuebleRepository } from '../repositories/inmueble.repository';
import { IReclamoRepository, reclamoRepository } from '../repositories/reclamo.repository';

export class MensajeService {
  constructor(
    private readonly conversacionRepo: IConversacionRepository = conversacionRepository,
    private readonly mensajeRepo: IMensajeRepository = mensajeRepository,
    private readonly lookupRepo = lookupRepository,
    private readonly inmuebleRepo: Pick<IInmuebleRepository, 'findById'> = inmuebleRepository,
    private readonly reclamoRepo: Pick<IReclamoRepository, 'findById' | 'actualizarEstado'> = reclamoRepository
  ) {}

  private throwValidationError(message: string, statusCode = 400, codigo?: string): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (codigo) (error as any).codigo = codigo;
    throw error;
  }

  /**
   * Iniciar una nueva conversación (US-24).
   * - Un locatario puede iniciar conversación con un locador sin condiciones.
   * - Un locador NO puede iniciar conversación con un locatario a menos que exista un contrato de alquiler vigente entre ambos.
   */
  async iniciarConversacion(
    user: AuthenticatedUser,
    request: CrearConversacionRequest & { rol_iniciador?: 'locador' | 'locatario' }
  ): Promise<ConversacionResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para enviar mensajes.', 401);
    }

    if (!request.id_destinatario) {
      this.throwValidationError('Debe especificar el destinatario de la conversación.', 400);
    }

    if (request.id_destinatario === user.id) {
      this.throwValidationError('No puedes iniciar una conversación contigo mismo.', 400);
    }

    const asunto = request.asunto?.trim();
    if (!asunto) {
      this.throwValidationError('El asunto de la conversación no puede estar vacío.', 400);
    }

    if (request.primer_mensaje !== undefined && request.primer_mensaje.trim().length === 0) {
      this.throwValidationError('No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco.', 400);
    }

    // Verificar que el destinatario existe
    const destinatario = await this.lookupRepo.getUsuarioById(request.id_destinatario);
    if (!destinatario) {
      this.throwValidationError('El usuario destinatario no existe.', 404);
    }

    // Resolver roles de participantes para determinar quién es el locador y quién el locatario
    const rolesDestinatario = (await this.lookupRepo.getRolesByUsuarioId(request.id_destinatario)).map(r => r.descripcion);
    const rolesUsuario = user.roles || [];

    let idLocador: number;
    let idLocatario: number;
    let esLocadorIniciador = false;

    // Si viene asociado a un inmueble, el dueño del inmueble es el locador
    if (request.id_inmueble) {
      const inmueble = await this.inmuebleRepo.findById(request.id_inmueble);
      if (inmueble) {
        if (inmueble.id_locador === user.id) {
          idLocador = user.id;
          idLocatario = request.id_destinatario;
          esLocadorIniciador = true;
        } else {
          idLocador = inmueble.id_locador;
          idLocatario = user.id;
          esLocadorIniciador = false;
        }
      } else {
        idLocador = rolesDestinatario.includes('locador') ? request.id_destinatario : user.id;
        idLocatario = idLocador === user.id ? request.id_destinatario : user.id;
        esLocadorIniciador = idLocador === user.id;
      }
    } else if (request.rol_iniciador === 'locador' || (rolesUsuario.includes('locador') && !rolesDestinatario.includes('locador'))) {
      idLocador = user.id;
      idLocatario = request.id_destinatario;
      esLocadorIniciador = true;
    } else {
      idLocador = request.id_destinatario;
      idLocatario = user.id;
      esLocadorIniciador = false;
    }

    // Criterio US-24:
    // Si el locador es quien inicia la conversación, DEBE existir un contrato de alquiler vigente entre ambos
    if (esLocadorIniciador) {
      const tieneContratoVigente = await this.conversacionRepo.existeContratoVigente(idLocador, idLocatario);
      if (!tieneContratoVigente) {
        this.throwValidationError(
          'Un locador no puede iniciar una conversación con un locatario a menos que exista un contrato de alquiler vigente entre ambos.',
          403,
          'REQUIERE_CONTRATO_VIGENTE'
        );
      }
    }

    const tipoTema: TipoTemaConversacionDTO = request.tipo_tema || (request.id_reclamo ? 'reclamo' : request.id_inmueble ? 'inmueble' : 'general');

    const conversacion = await this.conversacionRepo.create({
      id_locador: idLocador,
      id_locatario: idLocatario,
      iniciado_por: user.id,
      tipo_tema: tipoTema,
      asunto,
      id_inmueble: request.id_inmueble ?? null,
      id_reclamo: request.id_reclamo ?? null,
      id_contrato: request.id_contrato ?? null
    });

    let ultimoMensaje = null;
    if (request.primer_mensaje && request.primer_mensaje.trim().length > 0) {
      const msg = await this.mensajeRepo.create({
        id_conversacion: conversacion.id,
        id_emisor: user.id,
        contenido: request.primer_mensaje.trim()
      });
      ultimoMensaje = {
        id: msg.id,
        contenido: msg.contenido,
        fecha_envio: msg.fecha_envio,
        id_emisor: msg.id_emisor,
        eliminado: msg.eliminado
      };
    }

    return {
      ...conversacion,
      otro_participante: {
        id: destinatario.id,
        nombre: destinatario.nombre,
        apellido: destinatario.apellido,
        email: destinatario.email,
        telefono: destinatario.telefono
      },
      ultimo_mensaje: ultimoMensaje,
      total_mensajes: ultimoMensaje ? 1 : 0
    };
  }

  /**
   * Listar todas las conversaciones del usuario autenticado (US-24).
   */
  async listarConversaciones(user: AuthenticatedUser): Promise<ConversacionResponse[]> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para ver sus conversaciones.', 401);
    }

    const conversaciones = await this.conversacionRepo.findByUsuarioId(user.id);

    // Adjuntar último mensaje a cada conversación
    const resultado = await Promise.all(
      conversaciones.map(async conv => {
        const mensajes = await this.mensajeRepo.findByConversacionId(conv.id, 1);
        const count = await this.mensajeRepo.countByConversacionId(conv.id);
        const ultimo = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;

        return {
          ...conv,
          ultimo_mensaje: ultimo ? {
            id: ultimo.id,
            contenido: ultimo.eliminado ? 'Este mensaje fue eliminado' : ultimo.contenido,
            fecha_envio: ultimo.fecha_envio,
            id_emisor: ultimo.id_emisor,
            eliminado: ultimo.eliminado
          } : null,
          total_mensajes: count
        };
      })
    );

    return resultado;
  }

  /**
   * Obtener detalle de una conversación (US-24).
   */
  async obtenerConversacion(
    user: AuthenticatedUser,
    idConversacion: number
  ): Promise<ConversacionDetalleResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para ver la conversación.', 401);
    }

    const conversacion = await this.conversacionRepo.findById(idConversacion);
    if (!conversacion) {
      this.throwValidationError('La conversación solicitada no existe.', 404);
    }

    if (conversacion.id_locador !== user.id && conversacion.id_locatario !== user.id) {
      this.throwValidationError('No tienes permiso para acceder a esta conversación.', 403);
    }

    conversacion.otro_participante = conversacion.id_locador === user.id
      ? conversacion.locatario
      : conversacion.locador;

    const count = await this.mensajeRepo.countByConversacionId(idConversacion);
    conversacion.total_mensajes = count;

    return conversacion;
  }

  /**
   * Listar mensajes de una conversación (hasta 100 mensajes ordenados cronológicamente) (US-24).
   */
  async listarMensajes(
    user: AuthenticatedUser,
    idConversacion: number
  ): Promise<MensajeResponse[]> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para ver los mensajes.', 401);
    }

    const conversacion = await this.conversacionRepo.findById(idConversacion);
    if (!conversacion) {
      this.throwValidationError('La conversación solicitada no existe.', 404);
    }

    if (conversacion.id_locador !== user.id && conversacion.id_locatario !== user.id) {
      this.throwValidationError('No tienes permiso para ver los mensajes de esta conversación.', 403);
    }

    // Hasta 100 mensajes cronológicamente ordenados
    const mensajes = await this.mensajeRepo.findByConversacionId(idConversacion, 100);

    return mensajes.map(m => ({
      ...m,
      contenido: m.eliminado ? 'Este mensaje fue eliminado' : m.contenido,
      es_propio: m.id_emisor === user.id,
      emisor: m.id_emisor === conversacion.locador.id ? conversacion.locador : conversacion.locatario
    }));
  }

  /**
   * Enviar un mensaje dentro de una conversación existente (US-24).
   * - No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco.
   * - Locador puede responder independientemente de si hay alquiler vigente si la conversación ya existe.
   * - Se conserva un historial de hasta 100 mensajes (descartando el más antiguo si se supera).
   */
  async enviarMensaje(
    user: AuthenticatedUser,
    idConversacion: number,
    contenido: string
  ): Promise<MensajeResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para enviar mensajes.', 401);
    }

    if (!contenido || typeof contenido !== 'string' || contenido.trim().length === 0) {
      this.throwValidationError('No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco.', 400);
    }

    const conversacion = await this.conversacionRepo.findById(idConversacion);
    if (!conversacion) {
      this.throwValidationError('La conversación solicitada no existe.', 404);
    }

    // Solo locador o locatario de la conversación pueden enviar mensajes
    if (conversacion.id_locador !== user.id && conversacion.id_locatario !== user.id) {
      this.throwValidationError('No tienes permiso para enviar mensajes en esta conversación.', 403);
    }

    let reclamoAbierto: number | null = null;
    if (
      conversacion.tipo_tema === 'reclamo' &&
      conversacion.id_reclamo &&
      conversacion.id_locador === user.id
    ) {
      const reclamo = await this.reclamoRepo.findById(conversacion.id_reclamo);
      if (!reclamo) {
        this.throwValidationError('El reclamo asociado a la conversación no existe.', 404);
      }

      if (reclamo.locador.id !== user.id) {
        this.throwValidationError(
          'Solo el locador dueño de la propiedad asociada puede responder al reclamo.',
          403,
          'SOLO_LOCADOR_PROPIETARIO'
        );
      }

      if (reclamo.id_estado_reclamo !== 1 && reclamo.id_estado_reclamo !== 2) {
        this.throwValidationError(
          'Solo se puede responder a un reclamo que se encuentre en estado abierto o en proceso.',
          400,
          'ESTADO_INVALIDO'
        );
      }

      if (reclamo.id_estado_reclamo === 1) {
        reclamoAbierto = reclamo.id;
      }
    }

    const nuevoMensaje = await this.mensajeRepo.create({
      id_conversacion: idConversacion,
      id_emisor: user.id,
      contenido: contenido.trim()
    });

    if (reclamoAbierto !== null) {
      await this.reclamoRepo.actualizarEstado(reclamoAbierto, 2);
    }

    // Actualizar actividad y asegurar poda a 100 mensajes
    await this.conversacionRepo.actualizarFechaActividad(idConversacion);
    await this.mensajeRepo.podarMensajesAntiguos(idConversacion, 100);

    return {
      ...nuevoMensaje,
      es_propio: true,
      emisor: user.id === conversacion.locador.id ? conversacion.locador : conversacion.locatario
    };
  }

  /**
   * Eliminar un mensaje propio ya enviado (US-24).
   * - Un usuario no puede eliminar mensajes enviados por el otro participante.
   */
  async eliminarMensaje(user: AuthenticatedUser, idMensaje: number): Promise<void> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para eliminar mensajes.', 401);
    }

    const mensaje = await this.mensajeRepo.findById(idMensaje);
    if (!mensaje) {
      this.throwValidationError('El mensaje solicitado no existe.', 404);
    }

    if (mensaje.id_emisor !== user.id) {
      this.throwValidationError('No puedes eliminar mensajes enviados por el otro participante.', 403);
    }

    await this.mensajeRepo.marcarEliminado(idMensaje);
  }
}

export const mensajeService = new MensajeService();
