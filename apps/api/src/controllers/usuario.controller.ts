import { Request, Response, NextFunction } from 'express';
import { ApiResponse, CreateUsuarioDTO, UsuarioDTO } from '../dtos';
import { usuarioService } from '../services/usuario.service';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';

export class UsuarioController {
  async registrar(
    req: Request<unknown, unknown, CreateUsuarioDTO>,
    res: Response<ApiResponse<UsuarioDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const usuario = await usuarioService.registrar(req.body);
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente.',
        data: usuario
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerMiPerfil(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
  
      res.status(200).json({
        success: true,
        message: 'Datos del usuario obtenidos exitosamente.',
        data: {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          roles: user.roles
        }
      });
    } catch (error) {
      next(error);
    }
  }
}


export const usuarioController = new UsuarioController();