/**
 * Registro de las firmas a partir de los avisos de DocuSign Connect (US-07, Paso 5).
 *
 * Qué hace: cuando DocuSign avisa que pasó algo con un sobre, la API NO cree lo que dice el aviso:
 * le pregunta a DocuSign el estado real del sobre y de cada firmante (con su propio token) y
 * reconcilia la base. El aviso es solo un disparador. Por eso un aviso falso o repetido no puede
 * registrar una firma que no existe, y una firma se registra aunque el aviso llegue incompleto.
 *
 * Qué registra:
 *   · cada firmante que completó: fecha y hora, IP y hash del documento;
 *   · un rechazo: el contrato vuelve a borrador y se borran las firmas;
 *   · todos firmaron (locador, locatario y garantes): el contrato pasa a vigente.
 *
 * Quién lo usa: `webhook.controller.ts`. Contra qué: el repositorio de contratos y DocuSign.
 *
 * NOTA: si algo falla (DocuSign, la base, una IP que no llega) se lanza el error: el controlador
 * responde 500 y DocuSign reintenta el aviso. Todas las operaciones son idempotentes.
 */
import { isIP } from 'net';

import {
  ESTADO_CONTRATO,
  FirmaResultado,
  IContratoRepository,
  contratoRepository,
} from '../repositories/contrato.repository';
import { IDocusignClient, docusignClient } from './docusign.client';

export interface AvisoDocusign {
  envelopeId: string;
  /** Identifica el aviso para no procesarlo dos veces (sobre + evento + fecha). */
  clave: string;
  tipo: string;
  payload: unknown;
}

export type ResultadoSincronizacion =
  | { accion: 'ignorado'; motivo: string }
  | { accion: 'rechazado' }
  | { accion: 'sincronizado'; firmasRegistradas: number; vigente: boolean };

function falla(message: string, statusCode = 500): never {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  throw error;
}

/** Una función SQL que respondió "no" por un motivo inesperado es un error; los esperados se toleran. */
function exigirExito(resultado: FirmaResultado, toleradosCodigo: string[] = []): FirmaResultado {
  if (!resultado.success && !(resultado.codigo && toleradosCodigo.includes(resultado.codigo))) {
    falla(`La base rechazó el registro: ${resultado.message}`);
  }
  return resultado;
}

export class DocusignWebhookService {
  constructor(
    private readonly contratoRepo: IContratoRepository = contratoRepository,
    private readonly docusign: IDocusignClient = docusignClient
  ) {}

  /**
   * Guarda el aviso (auditoría) y sincroniza el sobre. Un aviso que ya se procesó se ignora:
   * DocuSign reintenta hasta recibir un 200 y puede repetirlos.
   */
  async procesar(aviso: AvisoDocusign): Promise<ResultadoSincronizacion> {
    const evento = await this.contratoRepo.registrarEvento({
      event_key: aviso.clave,
      envelope_id: aviso.envelopeId,
      tipo: aviso.tipo,
      payload: aviso.payload,
    });

    if (evento.yaProcesado) {
      return { accion: 'ignorado', motivo: 'El aviso ya se había procesado.' };
    }

    const resultado = await this.sincronizar(aviso.envelopeId);
    await this.contratoRepo.marcarEventoProcesado(evento.id);

    return resultado;
  }

  /** Trae el estado real del sobre desde DocuSign y deja la base igual. */
  async sincronizar(envelopeId: string): Promise<ResultadoSincronizacion> {
    const contrato = await this.contratoRepo.findContratoPorSobre(envelopeId);

    // Un sobre sin contrato es uno ya desvinculado (se rechazó o se reabrió el contrato).
    if (!contrato) {
      return { accion: 'ignorado', motivo: 'Ningún contrato tiene este sobre.' };
    }

    // Ya está vigente: lo único que puede faltar es el documento firmado (si falló la descarga en
    // un aviso anterior, DocuSign reintenta y se completa acá).
    if (contrato.estado === ESTADO_CONTRATO.VIGENTE) {
      if (contrato.pdf_firmado_storage_path) {
        return { accion: 'ignorado', motivo: 'El contrato ya está vigente y con su documento firmado.' };
      }

      await this.guardarDocumentoFirmado(contrato.id, envelopeId);
      return { accion: 'sincronizado', firmasRegistradas: 0, vigente: true };
    }

    if (contrato.estado !== ESTADO_CONTRATO.PENDIENTE_FIRMA) {
      return { accion: 'ignorado', motivo: 'El contrato no está pendiente de firma.' };
    }

    const sobre = await this.docusign.obtenerEstadoSobre(envelopeId);

    // Lo anulamos nosotros (rechazo o cancelación): el contrato ya se resolvió por otro lado.
    if (sobre.estado === 'voided') {
      return { accion: 'ignorado', motivo: 'El sobre está anulado.' };
    }

    // US-07: al rechazar, el contrato vuelve a borrador y se borran las firmas.
    if (sobre.estado === 'declined' || sobre.firmantes.some(firmante => firmante.estado === 'declined')) {
      exigirExito(await this.contratoRepo.registrarRechazo(envelopeId), ['CONTRATO_NO_PENDIENTE']);
      return { accion: 'rechazado' };
    }

    const registrados = await this.contratoRepo.listarFirmantes(contrato.id);
    let firmasRegistradas = 0;

    for (const firmante of sobre.firmantes.filter(f => f.estado === 'completed')) {
      const local = registrados.find(registrado => registrado.recipient_id === firmante.recipientId);

      if (!local) {
        console.warn(`[webhook] El destinatario ${firmante.recipientId} del sobre no pertenece al contrato ${contrato.id}.`);
        continue;
      }

      // Una parte no firma dos veces: si ya consta, no se vuelve a registrar.
      if (local.estado_firma === 'firmado') continue;

      if (!firmante.firmadoEn || Number.isNaN(Date.parse(firmante.firmadoEn))) {
        falla(`DocuSign no informó cuándo firmó el destinatario ${firmante.recipientId}.`, 502);
      }

      if (!contrato.pdf_sha256) {
        falla(`El contrato ${contrato.id} no tiene el hash del PDF.`);
      }

      // US-07: se registra la IP de cada firma. La base no deja marcar "firmado" sin ella.
      const ip = await this.docusign.obtenerIpDeFirma(envelopeId, firmante.nombre);

      if (!ip || isIP(ip) === 0) {
        falla(`DocuSign no informó la IP de la firma del destinatario ${firmante.recipientId}.`, 502);
      }

      const resultado = exigirExito(
        await this.contratoRepo.registrarFirma(
          envelopeId,
          firmante.recipientId,
          new Date(firmante.firmadoEn).toISOString(),
          ip,
          contrato.pdf_sha256
        )
      );

      if (!resultado.ya_registrada) firmasRegistradas++;
    }

    // US-07: firmaron todos los destinatarios del sobre (locador, locatario y garantes).
    const firmaronTodos = sobre.firmantes.length > 0 && sobre.firmantes.every(f => f.estado === 'completed');
    let vigente = false;

    if (firmaronTodos) {
      const resultado = exigirExito(await this.contratoRepo.completarContrato(envelopeId), ['FIRMAS_INCOMPLETAS']);
      vigente = resultado.success;

      // US-42: el documento firmado se puede descargar. Si esto falla se lanza el error: el contrato
      // ya es vigente (la transacción se confirmó) y el reintento de DocuSign solo repite este paso.
      if (vigente) {
        await this.guardarDocumentoFirmado(contrato.id, envelopeId);
      }
    }

    return { accion: 'sincronizado', firmasRegistradas, vigente };
  }

  /**
   * Descarga de DocuSign el PDF final (con el certificado de finalización) y lo guarda en Storage
   * junto al contrato. Solo se guarda si de verdad es un PDF: no se publica cualquier cosa.
   */
  private async guardarDocumentoFirmado(idContrato: number, envelopeId: string): Promise<void> {
    const archivo = await this.docusign.descargarDocumentoFirmado(envelopeId);

    if (archivo.subarray(0, 5).toString('latin1') !== '%PDF-') {
      falla(`DocuSign devolvió un archivo que no es un PDF para el contrato ${idContrato}.`, 502);
    }

    await this.contratoRepo.guardarPdfFirmado(idContrato, archivo);
  }
}

export const docusignWebhookService = new DocusignWebhookService();
