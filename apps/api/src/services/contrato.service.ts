import { createHash, randomUUID } from 'crypto';

import type { ContratoBorradorResponse, ContratoDTO, UrlSubidaPdfResponse } from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import {
  ESTADO_CONTRATO,
  IContratoRepository,
  contratoRepository,
} from '../repositories/contrato.repository';
import { hoyEnArgentina, validarGuardarBorrador } from './contrato-borrador.validacion';
import {
  MAX_PDF_BYTES,
  nuevaRutaPdf,
  validarArchivoPdf,
  validarRegistrarPdf,
} from './contrato-pdf.validacion';

export class ContratoService {
  constructor(private readonly contratoRepo: IContratoRepository = contratoRepository) {}

  /**
   * Lanza un error con su status HTTP y, si lo tiene, el `codigo` que identifica el motivo (los
   * 409): el manejador de errores lo devuelve en el sobre para que el cliente no lea el texto.
   */
  private throwError(message: string, statusCode: number, codigo?: string): never {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (codigo) (error as any).codigo = codigo;
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
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    return this.obtener(user, idContrato);
  }

  /** El contrato del locador, solo si existe, es suyo y sigue en borrador (si no, 404 o 409). */
  private async contratoEditableParaPdf(user: AuthenticatedUser, idContrato: number) {
    const contrato = await this.contratoRepo.findParaPdf(idContrato, user.id);

    if (!contrato) {
      this.throwError('No encontramos este contrato.', 404);
    }

    // US-05: un contrato enviado a firmar no se puede editar, tampoco su PDF.
    if (contrato.estado !== ESTADO_CONTRATO.BORRADOR) {
      this.throwError('Solo se puede modificar un contrato en borrador.', 409, 'CONTRATO_NO_EDITABLE');
    }

    return contrato;
  }

  /**
   * US-05, paso 3 · Primer paso de la carga del PDF: entrega una URL firmada para que el
   * navegador suba el archivo **directo a Storage**. No pasa por la API porque en Vercel las
   * funciones aceptan cuerpos de hasta 4,5 MB y la US permite PDFs de hasta 5 MB.
   * Cada pedido genera una ruta nueva: subir un PDF nunca pisa el que ya está registrado.
   */
  async urlSubidaPdf(user: AuthenticatedUser, idContrato: number): Promise<UrlSubidaPdfResponse> {
    this.validarAcceso(user, idContrato);
    await this.contratoEditableParaPdf(user, idContrato);

    const url = await this.contratoRepo.crearUrlSubidaPdf(nuevaRutaPdf(idContrato, randomUUID()));

    return { ...url, tamano_maximo_bytes: MAX_PDF_BYTES };
  }

  /**
   * US-05, paso 3 · Segundo paso: el front avisa que ya subió el archivo. La API lo descarga,
   * verifica que sea un PDF de hasta 5 MB (no confía en lo que declara el cliente), calcula su
   * hash y lo registra en el borrador. Si ya había un PDF, lo reemplaza y borra el anterior.
   */
  async registrarPdf(
    user: AuthenticatedUser,
    idContrato: number,
    cuerpo: unknown
  ): Promise<ContratoBorradorResponse> {
    this.validarAcceso(user, idContrato);

    const { path, nombre } = validarRegistrarPdf(cuerpo, idContrato);
    await this.contratoEditableParaPdf(user, idContrato);

    const descarga = await this.contratoRepo.descargarPdf(path);

    if (descarga.estado === 'no_encontrado') {
      this.throwError('No encontramos el archivo subido. Volvé a cargar el PDF.', 400);
    }

    // Un archivo que no cumple se borra de Storage: no queda suelto un PDF sin registrar.
    if (descarga.estado === 'demasiado_grande') {
      await this.contratoRepo.eliminarPdf(path);
      this.throwError('El contrato no puede superar los 5 MB.', 413);
    }

    try {
      validarArchivoPdf(descarga.archivo);
    } catch (error) {
      await this.contratoRepo.eliminarPdf(path);
      throw error;
    }

    const resultado = await this.contratoRepo.registrarPdf(idContrato, user.id, {
      path,
      nombre,
      sha256: createHash('sha256').update(descarga.archivo).digest('hex'),
      tamano: descarga.archivo.length,
    });

    if (!resultado.success) {
      // El contrato dejó de ser editable mientras tanto: el archivo recién subido sobra.
      await this.contratoRepo.eliminarPdf(path);
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    if (resultado.pdf_anterior && resultado.pdf_anterior !== path) {
      await this.contratoRepo.eliminarPdf(resultado.pdf_anterior);
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
      this.throwError(resultado.message, resultado.statusCode, resultado.codigo);
    }

    const contrato = await this.contratoRepo.findById(resultado.contrato_id);

    if (!contrato) {
      this.throwError('No se pudo recuperar el contrato creado.', 500);
    }

    return contrato;
  }
}

export const contratoService = new ContratoService();
