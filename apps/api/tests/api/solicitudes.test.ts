import type { AuthenticatedUser } from '../../src/gateway/middlewares/auth.middleware';
import type {
  EstadoSolicitudDTO,
  SituacionOcupacionalDTO,
  SolicitudDTO,
  SolicitudResponse,
  TipoGarantiaDTO,
  CrearSolicitudRequest,
  InmuebleDTO,
  FiltrosMisSolicitudesDTO
} from '../../src/dtos';
import type {
  CreateSolicitudEntity,
  ISolicitudRepository
} from '../../src/repositories/solicitud.repository';
import type { IInmuebleRepository } from '../../src/repositories/inmueble.repository';
import { SolicitudService } from '../../src/services/solicitud.service';

const usuario: AuthenticatedUser = {
  id: 20,
  nombre: 'Locatario',
  apellido: 'De Prueba',
  email: 'locatario@example.com',
  numero_documento: '30123456',
  telefono: '5493511234567',
  roles: ['locatario'],
  authUserId: 'auth-user-test'
};

const locador: AuthenticatedUser = {
  ...usuario,
  id: 30,
  nombre: 'Locador',
  apellido: 'De Prueba',
  roles: ['locador']
};

const inmueble: InmuebleDTO = {
  id: 22,
  id_locador: 30,
  tipo: 1,
  descripcion: 'Propiedad de prueba',
  provincia: 'Córdoba',
  ciudad: 'Córdoba',
  barrio: 'Centro',
  direccion: 'San Jerónimo',
  numero: 280,
  piso: '3A',
  m2_totales: 65,
  m2_cubiertos: 60,
  ambientes: 3,
  dormitorios: 2,
  banos: 1,
  antiguedad: 4,
  precio_publicado: 380000,
  estado_alquiler: 'publicado',
  fecha_disponible: null,
  servicios: null
};

const estadoPendiente: EstadoSolicitudDTO = {
  id: 1,
  nombre: 'pendiente',
  mensaje: null
};

const situacionSinInformar: SituacionOcupacionalDTO = {
  id: 1,
  nombre: '-'
};

const garantias: TipoGarantiaDTO[] = [
  { id: 1, nombre: 'garantía propietaria' },
  { id: 2, nombre: 'seguro de caución' },
  { id: 3, nombre: 'otra' }
];

class FakeInmuebleRepository implements Pick<IInmuebleRepository, 'findById'> {
  inmueble: InmuebleDTO | null = inmueble;

  async findById(): Promise<InmuebleDTO | null> {
    return this.inmueble;
  }
}

class FakeSolicitudRepository implements ISolicitudRepository {
  active: SolicitudDTO | null = null;
  current: SolicitudDTO = {
    id: 100,
    id_inmueble: inmueble.id,
    id_locador: 30,
    id_locatario: usuario.id,
    id_estado_solicitud: 1,
    id_situacion_ocupacional: 1,
    mensaje: null,
    mensaje_rechazo: null,
    telefono: usuario.telefono ?? '',
    email: usuario.email,
    ingresos_aprox: null,
    cantidad_personas: 1,
    posee_mascotas: false,
    detalles_mascotas: null,
    acepta_condiciones: true,
    fecha_creacion: '2026-10-12T00:00:00.000Z',
    fecha_actualizacion: '2026-10-12T00:00:00.000Z'
  };
  created: CreateSolicitudEntity | null = null;
  misSolicitudes: SolicitudResponse[] = [];
  recibidas: SolicitudResponse[] = [];
  lastLocatarioId: number | null = null;
  lastLocadorId: number | null = null;
  lastUpdate: { id: number; locador: number; estado: number; mensaje: string | null } | null = null;
  lastCancel: { id: number; locatario: number } | null = null;
  lastFiltros: FiltrosMisSolicitudesDTO | undefined;
  readonly createdResponse: SolicitudResponse = {
    id: 100,
    estado: 'pendiente',
    mensaje: null,
    fecha_creacion: '2026-10-12T00:00:00.000Z',
    fecha_respuesta: null,
    inmueble: {
      id: inmueble.id,
      direccion: inmueble.direccion,
      numero: inmueble.numero,
      piso: inmueble.piso,
      barrio: inmueble.barrio,
      foto_principal: null
    },
    postulante: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      dni: usuario.numero_documento,
      telefono: usuario.telefono,
      email: usuario.email
    },
    legajo: {
      ocupacion: 'sin_informar',
      ingresos: null,
      convivientes: 1,
      mascotas: false,
      detalle_mascotas: null,
      garantias: []
    }
  };

  async findById(): Promise<SolicitudDTO | null> { return this.current; }
  async findByInmuebleId(): Promise<SolicitudDTO[]> { return []; }
  async findActiveByInmuebleAndLocatario(): Promise<SolicitudDTO | null> { return this.active; }
  async findSolicitudesPendientesByLocatario(): Promise<SolicitudDTO[]> { return []; }
  async findByLocatarioId(idLocatario: number, filtros?: FiltrosMisSolicitudesDTO): Promise<SolicitudResponse[]> {
    this.lastLocatarioId = idLocatario;
    this.lastFiltros = filtros;
    return this.misSolicitudes;
  }

  async findByLocadorId(idLocador: number, filtros?: FiltrosMisSolicitudesDTO): Promise<SolicitudResponse[]> {
    this.lastLocadorId = idLocador;
    this.lastFiltros = filtros;
    return this.recibidas;
  }

  async updateEstado(id: number, locador: number, estado: number, mensaje: string | null = null): Promise<SolicitudResponse | null> {
    this.lastUpdate = { id, locador, estado, mensaje };
    return {
      ...this.createdResponse,
      estado: estado === 2 ? 'aceptada' : 'rechazada',
      mensaje_rechazo: mensaje,
      fecha_respuesta: '2026-10-12T01:00:00.000Z'
    };
  }

  async cancelarPorLocatario(id: number, locatario: number): Promise<SolicitudResponse | null> {
    this.lastCancel = { id, locatario };
    this.current.id_estado_solicitud = 4;
    this.current.fecha_respuesta = '2026-10-12T01:00:00.000Z';
    return {
      ...this.createdResponse,
      estado: 'cancelada',
      fecha_respuesta: this.current.fecha_respuesta
    };
  }

  async create(data: CreateSolicitudEntity): Promise<SolicitudDTO> {
    this.created = data;
    return {
      ...data,
      id: this.createdResponse.id,
      fecha_creacion: this.createdResponse.fecha_creacion,
      fecha_actualizacion: this.createdResponse.fecha_creacion
    };
  }

  async addGarantias(): Promise<void> {}
  async findGarantiasByIds(): Promise<TipoGarantiaDTO[]> { return []; }

  async findGarantiasByNames(names: string[]): Promise<TipoGarantiaDTO[]> {
    return garantias.filter(garantia => names.includes(garantia.nombre));
  }

  async getGarantiasBySolicitudId(): Promise<TipoGarantiaDTO[]> { return []; }
  async getEstadoById(): Promise<EstadoSolicitudDTO> { return estadoPendiente; }
  async getSituacionById(): Promise<SituacionOcupacionalDTO> { return situacionSinInformar; }
  async getSituacionByNombre(): Promise<SituacionOcupacionalDTO> { return situacionSinInformar; }
  async getSituaciones(): Promise<SituacionOcupacionalDTO[]> { return [situacionSinInformar]; }
  async getGarantias(): Promise<TipoGarantiaDTO[]> { return garantias; }
  async findByIdWithRelations(): Promise<SolicitudResponse> { return this.createdResponse; }
}

function payload(overrides: Partial<CrearSolicitudRequest> = {}): CrearSolicitudRequest {
  return {
    id_inmueble: inmueble.id,
    mensaje: null,
    telefono: '+5493511234567',
    email: 'locatario@example.com',
    ocupacion: 'sin_informar',
    ingresos: null,
    convivientes: 1,
    mascotas: false,
    detalle_mascotas: null,
    garantias: [],
    acepta_condiciones: true,
    ...overrides
  };
}

function serviceFixture(): {
  service: SolicitudService;
  solicitudRepository: FakeSolicitudRepository;
  inmuebleRepository: FakeInmuebleRepository;
} {
  const solicitudRepository = new FakeSolicitudRepository();
  const inmuebleRepository = new FakeInmuebleRepository();
  return {
    service: new SolicitudService(solicitudRepository, inmuebleRepository),
    solicitudRepository,
    inmuebleRepository
  };
}

async function expectStatus(promise: Promise<unknown>, statusCode: number): Promise<void> {
  await expect(promise).rejects.toMatchObject({ statusCode });
}

describe('SolicitudService.create - US-35', () => {
  it('rechaza una solicitud sin sesión', async () => {
    const { service } = serviceFixture();

    await expectStatus(service.create(null as unknown as AuthenticatedUser, payload()), 401);
  });

  it('rechaza una propiedad inexistente', async () => {
    const fixture = serviceFixture();
    fixture.inmuebleRepository.inmueble = null;

    await expectStatus(fixture.service.create(usuario, payload()), 404);
  });

  it('rechaza solicitar una propiedad propia', async () => {
    const fixture = serviceFixture();
    fixture.inmuebleRepository.inmueble = { ...inmueble, id_locador: usuario.id };

    await expectStatus(fixture.service.create(usuario, payload()), 403);
  });

  it('rechaza una solicitud activa duplicada', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.active = {
      id: 99,
      id_inmueble: inmueble.id,
      id_locador: inmueble.id_locador,
      id_locatario: usuario.id,
      id_estado_solicitud: 1,
      id_situacion_ocupacional: 1,
      mensaje: null,
      telefono: usuario.telefono ?? '',
      email: usuario.email,
      ingresos_aprox: null,
      cantidad_personas: 1,
      posee_mascotas: false,
      detalles_mascotas: null,
      acepta_condiciones: true,
      fecha_creacion: '2026-10-11T00:00:00.000Z',
      fecha_actualizacion: '2026-10-11T00:00:00.000Z'
    };

    await expectStatus(fixture.service.create(usuario, payload()), 409);
  });

  it('acepta mensaje de exactamente 600 caracteres e ingresos nulos', async () => {
    const fixture = serviceFixture();
    await fixture.service.create(usuario, payload({ mensaje: 'a'.repeat(600) }));

    expect(fixture.solicitudRepository.created).toMatchObject({
      mensaje: 'a'.repeat(600),
      ingresos_aprox: null,
      cantidad_personas: 1,
      posee_mascotas: false
    });
  });

  it.each([
    ['mensaje demasiado largo', { mensaje: 'a'.repeat(601) }],
    ['ingreso negativo', { ingresos: -1 }],
    ['ingreso decimal', { ingresos: 1.5 }],
    ['sin convivientes', { convivientes: 0 }],
    ['sin aceptación', { acepta_condiciones: false }],
    ['email inválido', { email: 'email-invalido' }],
    ['teléfono con separadores', { telefono: '+54 9 351 1234567' }]
  ])('rechaza %s', async (_caso, cambios) => {
    const { service } = serviceFixture();

    await expectStatus(service.create(usuario, payload(cambios)), 400);
  });

  it('rechaza mascotas sin detalle y detalles de más de 300 caracteres', async () => {
    const fixture = serviceFixture();
    await expectStatus(
      fixture.service.create(usuario, payload({ mascotas: true, detalle_mascotas: null })),
      400
    );
    await expectStatus(
      fixture.service.create(usuario, payload({ mascotas: true, detalle_mascotas: 'a'.repeat(301) })),
      400
    );
  });

  it('acepta datos modificados, múltiples garantías y persiste el teléfono sin +', async () => {
    const fixture = serviceFixture();
    await fixture.service.create(usuario, payload({
      telefono: '+5493515550103',
      email: 'nuevo+solicitud@example.com',
      ocupacion: 'relacion_dependencia',
      ingresos: 250000,
      convivientes: 3,
      mascotas: true,
      detalle_mascotas: 'Un perro',
      garantias: ['propietaria', 'caucion']
    }));

    expect(fixture.solicitudRepository.created).toMatchObject({
      id_locatario: usuario.id,
      id_locador: inmueble.id_locador,
      telefono: '5493515550103',
      email: 'nuevo+solicitud@example.com',
      ingresos_aprox: 250000,
      cantidad_personas: 3,
      posee_mascotas: true,
      detalles_mascotas: 'Un perro'
    });
  });
});

describe('SolicitudService.getMisSolicitudes - US-36', () => {
  it('rechaza la consulta sin sesión', async () => {
    const { service } = serviceFixture();

    await expectStatus(
      service.getMisSolicitudes(null as unknown as AuthenticatedUser),
      401
    );
  });

  it('consulta únicamente las solicitudes del usuario autenticado', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.misSolicitudes = [fixture.solicitudRepository.createdResponse];

    const resultado = await fixture.service.getMisSolicitudes(usuario);

    expect(resultado).toEqual(fixture.solicitudRepository.misSolicitudes);
    expect(fixture.solicitudRepository.lastLocatarioId).toBe(usuario.id);
  });

  it('propaga los filtros estado e inmueble al repository', async () => {
    const fixture = serviceFixture();
    const filtros: FiltrosMisSolicitudesDTO = {
      estado: 'pendiente',
      inmueble: inmueble.id
    };

    await fixture.service.getMisSolicitudes(usuario, filtros);

    expect(fixture.solicitudRepository.lastLocatarioId).toBe(usuario.id);
    expect(fixture.solicitudRepository.lastFiltros).toEqual(filtros);
  });

  it('rechaza un filtro de inmueble inválido', async () => {
    const { service } = serviceFixture();

    await expectStatus(
      service.getMisSolicitudes(usuario, { inmueble: 0 }),
      400
    );
  });
});

describe('SolicitudService.getSolicitudesRecibidas - US-36', () => {
  it('rechaza la consulta sin sesión', async () => {
    const { service } = serviceFixture();

    await expectStatus(
      service.getSolicitudesRecibidas(null as unknown as AuthenticatedUser),
      401
    );
  });

  it('rechaza la consulta de un usuario sin rol locador', async () => {
    const { service } = serviceFixture();

    await expectStatus(service.getSolicitudesRecibidas(usuario), 403);
  });

  it('consulta las solicitudes recibidas del locador autenticado', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.recibidas = [fixture.solicitudRepository.createdResponse];

    const resultado = await fixture.service.getSolicitudesRecibidas(locador);

    expect(resultado).toEqual(fixture.solicitudRepository.recibidas);
    expect(fixture.solicitudRepository.lastLocadorId).toBe(locador.id);
  });

  it('propaga los filtros estado e inmueble al repository', async () => {
    const fixture = serviceFixture();
    const filtros: FiltrosMisSolicitudesDTO = {
      estado: 'rechazada',
      inmueble: inmueble.id
    };

    await fixture.service.getSolicitudesRecibidas(locador, filtros);

    expect(fixture.solicitudRepository.lastLocadorId).toBe(locador.id);
    expect(fixture.solicitudRepository.lastFiltros).toEqual(filtros);
  });
});

describe('SolicitudService.aceptarSolicitud/rechazarSolicitud - US-37', () => {
  it('acepta una solicitud pendiente del locador', async () => {
    const fixture = serviceFixture();

    const resultado = await fixture.service.aceptarSolicitud(locador, inmueble.id);

    expect(resultado.estado).toBe('aceptada');
    expect(fixture.solicitudRepository.lastUpdate).toEqual({
      id: inmueble.id,
      locador: locador.id,
      estado: 2,
      mensaje: null
    });
  });

  it('rechaza una solicitud sin mensaje', async () => {
    const fixture = serviceFixture();

    const resultado = await fixture.service.rechazarSolicitud(locador, inmueble.id, {});

    expect(resultado.estado).toBe('rechazada');
    expect(resultado.mensaje_rechazo).toBeNull();
  });

  it('rechaza una solicitud con un mensaje de hasta 200 caracteres', async () => {
    const fixture = serviceFixture();
    const mensaje = 'a'.repeat(200);

    await fixture.service.rechazarSolicitud(locador, inmueble.id, {
      mensaje_rechazo: mensaje
    });

    expect(fixture.solicitudRepository.lastUpdate?.mensaje).toBe(mensaje);
  });

  it('rechaza un mensaje de rechazo de más de 200 caracteres', async () => {
    const fixture = serviceFixture();

    await expectStatus(
      fixture.service.rechazarSolicitud(locador, inmueble.id, {
        mensaje_rechazo: 'a'.repeat(201)
      }),
      400
    );
  });

  it('rechaza aceptar o rechazar para un usuario que no es locador', async () => {
    const fixture = serviceFixture();

    await expectStatus(fixture.service.aceptarSolicitud(usuario, inmueble.id), 403);
    await expectStatus(fixture.service.rechazarSolicitud(usuario, inmueble.id, {}), 403);
  });

  it('rechaza modificar una solicitud que ya no está pendiente', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.current.id_estado_solicitud = 2;

    await expectStatus(fixture.service.aceptarSolicitud(locador, inmueble.id), 409);
  });
});

describe('SolicitudService.cancelarSolicitud - US-38', () => {
  it('cancela una solicitud pendiente del locatario autenticado', async () => {
    const fixture = serviceFixture();

    const resultado = await fixture.service.cancelarSolicitud(usuario, inmueble.id);

    expect(resultado.estado).toBe('cancelada');
    expect(fixture.solicitudRepository.lastCancel).toEqual({
      id: inmueble.id,
      locatario: usuario.id
    });
    expect(fixture.solicitudRepository.current.id_estado_solicitud).toBe(4);
  });

  it('rechaza cancelar una solicitud de otro locatario', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.current.id_locatario = 999;

    await expectStatus(fixture.service.cancelarSolicitud(usuario, inmueble.id), 404);
  });

  it('rechaza cancelar una solicitud que ya no está pendiente', async () => {
    const fixture = serviceFixture();
    fixture.solicitudRepository.current.id_estado_solicitud = 2;

    await expectStatus(fixture.service.cancelarSolicitud(usuario, inmueble.id), 409);
  });

  it('rechaza cancelar sin sesión', async () => {
    const { service } = serviceFixture();

    await expectStatus(
      service.cancelarSolicitud(null as unknown as AuthenticatedUser, inmueble.id),
      401
    );
  });
});
