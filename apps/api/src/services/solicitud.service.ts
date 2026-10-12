import type {
  CrearSolicitudRequest,
  SolicitudPreparacionResponse,
  SolicitudResponse
} from '../dtos';

import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { IInmuebleRepository, inmuebleRepository } from '../repositories/inmueble.repository';
import {
  ISolicitudRepository,
  solicitudRepository
} from '../repositories/solicitud.repository';
import { lookupRepository } from '../repositories/lookup.repository';

export class SolicitudService {
  constructor(
    private readonly solicitudRepo: ISolicitudRepository = solicitudRepository,
    private readonly inmuebleRepo: Pick<IInmuebleRepository, 'findById'> = inmuebleRepository
  ) {}

  private throwValidationError(message: string, statusCode = 400): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    throw error;
  }

  async prepare(
    user: AuthenticatedUser,
    idInmueble: number
  ): Promise<SolicitudPreparacionResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para solicitar una propiedad.', 401);
    }

    const inmueble = await this.inmuebleRepo.findById(idInmueble);

    if (!inmueble) {
      this.throwValidationError('La propiedad indicada no existe.', 404);
    }

    if (inmueble.id_locador === user.id) {
      this.throwValidationError('No puedes solicitar una propiedad propia.', 403);
    }

    if (!['publicado', 'publicado/alquilado'].includes(inmueble.estado_alquiler)) {
      this.throwValidationError('Esta propiedad ya no recibe solicitudes.', 409);
    }

    const [usuario, situaciones, garantias] = await Promise.all([
      lookupRepository.getUsuarioById(user.id),
      this.solicitudRepo.getSituaciones(),
      this.solicitudRepo.getGarantias()
    ]);

    if (!usuario) {
      this.throwValidationError('No se encontró el perfil del usuario autenticado.', 401);
    }

    const ocupacionCodigo: Record<string, SolicitudPreparacionResponse['situaciones_ocupacionales'][number]['codigo']> = {
      '-': 'sin_informar',
      'relación de dependencia': 'relacion_dependencia',
      monotributista: 'monotributista',
      autónoma: 'autonoma',
      estudiante: 'estudiante',
      jubilada: 'jubilada'
    };
    const garantiaCodigo: Record<string, SolicitudPreparacionResponse['garantias'][number]['codigo']> = {
      'garantía propietaria': 'propietaria',
      'seguro de caución': 'caucion',
      otra: 'otra'
    };

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        dni: usuario.numero_documento,
        telefono: usuario.telefono,
        email: usuario.email
      },
      situaciones_ocupacionales: situaciones.map(situacion => ({
        id: situacion.id,
        codigo: ocupacionCodigo[situacion.nombre] ?? 'sin_informar',
        nombre: situacion.nombre
      })),
      garantias: garantias.map(garantia => ({
        id: garantia.id,
        codigo: garantiaCodigo[garantia.nombre] ?? 'otra',
        nombre: garantia.nombre
      })),
      // NOTA: el esquema actual todavía no persiste garantías exigidas por inmueble.
      garantias_exigidas: [],
      valores_iniciales: {
        telefono: usuario.telefono ?? '',
        email: usuario.email,
        ocupacion: 'sin_informar',
        ingresos: null,
        convivientes: 1,
        mascotas: false,
        detalle_mascotas: null,
        garantias: [],
        acepto: false
      }
    };
  }

  async create(
    user: AuthenticatedUser,
    payload: CrearSolicitudRequest
  ): Promise<SolicitudResponse> {
    if (!user?.id) {
      this.throwValidationError('Debe iniciar sesión para enviar una solicitud.', 401);
    }

    const inmueble = await this.inmuebleRepo.findById(payload.id_inmueble);

    if (!inmueble) {
      this.throwValidationError('La propiedad indicada no existe.', 404);
    }

    if (inmueble.id_locador === user.id) {
      this.throwValidationError('No puedes enviar una solicitud a una propiedad propia.', 403);
    }

    const solicitudActiva = await this.solicitudRepo.findActiveByInmuebleAndLocatario(
      payload.id_inmueble,
      user.id
    );

    if (solicitudActiva) {
      this.throwValidationError(
        'Ya tenés una solicitud activa para esta propiedad.',
        409
      );
    }

    const mensaje = payload.mensaje?.trim() ?? '';

    if (mensaje.length > 600) {
      this.throwValidationError('El mensaje no puede superar los 600 caracteres.', 400);
    }

    const telefonoCanonico = payload.telefono?.trim() ?? '';

    if (!/^\+[1-9]\d{9,14}$/.test(telefonoCanonico)) {
      this.throwValidationError(
        'El teléfono debe tener formato internacional válido, por ejemplo +5493511234567.',
        400
      );
    }

    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
      this.throwValidationError('El email ingresado no tiene un formato válido.', 400);
    }

    const ingresos = payload.ingresos === 0 ? null : payload.ingresos;

    if (ingresos !== null && (!Number.isInteger(ingresos) || ingresos <= 0)) {
      this.throwValidationError('Los ingresos aproximados deben ser un número entero mayor a 0 o nulo.', 400);
    }

    if (!Number.isInteger(payload.convivientes) || payload.convivientes < 1) {
      this.throwValidationError('La cantidad de personas debe ser un número entero mayor o igual a 1.', 400);
    }

    if (payload.mascotas) {
      const detalle = payload.detalle_mascotas?.trim() ?? '';

      if (!detalle) {
        this.throwValidationError('Debés indicar información sobre las mascotas si marcaste que poseés mascotas.', 400);
      }

      if (detalle.length > 300) {
        this.throwValidationError('El detalle de mascotas no puede superar los 300 caracteres.', 400);
      }
    }

    if (!payload.acepta_condiciones) {
      this.throwValidationError('Debés aceptar lo que implica el envío de la solicitud.', 400);
    }

    const garantiaNombres: Record<string, string> = {
      propietaria: 'garantía propietaria',
      caucion: 'seguro de caución',
      otra: 'otra'
    };
    const garantias = [...new Set(payload.garantias ?? [])];
    const nombresGarantias = garantias.map(garantia => garantiaNombres[garantia]);
    const garantiasExistentes = await this.solicitudRepo.findGarantiasByNames(nombresGarantias);

    if (garantias.length !== garantiasExistentes.length) {
      this.throwValidationError('Al menos una garantía indicada no existe.', 400);
    }

    const nombresOcupacion: Record<string, string> = {
      sin_informar: '-',
      relacion_dependencia: 'relación de dependencia',
      monotributista: 'monotributista',
      autonoma: 'autónoma',
      estudiante: 'estudiante',
      jubilada: 'jubilada'
    };
    const situacion = await this.solicitudRepo.getSituacionByNombre(nombresOcupacion[payload.ocupacion]);

    if (!situacion) {
      this.throwValidationError('La situación ocupacional indicada no existe.', 400);
    }

    const estadoInicial = await this.solicitudRepo.getEstadoById(1);

    if (!estadoInicial) {
      this.throwValidationError('No existe un estado inicial de solicitud configurado.', 500);
    }

    const nuevaSolicitud = await this.solicitudRepo.create({
      id_inmueble: payload.id_inmueble,
      id_locador: inmueble.id_locador,
      id_locatario: user.id,
      id_estado_solicitud: estadoInicial.id,
      id_situacion_ocupacional: situacion.id,
      mensaje: mensaje || null,
      telefono: telefonoCanonico.slice(1),
      email: payload.email.trim().toLowerCase(),
      ingresos_aprox: ingresos,
      cantidad_personas: payload.convivientes,
      posee_mascotas: payload.mascotas,
      detalles_mascotas: payload.mascotas ? (payload.detalle_mascotas?.trim() ?? null) : null,
      acepta_condiciones: payload.acepta_condiciones
    });

    await this.solicitudRepo.addGarantias(
      nuevaSolicitud.id,
      garantiasExistentes.map(garantia => garantia.id)
    );

    const solicitudCompleta = await this.solicitudRepo.findByIdWithRelations(nuevaSolicitud.id);

    if (!solicitudCompleta) {
      this.throwValidationError('No se pudo recuperar la solicitud creada.', 500);
    }

    return solicitudCompleta;
  }
}

export const solicitudService = new SolicitudService();
