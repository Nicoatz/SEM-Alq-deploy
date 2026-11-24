import { ReclamoService } from '../../src/services/reclamo.service';
import type { IReclamoRepository } from '../../src/repositories/reclamo.repository';
import type { AuthenticatedUser } from '../../src/gateway/middlewares/auth.middleware';
import type { ReclamoResponse, TipoReclamoDTO } from '../../src/dtos';

describe('US-14: Registrar reclamo (ReclamoService Unit Tests)', () => {
  let service: ReclamoService;
  let mockReclamoRepo: jest.Mocked<IReclamoRepository>;
  let mockInmuebleRepo: any;

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

  const tipoReclamoValido: TipoReclamoDTO = {
    id: 1,
    nombre: 'pintura',
    descripcion: 'Pintura'
  };

  const mensajeValido50Chars = 'Este es un mensaje de reclamo válido con más de cincuenta caracteres para probar.';

  beforeEach(() => {
    mockReclamoRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findTiposReclamo: jest.fn(),
      findTipoReclamoById: jest.fn(),
      findTipoReclamoByNombre: jest.fn(),
      findContratoVigenteLocatarioInmueble: jest.fn()
    };

    mockInmuebleRepo = {
      findById: jest.fn()
    };

    service = new ReclamoService(mockReclamoRepo, mockInmuebleRepo);
  });

  describe('Validación de Sesión y Rol', () => {
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

  describe('Validación de Propiedad y Contrato Vigente', () => {
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

  describe('Validación de Tipo de Reclamo', () => {
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

  describe('Validación de Mensaje de Reclamo (50 a 5000 caracteres)', () => {
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

  describe('Validación de Imágenes Adjuntas (hasta 10 fotos, JPG/PNG, <= 350kb)', () => {
    beforeEach(() => {
      mockInmuebleRepo.findById.mockResolvedValue({ id: 10, direccion: 'Av. Colón 1200' });
      mockReclamoRepo.findContratoVigenteLocatarioInmueble.mockResolvedValue({ id: 1, estado: 2 });
      mockReclamoRepo.findTipoReclamoById.mockResolvedValue(tipoReclamoValido);
    });

    it('debe permitir registrar el reclamo sin adjuntar imágenes', async () => {
      const respuestaEsperada: ReclamoResponse = {
        id: 100,
        id_inmueble: 10,
        id_locatario: 15,
        id_contrato: 1,
        id_tipo_reclamo: 1,
        id_estado_reclamo: 1,
        titulo: 'Reclamo: Pintura',
        descripcion: mensajeValido50Chars,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        tipo_reclamo: tipoReclamoValido,
        estado: 'pendiente',
        fotos: []
      };
      mockReclamoRepo.create.mockResolvedValue(respuestaEsperada);

      const resultado = await service.registrarReclamo(locatarioUser, {
        id_inmueble: 10,
        id_tipo_reclamo: 1,
        mensaje: mensajeValido50Chars
      });

      expect(resultado.id).toBe(100);
      expect(resultado.fotos).toEqual([]);
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
              peso_kb: 351, // Excede 350kb
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

      const respuestaEsperada: ReclamoResponse = {
        id: 101,
        id_inmueble: 10,
        id_locatario: 15,
        id_contrato: 1,
        id_tipo_reclamo: 1,
        id_estado_reclamo: 1,
        titulo: 'Reclamo de prueba',
        descripcion: mensajeValido50Chars,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        tipo_reclamo: tipoReclamoValido,
        estado: 'pendiente',
        fotos: [
          { id: 1, id_reclamo: 101, url: 'https://example.test/foto1.jpg', peso_kb: 150, formato: 'jpg', orden: 1 },
          { id: 2, id_reclamo: 101, url: 'https://example.test/foto2.png', peso_kb: 350, formato: 'png', orden: 2 }
        ]
      };
      mockReclamoRepo.create.mockResolvedValue(respuestaEsperada);

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

  describe('Consultar Tipos de Reclamo', () => {
    it('debe retornar el catálogo de tipos de reclamos', async () => {
      const tiposMock: TipoReclamoDTO[] = [
        { id: 1, nombre: 'pintura', descripcion: 'Pintura' },
        { id: 2, nombre: 'cobros', descripcion: 'Cobros' }
      ];
      mockReclamoRepo.findTiposReclamo.mockResolvedValue(tiposMock);

      const resultado = await service.obtenerTiposReclamo();

      expect(resultado).toEqual(tiposMock);
      expect(mockReclamoRepo.findTiposReclamo).toHaveBeenCalled();
    });
  });
});
