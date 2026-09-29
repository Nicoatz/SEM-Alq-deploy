import { CreateUsuarioDTO, UsuarioDTO } from '../dtos';
import { IUsuarioRepository, usuarioRepository } from '../repositories/usuario.repository';

export class UsuarioService {
  constructor(private readonly repository: IUsuarioRepository = usuarioRepository) {}

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

    if (!/^[^\s@]+@[^\s@]+$/.test(data.email)) {
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
}

export const usuarioService = new UsuarioService();