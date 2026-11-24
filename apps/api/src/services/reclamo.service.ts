import type {
  RegistrarReclamoRequest,
  ReclamoResponse,
  TipoReclamoDTO
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { IReclamoRepository, reclamoRepository } from '../repositories/reclamo.repository';
import { IInmuebleRepository, inmuebleRepository } from '../repositories/inmueble.repository';

const FORMATOS_VALIDOS = ['jpg', 'jpeg', 'png', 'image/jpeg', 'image/png'];
const PESO_MAXIMO_KB = 350;
const MAX_FOTOS = 10;
const MIN_LONGITUD_MENSAJE = 50;
const MAX_LONGITUD_MENSAJE = 5000;

export class ReclamoService {
  constructor(
    private readonly reclamoRepo: IReclamoRepository = reclamoRepository,
    private readonly inmuebleRepo: Pick<IInmuebleRepository, 'findById'> = inmuebleRepository
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
   *
   * Criterios de aceptación:
   * 1. Se debe haber iniciado sesión como locatario.
   * 2. Se debe seleccionar una propiedad con la que se posea un contrato vigente.
   * 3. Se debe seleccionar un tipo de reclamo (pintura, reparación del inmueble, reparación de artefactos, cobros, otro).
   * 4. Se debe redactar un mensaje de reclamo, de mínimo 50 caracteres y máximo 5000.
   * 5. Se pueden adjuntar hasta 10 imágenes en formato JPG/PNG que no excedan los 350kb cada una.
   */
  async registrarReclamo(
    user: AuthenticatedUser,
    request: RegistrarReclamoRequest
  ): Promise<ReclamoResponse> {
    // 1. Sesión y rol locatario
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

    // 2. Selección de propiedad
    if (!request.id_inmueble || typeof request.id_inmueble !== 'number' || request.id_inmueble <= 0) {
      this.throwValidationError('Debe seleccionar una propiedad para registrar el reclamo.', 400);
    }

    const inmueble = await this.inmuebleRepo.findById(request.id_inmueble);
    if (!inmueble) {
      this.throwValidationError('La propiedad seleccionada no existe.', 404);
    }

    // Verificar que el locatario posea un contrato vigente sobre esa propiedad
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

    // 3. Selección del tipo de reclamo
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

    // 4. Mensaje del reclamo (entre 50 y 5000 caracteres)
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

    // 5. Fotos adjuntas (hasta 10 fotos, JPG o PNG, <= 350kb)
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

    // Crear el reclamo y asociar fotos
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
}

export const reclamoService = new ReclamoService();
