import type {
  CrearConversacionRequest,
  ConversacionDTO,
  ConversacionResponse,
  ConversacionDetalleResponse,
  MensajeDTO,
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

export interface IniciarConversacionResultado {
  conversacion: ConversacionResponse;
  creada: boolean;
}

export class MensajeService {
  constructor(
    private readonly conversacionRepo: IConversacionRepository = conversacionRepository,
    private readonly mensajeRepo: IMensajeRepository = mensajeRepository,
    private readonly lookupRepo = lookupRepository,
    private readonly inmuebleRepo: Pick<IInmuebleRepository, 'findById'> = inmuebleRepository,
    private readonly reclamoRepo: Pick<IReclamoRepository, 'findById'> = reclamoRepository
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
  ): Promise<IniciarConversacionResultado> {
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

    for (const [campo, valor] of Object.entries({
      id_inmueble: request.id_inmueble,
      id_reclamo: request.id_reclamo,
      id_contrato: request.id_contrato
    })) {
      if (valor !== undefined && (!Number.isInteger(valor) || valor < 1)) {
        this.throwValidationError(`El identificador de ${campo.replace('id_', '')} no es válido.`, 400);
      }
    }

    const inmuebleSolicitado = request.id_inmueble === undefined
      ? null
      : await this.inmuebleRepo.findById(request.id_inmueble);
    if (request.id_inmueble !== undefined && !inmuebleSolicitado) {
      this.throwValidationError('La propiedad asociada a la conversación no existe.', 404);
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

    // Los participantes de un chat de reclamo salen del reclamo, no de la heurística de roles.
    if (request.id_reclamo !== undefined) {
      const reclamo = await this.reclamoRepo.findById(request.id_reclamo);
      if (!reclamo) {
        this.throwValidationError('El reclamo asociado no existe.', 404);
      }

      if (user.id === reclamo.locador.id) {
        idLocador = reclamo.locador.id;
        idLocatario = reclamo.id_locatario;
      } else if (user.id === reclamo.id_locatario) {
        idLocador = reclamo.locador.id;
        idLocatario = reclamo.id_locatario;
      } else {
        this.throwValidationError('No participas en el reclamo indicado.', 403);
      }

      const destinatarioEsperado = user.id === idLocador ? idLocatario : idLocador;
      if (request.id_destinatario !== destinatarioEsperado) {
        this.throwValidationError('El destinatario no es la otra parte del reclamo.', 403);
      }
    // Si viene asociado a un inmueble, el dueño del inmueble es el locador.
    } else if (request.id_inmueble) {
      const inmueble = inmuebleSolicitado;
      if (!inmueble) {
        this.throwValidationError('La propiedad asociada a la conversación no existe.', 404);
      }

      if (inmueble.id_locador === user.id) {
        idLocador = user.id;
        idLocatario = request.id_destinatario;
        esLocadorIniciador = true;
      } else {
        if (inmueble.id_locador !== request.id_destinatario) {
          this.throwValidationError('El destinatario no es el locador de la propiedad indicada.', 400);
        }
        idLocador = inmueble.id_locador;
        idLocatario = user.id;
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

    const tipoTema: TipoTemaConversacionDTO = request.tipo_tema || (request.id_reclamo ? 'reclamo' : request.id_inmueble ? 'inmueble' : 'general');

    if (request.id_reclamo !== undefined || tipoTema === 'reclamo') {
      if (request.id_reclamo === undefined || tipoTema !== 'reclamo') {
        this.throwValidationError('Los chats de reclamo se crean al registrar el reclamo.', 400);
      }

      const reclamo = await this.reclamoRepo.findById(request.id_reclamo);
      if (!reclamo) {
        this.throwValidationError('El reclamo asociado no existe.', 404);
      }

      if (
        reclamo.locador.id !== idLocador ||
        reclamo.id_locatario !== idLocatario ||
        (request.id_inmueble !== undefined && request.id_inmueble !== reclamo.id_inmueble) ||
        (request.id_contrato !== undefined && request.id_contrato !== reclamo.id_contrato)
      ) {
        this.throwValidationError('El reclamo no corresponde a los participantes o referencias indicados.', 403);
      }

      const conversacionExistente = await this.conversacionRepo.findByReclamoId(request.id_reclamo);
      if (!conversacionExistente) {
        this.throwValidationError('No existe una conversación asociada a este reclamo.', 404);
      }

      if (conversacionExistente.id_locador !== user.id && conversacionExistente.id_locatario !== user.id) {
        this.throwValidationError('No tienes permiso para acceder a la conversación del reclamo.', 403);
      }

      const otroId = conversacionExistente.id_locador === user.id
        ? conversacionExistente.id_locatario
        : conversacionExistente.id_locador;
      const otroUsuario = await this.lookupRepo.getUsuarioById(otroId);
      if (!otroUsuario) this.throwValidationError('El otro participante de la conversación no existe.', 404);

      const conversacion = {
        ...conversacionExistente,
        otro_participante: {
          id: otroUsuario.id,
          nombre: otroUsuario.nombre,
          apellido: otroUsuario.apellido,
          email: otroUsuario.email,
          telefono: otroUsuario.telefono
        }
      };

      return this.completarInicioConversacion(user, conversacion, false, request.primer_mensaje);
    }

    if (request.id_contrato !== undefined) {
      const contratoValido = await this.conversacionRepo.existeContratoVigente(
        idLocador,
        idLocatario,
        request.id_contrato,
        request.id_inmueble
      );
      if (!contratoValido) {
        this.throwValidationError('El contrato no está vigente entre los participantes y la propiedad indicada.', 403, 'CONTRATO_NO_VALIDO');
      }
    }

    const conversacionExistente = await this.conversacionRepo.findActivaPorParticipantesEInmueble(
      idLocador,
      idLocatario,
      request.id_inmueble ?? null
    );
    if (conversacionExistente) {
      return this.completarInicioConversacion(user, conversacionExistente, false, request.primer_mensaje);
    }

    // Un locador puede crear una conversación nueva solo con un contrato vigente.
    if (esLocadorIniciador && request.id_contrato === undefined) {
      const tieneContratoVigente = await this.conversacionRepo.existeContratoVigente(idLocador, idLocatario);
      if (!tieneContratoVigente) {
        this.throwValidationError(
          'Un locador no puede iniciar conversación con un locatario sin contrato vigente.',
          403,
          'REQUIERE_CONTRATO_VIGENTE'
        );
      }
    }

    let conversacion: ConversacionDTO;
    try {
      conversacion = await this.conversacionRepo.create({
        id_locador: idLocador,
        id_locatario: idLocatario,
        iniciado_por: user.id,
        tipo_tema: tipoTema,
        asunto,
        id_inmueble: request.id_inmueble ?? null,
        id_reclamo: null,
        id_contrato: request.id_contrato ?? null
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== '23505') throw error;
      const existenteTrasConflicto = await this.conversacionRepo.findActivaPorParticipantesEInmueble(
        idLocador,
        idLocatario,
        request.id_inmueble ?? null
      );
      if (!existenteTrasConflicto) throw error;
      return this.completarInicioConversacion(user, existenteTrasConflicto, false, request.primer_mensaje);
    }

    return this.completarInicioConversacion(user, {
      ...conversacion,
      otro_participante: {
        id: destinatario.id,
        nombre: destinatario.nombre,
        apellido: destinatario.apellido,
        email: destinatario.email,
        telefono: destinatario.telefono
      },
      inmueble: null
    }, true, request.primer_mensaje);
  }

  private async completarInicioConversacion(
    user: AuthenticatedUser,
    conversacion: ConversacionResponse,
    creada: boolean,
    primerMensaje?: string
  ): Promise<IniciarConversacionResultado> {
    let ultimo: MensajeDTO | MensajeResponse | null = null;
    let totalMensajes = 0;

    if (primerMensaje) {
      if (creada) {
        ultimo = await this.mensajeRepo.create({
          id_conversacion: conversacion.id,
          id_emisor: user.id,
          contenido: primerMensaje.trim()
        });
        await this.conversacionRepo.actualizarFechaActividad(conversacion.id);
        await this.mensajeRepo.podarMensajesAntiguos(conversacion.id, 100);
      } else {
        ultimo = await this.enviarMensaje(user, conversacion.id, primerMensaje);
      }
      totalMensajes = await this.mensajeRepo.countByConversacionId(conversacion.id);
    } else if (creada) {
      totalMensajes = 0;
    } else {
      const [mensajes, count] = await Promise.all([
        this.mensajeRepo.findByConversacionId(conversacion.id, 1),
        this.mensajeRepo.countByConversacionId(conversacion.id)
      ]);
      ultimo = mensajes.at(-1) ?? null;
      totalMensajes = count;
    }

    return {
      creada,
      conversacion: {
        ...conversacion,
        ultimo_mensaje: ultimo ? {
          id: ultimo.id,
          contenido: ultimo.eliminado ? 'Este mensaje fue eliminado' : ultimo.contenido,
          fecha_envio: ultimo.fecha_envio,
          id_emisor: ultimo.id_emisor,
          eliminado: ultimo.eliminado
        } : null,
        total_mensajes: totalMensajes
      }
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

    const resumenes = await this.mensajeRepo.findResumenPorConversacionIds(
      conversaciones.map(conversacion => conversacion.id)
    );
    const resumenPorConversacion = new Map(resumenes.map(resumen => [resumen.id_conversacion, resumen]));

    return conversaciones.map(conversacion => {
      const resumen = resumenPorConversacion.get(conversacion.id);
      const ultimo = resumen?.ultimo_id == null ? null : {
        id: Number(resumen.ultimo_id),
        contenido: resumen.ultimo_eliminado ? 'Este mensaje fue eliminado' : resumen.ultimo_contenido ?? '',
        fecha_envio: resumen.ultimo_fecha_envio ?? '',
        id_emisor: Number(resumen.ultimo_id_emisor),
        eliminado: Boolean(resumen.ultimo_eliminado)
      };
      return {
        ...conversacion,
        ultimo_mensaje: ultimo,
        total_mensajes: Number(resumen?.total_mensajes ?? 0)
      };
    });
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

    const esConversacionReclamo = conversacion.tipo_tema === 'reclamo' || conversacion.id_reclamo != null;
    let nuevoMensaje: MensajeDTO;
    if (esConversacionReclamo) {
      if (conversacion.tipo_tema !== 'reclamo' || !conversacion.id_reclamo) {
        this.throwValidationError('La conversación del reclamo no está configurada correctamente.', 409, 'ESTADO_INVALIDO');
      }

      const reclamo = await this.reclamoRepo.findById(conversacion.id_reclamo);
      if (!reclamo) {
        this.throwValidationError('El reclamo asociado a la conversación no existe.', 404);
      }

      if (
        reclamo.locador.id !== conversacion.id_locador ||
        reclamo.id_locatario !== conversacion.id_locatario
      ) {
        this.throwValidationError('La conversación no corresponde a los participantes del reclamo.', 403);
      }

      if (user.id === conversacion.id_locador && reclamo.locador.id !== user.id) {
        this.throwValidationError(
          'Solo el locador dueño de la propiedad asociada puede responder al reclamo.',
          403,
          'SOLO_LOCADOR_PROPIETARIO'
        );
      }

      const estadoPermitido = user.id === conversacion.id_locador
        ? reclamo.id_estado_reclamo === 1 || reclamo.id_estado_reclamo === 2
        : reclamo.id_estado_reclamo === 2;
      if (!estadoPermitido) {
        this.throwValidationError(
          'El reclamo no permite enviar mensajes en su estado actual.',
          409,
          'ESTADO_INVALIDO'
        );
      }

      nuevoMensaje = await this.mensajeRepo.createEnConversacionReclamo({
        id_conversacion: idConversacion,
        id_emisor: user.id,
        contenido: contenido.trim()
      });
    } else {
      nuevoMensaje = await this.mensajeRepo.create({
        id_conversacion: idConversacion,
        id_emisor: user.id,
        contenido: contenido.trim()
      });

      await this.conversacionRepo.actualizarFechaActividad(idConversacion);
      await this.mensajeRepo.podarMensajesAntiguos(idConversacion, 100);
    }

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

    if (mensaje.eliminado) {
      this.throwValidationError('El mensaje ya fue eliminado.', 409, 'MENSAJE_YA_ELIMINADO');
    }

    if (mensaje.id_emisor !== user.id) {
      this.throwValidationError('No puedes eliminar mensajes enviados por el otro participante.', 403);
    }

    const conversacion = await this.conversacionRepo.findById(mensaje.id_conversacion);
    if (!conversacion || (conversacion.id_locador !== user.id && conversacion.id_locatario !== user.id)) {
      this.throwValidationError('No tienes permiso para eliminar mensajes de esta conversación.', 403);
    }

    if (conversacion.tipo_tema === 'reclamo' || conversacion.id_reclamo != null) {
      await this.mensajeRepo.marcarEliminadoEnConversacionReclamo(idMensaje, user.id);
      return;
    }

    await this.mensajeRepo.marcarEliminado(idMensaje);
  }
}

export const mensajeService = new MensajeService();
