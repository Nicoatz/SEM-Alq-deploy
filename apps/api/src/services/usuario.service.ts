import { CreateUsuarioDTO, UsuarioDTO, UpdateUsuarioDTO} from '../dtos';
import { IUsuarioRepository, usuarioRepository } from '../repositories/usuario.repository';
import {IContratoRepository,contratoRepository} from '../repositories/contrato.repository';

export class UsuarioService {
  constructor(
    private readonly repository: IUsuarioRepository = usuarioRepository,
    private readonly contratos: IContratoRepository = contratoRepository
  ) {}

  async registrar(data: CreateUsuarioDTO): Promise<UsuarioDTO> {
    const requiredFields: Array<keyof CreateUsuarioDTO> = [
      'nombre',
      'apellido',
      'email',
      'contraseña',
      'confirmar_contraseña',
      'telefono',
      'numero_documento',
      'fecha_nacimiento'
    ];

    for (const field of requiredFields) {
      if (typeof data[field] !== 'string' || !data[field].trim()) {
        const error = new Error(`El campo '${field}' es obligatorio.`);
        (error as any).statusCode = 400;
        throw error;
      }
    }

    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      const error = new Error('El email no tiene un formato válido.');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]{8,}$/.test(data.contraseña)) {
      const error = new Error(
        'La contraseña debe ser alfanumérica, tener al menos 8 caracteres, una mayúscula y una minúscula.'
      );
      (error as any).statusCode = 400;
      throw error;
    }

    if (data.contraseña !== data.confirmar_contraseña) {
      const error = new Error('La confirmación de contraseña no coincide.');
      (error as any).statusCode = 400;
      throw error;
    }

    if (data.acepta_terminos !== true) {
      const error = new Error('Debe aceptar los términos y condiciones.');
      (error as any).statusCode = 400;
      throw error;
    }

    return this.repository.create({
      ...data,
      email: data.email.trim().toLowerCase()
    });
  }

  async obtenerMiPerfil(authUserId: string): Promise<UsuarioDTO> {
    const usuario = await this.repository.findByAuthUserId(authUserId);
  
    if (!usuario) {
      const error = new Error('No se encontró el perfil del usuario autenticado.');
      (error as any).statusCode = 404;
      throw error;
    }
  
    return usuario;
  }

  
  
async actualizarMiPerfil(
  authUserId: string,
  data: UpdateUsuarioDTO
): Promise<UsuarioDTO> {
  const camposPermitidos = [
    'nombre',
    'apellido',
    'numero_documento',
    'telefono',
    'fecha_nacimiento'
  ];

  const camposEnviados = Object.keys(data);

  if (camposEnviados.length === 0) {
    const error = new Error('Debe enviar al menos un campo para actualizar.');
    (error as any).statusCode = 400;
    throw error;
  }

  const camposInvalidos = camposEnviados.filter(
    campo => !camposPermitidos.includes(campo)
  );

  if (camposInvalidos.length > 0) {
    const error = new Error(
      `No se permite actualizar los campos: ${camposInvalidos.join(', ')}.`
    );
    (error as any).statusCode = 400;
    throw error;
  }

  for (const [campo, valor] of Object.entries(data)) {
    if (typeof valor !== 'string' || !valor.trim()) {
      const error = new Error(
        `El campo '${campo}' debe ser un texto no vacío.`
      );
      (error as any).statusCode = 400;
      throw error;
    }
  }

  const modificaDatosRestringidos =
    data.nombre !== undefined ||
    data.apellido !== undefined ||
    data.numero_documento !== undefined;

  if (modificaDatosRestringidos) {
    const usuario = await this.repository.findByAuthUserId(authUserId);

    if (!usuario) {
      const error = new Error(
        'No se encontró el perfil del usuario autenticado.'
      );
      (error as any).statusCode = 404;
      throw error;
    }

    const tieneContrato = await this.contratos
      .tieneContratoQueBloqueaEdicion(usuario.id);

    if (tieneContrato) {
      const error = new Error(
        'No se puede modificar el nombre, apellido o DNI porque el usuario participa en un contrato vigente o pendiente de firma.'
      );
      (error as any).statusCode = 409;
      throw error;
    }
  }

  if (data.telefono !== undefined) {
    const telefono = data.telefono.trim();

    if (!/^\+[1-9]\d{9,14}$/.test(telefono)) {
      const error = new Error(
        'El teléfono debe incluir el prefijo + y contener entre 10 y 15 dígitos en formato E.164.'
      );
      (error as any).statusCode = 400;
      throw error;
    }
  }

  if (data.fecha_nacimiento !== undefined) {
    const fechaNacimiento = data.fecha_nacimiento.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
      const error = new Error(
        'La fecha de nacimiento debe tener el formato AAAA-MM-DD.'
      );
      (error as any).statusCode = 400;
      throw error;
    }

    const fecha = new Date(`${fechaNacimiento}T00:00:00.000Z`);

    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== fechaNacimiento
    ) {
      const error = new Error('La fecha de nacimiento no es válida.');
      (error as any).statusCode = 400;
      throw error;
    }

    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - fecha.getUTCFullYear();

    const aunNoCumplio =
      hoy.getUTCMonth() < fecha.getUTCMonth() ||
      (
        hoy.getUTCMonth() === fecha.getUTCMonth() &&
        hoy.getUTCDate() < fecha.getUTCDate()
      );

    if (aunNoCumplio) edad--;

    if (edad < 18) {
      const error = new Error(
        'Para actualizar la fecha de nacimiento, el usuario debe tener al menos 18 años.'
      );
      (error as any).statusCode = 400;
      throw error;
    }
  }

  const datosActualizados: UpdateUsuarioDTO = {};

  for (const [campo, valor] of Object.entries(data)) {
    (datosActualizados as Record<string, unknown>)[campo] =
      typeof valor === 'string' ? valor.trim() : valor;
  }

  return this.repository.updateByAuthUserId(
    authUserId,
    datosActualizados
  );
}


}

export const usuarioService = new UsuarioService();