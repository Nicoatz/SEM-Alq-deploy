import { Request, Response, NextFunction } from 'express';
import { verifySupabaseAccessToken } from '../../config/supabase-jwt';
import { usuarioRepository } from '../../repositories/usuario.repository';

export interface AuthenticatedUser {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  numero_documento: string;
  telefono?: string | null;
  roles: string[];
  authUserId: string;
}

/**
 * Middleware del API Gateway para validar el JWT de Supabase y resolver
 * el usuario de la aplicación asociado a su UUID de Auth.
 */
export const authenticateGateway = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.header('authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: se requiere un token Bearer válido.'
      });
      return;
    }

    let payload;

    try {
      payload = await verifySupabaseAccessToken(token);
    } catch {
      res.status(401).json({
        success: false,
        error: 'No autorizado: el token de Supabase no es válido.'
      });
      return;
    }

    if (!payload.sub) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: el token no contiene el identificador del usuario.'
      });
      return;
    }

    let usuario;
    let roles;

    try {
      usuario = await usuarioRepository.findByAuthUserId(payload.sub);

      if (usuario) {
        roles = await usuarioRepository.getRolesByUsuarioId(usuario.id);
      }
    } catch {
      res.status(500).json({
        success: false,
        error: 'No se pudo resolver el perfil del usuario autenticado.'
      });
      return;
    }

    if (!usuario) {
      res.status(401).json({
        success: false,
        error: 'No autorizado: el usuario autenticado no tiene un perfil registrado.'
      });
      return;
    }

    (req as any).user = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      numero_documento: usuario.numero_documento,
      telefono: usuario.telefono,
      roles: (roles ?? []).map(role => role.descripcion),
      authUserId: payload.sub
    } as AuthenticatedUser;

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: 'No autorizado: el token de Supabase no es válido.'
    });
  }
};

/**
 * Middleware para asegurar que el usuario tenga un rol específico.
 */
export const requireRole = (roleRequired: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser;

    if (!user || !user.roles.includes(roleRequired)) {
      res.status(403).json({
        success: false,
        error: `Acceso denegado: Se requiere el rol '${roleRequired}' para realizar esta acción.`
      });
      return;
    }

    next();
  };
};