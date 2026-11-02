import type { ContratoBorradorResponse, ContratoDTO } from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { IContratoRepository, contratoRepository } from '../repositories/contrato.repository';
import { hoyEnArgentina, validarGuardarBorrador } from './contrato-borrador.validacion';

export class ContratoService {
  constructor(private readonly contratoRepo: IContratoRepository = contratoRepository) {}

  private throwError(message: string, statusCode: number): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    throw error;
  }

  /** Sesión de locador e id válidos: lo que piden todas las operaciones sobre un contrato. */
  private validarAcceso(user: AuthenticatedUser, idContrato: number): void {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para gestionar contratos.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para gestionar contratos.', 403);
    }

    if (!Number.isInteger(idContrato) || idContrato < 1) {
      this.throwError('El identificador del contrato no es válido.', 400);
    }
  }

  /**
   * US-05 · Consultar un contrato en curso del locador (para retomar el borrador).
   * Un contrato ajeno o inexistente es siempre 404: no se distingue.
   */
  async obtener(user: AuthenticatedUser, idContrato: number): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const contrato = await this.contratoRepo.findBorradorCompleto(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    return contrato;
  }

  /**
   * US-05 · Guardar el borrador desde cualquier paso. Un borrador puede estar incompleto: solo
   * se valida el formato de lo que llega; lo obligatorio se exige al enviar a firmar.
   * Devuelve el contrato completo, así el front no vuelve a pedirlo.
   */
  async guardar(
    user: AuthenticatedUser,
    idContrato: number,
    cuerpo: unknown
  ): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const datos = validarGuardarBorrador(cuerpo, hoyEnArgentina());
    const resultado = await this.contratoRepo.guardarBorrador(idContrato, user.id, datos);

    if (!resultado.success) {
      this.throwError(resultado.message, resultado.statusCode);
    }

    return this.obtener(user, idContrato);
  }

  /**
   * US-05 · Iniciar contrato: crea el borrador desde una solicitud aceptada.
   *
   * La oferta de la propiedad no se modifica (ver docs/gestion_contrato.md): el borrador es una
   * fila nueva. Las reglas de negocio las valida la función SQL `iniciar_contrato`, que además
   * hace el alta en una sola transacción.
   */
  async iniciar(user: AuthenticatedUser, idSolicitud: number): Promise<ContratoDTO> {
    if (!user?.id) {
      this.throwError('Debe iniciar sesión para iniciar un contrato.', 401);
    }

    if (!user.roles.includes('locador')) {
      this.throwError('Se requiere el rol locador para iniciar un contrato.', 403);
    }

    if (!Number.isInteger(idSolicitud) || idSolicitud < 1) {
      this.throwError('El identificador de la solicitud no es válido.', 400);
    }

    const resultado = await this.contratoRepo.iniciarContrato(idSolicitud, user.id);

    if (!resultado.success || resultado.contrato_id === undefined) {
      this.throwError(resultado.message, resultado.statusCode);
    }

    const contrato = await this.contratoRepo.findById(resultado.contrato_id);

    if (!contrato) {
      this.throwError('No se pudo recuperar el contrato creado.', 500);
    }

    return contrato;
  }
}

export const contratoService = new ContratoService();
