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

      const usuario = await usuarioService.obtenerMiPerfil(user.authUserId);

      res.status(200).json({
        success: true,
        message: 'Datos del usuario obtenidos exitosamente.',
        data: {
          ...usuario,
          roles: user.roles
        }
      });
    } catch (error) {
      next(error);
    }
  }

}


export const usuarioController = new UsuarioController();