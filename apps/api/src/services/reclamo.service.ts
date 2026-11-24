import type {
  ConversacionReclamoResponse,
  FiltrosReclamosDTO,
  RegistrarReclamoRequest,
  ReclamoResponse,
  TipoReclamoDTO
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { IReclamoRepository, reclamoRepository } from '../repositories/reclamo.repository';
import { IInmuebleRepository, inmuebleRepository } from '../repositories/inmueble.repository';
import { IConversacionRepository, conversacionRepository } from '../repositories/conversacion.repository';
import { IMensajeRepository, mensajeRepository } from '../repositories/mensaje.repository';

const FORMATOS_VALIDOS = ['jpg', 'jpeg', 'png', 'image/jpeg', 'image/png'];
const PESO_MAXIMO_KB = 350;
const MAX_FOTOS = 10;
const MIN_LONGITUD_MENSAJE = 50;
const MAX_LONGITUD_MENSAJE = 5000;

export class ReclamoService {
  constructor(
    private readonly reclamoRepo: IReclamoRepository = reclamoRepository,
    private readonly inmuebleRepo: Pick<IInmuebleRepository, 'findById'> = inmuebleRepository,
    private readonly conversacionRepo: IConversacionRepository = conversacionRepository,
    private readonly mensajeRepo: IMensajeRepository = mensajeRepository
  ) {}

  private throwValidationError(message: string, statusCode = 400, codigo?: string): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (codigo) (error as any).codigo = codigo;
    throw error;
  }

  /**
   * Obtener catálogo de tipos de reclamo (US-14).
   */
  async obtenerTiposReclamo(): Promise<TipoReclamoDTO[]> {
    return this.reclamoRepo.findTiposReclamo();
  }

  /**
   * Registrar un reclamo como locatario (US-14).
   */
  async registrarReclamo(
    user: AuthenticatedUser,
    request: RegistrarReclamoRequest
  ): Promise<ReclamoResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para registrar un reclamo.', 401);
    }

    if (!user.roles || !user.roles.includes('locatario')) {
      this.throwValidationError(
        'Solo un locatario puede registrar un reclamo.',
        403,
        'ROL_NO_AUTORIZADO'
      );
    }

    if (!request.id_inmueble || typeof request.id_inmueble !== 'number' || request.id_inmueble <= 0) {
      this.throwValidationError('Debe seleccionar una propiedad para registrar el reclamo.', 400);
    }

    const inmueble = await this.inmuebleRepo.findById(request.id_inmueble);
    if (!inmueble) {
      this.throwValidationError('La propiedad seleccionada no existe.', 404);
    }

    const contratoVigente = await this.reclamoRepo.findContratoVigenteLocatarioInmueble(
      user.id,
      request.id_inmueble
    );

    if (!contratoVigente) {
      this.throwValidationError(
        'No posee un contrato de alquiler vigente para la propiedad seleccionada.',
        403,
        'SIN_CONTRATO_VIGENTE'
      );
    }

    if (!request.id_tipo_reclamo && !request.tipo_reclamo) {
      this.throwValidationError('Debe seleccionar un tipo de reclamo.', 400);
    }

    let tipoReclamo: TipoReclamoDTO | null = null;
    if (request.id_tipo_reclamo) {
      tipoReclamo = await this.reclamoRepo.findTipoReclamoById(request.id_tipo_reclamo);
    } else if (request.tipo_reclamo) {
      tipoReclamo = await this.reclamoRepo.findTipoReclamoByNombre(request.tipo_reclamo);
    }

    if (!tipoReclamo) {
      this.throwValidationError('El tipo de reclamo seleccionado no es válido.', 400);
    }

    if (!request.mensaje || typeof request.mensaje !== 'string' || request.mensaje.trim().length === 0) {
      this.throwValidationError('Debe redactar un mensaje de reclamo.', 400);
    }

    const mensajeLimpio = request.mensaje.trim();
    if (mensajeLimpio.length < MIN_LONGITUD_MENSAJE || mensajeLimpio.length > MAX_LONGITUD_MENSAJE) {
      this.throwValidationError(
        `El mensaje de reclamo debe tener entre ${MIN_LONGITUD_MENSAJE} y ${MAX_LONGITUD_MENSAJE} caracteres.`,
        400
      );
    }

    const fotos = request.fotos ?? [];
    if (fotos.length > MAX_FOTOS) {
      this.throwValidationError(`No se pueden adjuntar más de ${MAX_FOTOS} imágenes.`, 400);
    }

    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i];

      if (!foto.url || typeof foto.url !== 'string' || foto.url.trim().length === 0) {
        this.throwValidationError(`La foto en la posición ${i + 1} debe tener una URL válida.`, 400);
      }

      const formato = foto.formato?.toLowerCase()?.trim();
      if (!formato || !FORMATOS_VALIDOS.includes(formato)) {
        this.throwValidationError(
          'Las imágenes deben estar en formato JPG o PNG.',
          400
        );
      }

      if (!foto.peso_kb || typeof foto.peso_kb !== 'number' || foto.peso_kb <= 0 || foto.peso_kb > PESO_MAXIMO_KB) {
        this.throwValidationError(
          `Las imágenes no deben exceder los ${PESO_MAXIMO_KB}kb cada una.`,
          400
        );
      }
    }

    const titulo = request.titulo?.trim() || `Reclamo: ${tipoReclamo.descripcion}`;

    return this.reclamoRepo.create(
      {
        id_inmueble: request.id_inmueble,
        id_locatario: user.id,
        id_contrato: contratoVigente.id,
        id_tipo_reclamo: tipoReclamo.id,
        titulo,
        descripcion: mensajeLimpio
      },
      fotos
    );
  }

  /**
   * Consultar reclamos del usuario (US-15).
   */
  async consultarReclamos(
    user: AuthenticatedUser,
    filtros?: FiltrosReclamosDTO
  ): Promise<ReclamoResponse[]> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para consultar reclamos.', 401);
    }

    const esLocador = user.roles?.includes('locador') ?? false;
    const esLocatario = user.roles?.includes('locatario') ?? false;

    if (!esLocador && !esLocatario) {
      this.throwValidationError('Debe tener rol de locador o locatario para consultar reclamos.', 403);
    }

    if (filtros?.rol === 'locador') {
      if (!esLocador) {
        this.throwValidationError('No posee el rol de locador para consultar estos reclamos.', 403);
      }
      return this.reclamoRepo.findByLocadorId(user.id, filtros);
    }

    if (filtros?.rol === 'locatario') {
      if (!esLocatario) {
        this.throwValidationError('No posee el rol de locatario para consultar estos reclamos.', 403);
      }
      return this.reclamoRepo.findByLocatarioId(user.id, filtros);
    }

    if (esLocador && !esLocatario) {
      return this.reclamoRepo.findByLocadorId(user.id, filtros);
    }

    if (esLocatario && !esLocador) {
      return this.reclamoRepo.findByLocatarioId(user.id, filtros);
    }

    const [deLocatario, deLocador] = await Promise.all([
      this.reclamoRepo.findByLocatarioId(user.id, filtros),
      this.reclamoRepo.findByLocadorId(user.id, filtros)
    ]);

    const mapa = new Map<number, ReclamoResponse>();
    for (const r of [...deLocatario, ...deLocador]) {
      mapa.set(r.id, r);
    }

    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.fecha_actualizacion).getTime() - new Date(a.fecha_actualizacion).getTime()
    );
  }

  /**
   * Consultar detalle de un reclamo por ID (US-15).
   */
  async consultarDetalleReclamo(
    user: AuthenticatedUser,
    idReclamo: number
  ): Promise<ReclamoResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para ver el reclamo.', 401);
    }

    const reclamo = await this.reclamoRepo.findById(idReclamo);
    if (!reclamo) {
      this.throwValidationError('El reclamo solicitado no existe.', 404);
    }

    const esLocatario = reclamo.id_locatario === user.id || reclamo.locatario?.id === user.id;
    const esLocador = reclamo.locador?.id === user.id;

    if (!esLocatario && !esLocador) {
      this.throwValidationError('No tienes permiso para ver este reclamo.', 403);
    }

    return reclamo;
  }

  /**
   * Responder a un reclamo (US-18).
   * - Solo el locador dueño de la propiedad asociada al reclamo puede responder.
   * - Solo se puede responder si el estado es 'abierto' (1) o 'en proceso' (2).
   * - Mensaje no vacío.
   * - Al responder, el estado pasa automáticamente a 'en proceso' (2).
   * - Se crea o reutiliza la conversación vinculada al reclamo (reutilizando mensajería US-24).
   * - Retorna la conversación con el reclamo original fijado y los mensajes.
   */
  async responderReclamo(
    user: AuthenticatedUser,
    idReclamo: number,
    mensaje: string
  ): Promise<ConversacionReclamoResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para responder al reclamo.', 401);
    }

    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length === 0) {
      this.throwValidationError('El mensaje de respuesta no puede estar vacío.', 400);
    }

    const reclamo = await this.reclamoRepo.findById(idReclamo);
    if (!reclamo) {
      this.throwValidationError('El reclamo solicitado no existe.', 404);
    }

    // Criterio 1: Solo el locador dueño de la propiedad puede responder
    if (reclamo.locador.id !== user.id) {
      this.throwValidationError(
        'Solo el locador dueño de la propiedad asociada puede responder al reclamo.',
        403,
        'SOLO_LOCADOR_PROPIETARIO'
      );
    }

    // Criterio 2: Solo en estado 'abierto' (1) o 'en_proceso' (2)
    if (reclamo.id_estado_reclamo !== 1 && reclamo.id_estado_reclamo !== 2) {
      this.throwValidationError(
        'Solo se puede responder a un reclamo que se encuentre en estado abierto o en proceso.',
        400,
        'ESTADO_INVALIDO'
      );
    }

    // Criterio 4: Si está 'abierto' (1), pasa automáticamente a 'en_proceso' (2)
    if (reclamo.id_estado_reclamo === 1) {
      await this.reclamoRepo.actualizarEstado(idReclamo, 2);
      reclamo.id_estado_reclamo = 2;
      reclamo.estado = 'en_proceso';
    }

    // Criterio 5 y 9: Buscar o crear conversación vinculada al reclamo
    let conversacion = await this.conversacionRepo.findByReclamoId(idReclamo);

    if (!conversacion) {
      const nueva = await this.conversacionRepo.create({
        id_locador: user.id,
        id_locatario: reclamo.id_locatario,
        iniciado_por: user.id,
        tipo_tema: 'reclamo',
        asunto: reclamo.titulo,
        id_inmueble: reclamo.id_inmueble,
        id_reclamo: reclamo.id,
        id_contrato: reclamo.id_contrato
      });

      conversacion = {
        ...nueva,
        otro_participante: reclamo.locatario
      };
    }

    // Registrar mensaje en la conversación (reutilizando lógica y poda a 100 de US-24)
    const nuevoMensaje = await this.mensajeRepo.create({
      id_conversacion: conversacion.id,
      id_emisor: user.id,
      contenido: mensaje.trim()
    });

    await this.conversacionRepo.actualizarFechaActividad(conversacion.id);
    await this.mensajeRepo.podarMensajesAntiguos(conversacion.id, 100);

    const mensajes = await this.mensajeRepo.findByConversacionId(conversacion.id, 100);

    return {
      conversacion: {
        ...conversacion,
        ultimo_mensaje: {
          id: nuevoMensaje.id,
          contenido: nuevoMensaje.contenido,
          fecha_envio: nuevoMensaje.fecha_envio,
          id_emisor: nuevoMensaje.id_emisor,
          eliminado: nuevoMensaje.eliminado
        },
        total_mensajes: mensajes.length
      },
      reclamo_original: {
        id: reclamo.id,
        titulo: reclamo.titulo,
        descripcion: reclamo.descripcion,
        fecha_creacion: reclamo.fecha_creacion,
        tipo_reclamo: reclamo.tipo_reclamo,
        fotos: reclamo.fotos
      },
      mensajes: mensajes.map(m => ({
        ...m,
        es_propio: m.id_emisor === user.id
      }))
    };
  }

  /**
   * Obtener conversación vinculada a un reclamo junto al reclamo original fijado (US-18).
   */
  async obtenerConversacionReclamo(
    user: AuthenticatedUser,
    idReclamo: number
  ): Promise<ConversacionReclamoResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para ver la conversación del reclamo.', 401);
    }

    const reclamo = await this.reclamoRepo.findById(idReclamo);
    if (!reclamo) {
      this.throwValidationError('El reclamo solicitado no existe.', 404);
    }

    const esLocador = reclamo.locador.id === user.id;
    const esLocatario = reclamo.id_locatario === user.id || reclamo.locatario.id === user.id;

    if (!esLocador && !esLocatario) {
      this.throwValidationError('No tienes permiso para ver la conversación de este reclamo.', 403);
    }

    const conversacion = await this.conversacionRepo.findByReclamoId(idReclamo);
    if (!conversacion) {
      this.throwValidationError('Aún no se ha iniciado una conversación para este reclamo.', 404);
    }

    const mensajes = await this.mensajeRepo.findByConversacionId(conversacion.id, 100);

    return {
      conversacion: {
        ...conversacion,
        otro_participante: esLocador ? reclamo.locatario : reclamo.locador,
        total_mensajes: mensajes.length
      },
      reclamo_original: {
        id: reclamo.id,
        titulo: reclamo.titulo,
        descripcion: reclamo.descripcion,
        fecha_creacion: reclamo.fecha_creacion,
        tipo_reclamo: reclamo.tipo_reclamo,
        fotos: reclamo.fotos
      },
      mensajes: mensajes.map(m => ({
        ...m,
        es_propio: m.id_emisor === user.id
      }))
    };
  }
}

export const reclamoService = new ReclamoService();
