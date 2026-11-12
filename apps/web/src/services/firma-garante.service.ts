/**
 * firma-garante.service.ts — frontera con el backend para la página pública del garante.
 *
 * Qué es: las dos rutas que usa `/firma-garante/[token]`: ver qué va a firmar y
 * pedir la URL de firma. Son públicas: van SIN Bearer (`auth: false`), porque el
 * garante no tiene cuenta; el enlace es su credencial.
 * Cubre: US-07 Firmar contrato de alquiler, "Garantes".
 * De dónde saca los datos:
 * - Modo mock: el contrato guardado cuyo garante tiene el hash de este token
 *   (`contrato-mock.adapter.ts#garantePorHashMock`), con las mismas reglas que el
 *   back: 48 h de vigencia, contrato pendiente de firma y garante sin firmar. La
 *   firma pasa por el simulador (`/simulador-firma`).
 * - Modo real: `GET /firma-garante/:token` y `POST /firma-garante/:token/firmar`.
 * Quién lo usa: `components/firma-garante/FirmaGarante.tsx`.
 *
 * NOTA (seguridad): el token solo viaja en el path de la API. No se loguea ni se
 * guarda en el navegador (tampoco en mock: ahí se guarda solo su hash).
 */
import type { FirmaGarantePublica } from '@rentar/shared-types'
import dayjs from 'dayjs'
import { formatAddress } from './adapters/propiedad-mock.adapter'
import { ahoraIsoMock, aplicarFirmasDiferidasMock, garantePorHashMock, hashDeTokenMock, readPropiedadesContratoMock } from './adapters/contrato-mock.adapter'
import { ENLACE_INVALIDO_MESSAGE, errorDeFirmaGarante, firmaGaranteDeDto } from './adapters/firma-garante.adapter'
import { urlDelSimuladorMock } from './contratos.service'
import { apiRequest } from './shared/apiClient'
import type { ConsultaEnlaceGaranteResponse, FirmarContratoRequest, IniciarFirmaResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'

/** Ruta pública del token, siempre codificada (el token es base64url, pero no se confía en la URL). */
function rutaDelEnlace(token: string): string {
  return `/firma-garante/${encodeURIComponent(token)}`
}

/**
 * Rama mock: el garante dueño del enlace, si el enlace sirve. Cualquier motivo
 * por el que no sirva (inexistente, vencido, reemplazado por otro, garante que
 * ya firmó, contrato que dejó de estar pendiente) es el mismo 404, como el back.
 */
async function garanteDelEnlaceMock(token: string) {
  aplicarFirmasDiferidasMock()
  const encontrado = /^[A-Za-z0-9_-]{43}$/.test(token) ? garantePorHashMock(await hashDeTokenMock(token)) : null
  const firma = encontrado?.contrato.firmas?.garantes[encontrado.posicion]
  const vencido = !firma?.enlace || !dayjs(ahoraIsoMock()).isBefore(dayjs(firma.enlace.venceEl))
  if (!encontrado || !firma || vencido || encontrado.contrato.status !== 'pendiente_firma' || firma.estado !== 'pendiente') {
    throw new ServiceError('not_found', ENLACE_INVALIDO_MESSAGE)
  }
  return { ...encontrado, venceEl: firma.enlace?.venceEl ?? null }
}

/**
 * US-07 — Lo que ve el garante al abrir su enlace: su nombre, el código y la
 * propiedad. Nunca DNI, montos ni datos del locador o del locatario.
 * @backend GET /api/v1/firma-garante/:token   (existe · público, sin Bearer) → ConsultaEnlaceGaranteResponse
 * @throws {ServiceError}
 *   - `not_found` "Este enlace no es válido o ya no está disponible." (siempre el mismo, sin distinguir el motivo).
 *   - `too_many_requests`: más de 30 pedidos en 10 minutos.
 */
export async function consultarEnlaceGarante(token: string): Promise<FirmaGarantePublica> {
  if (USE_MOCKS) {
    await delay(400)
    const { contrato, posicion, venceEl } = await garanteDelEnlaceMock(token)
    const propiedad = readPropiedadesContratoMock().find((item) => item.id === contrato.propertyId)
    return {
      nombre: contrato.garantes[posicion]?.fullName ?? '',
      codigo: contrato.code,
      propiedad: propiedad ? `${formatAddress(propiedad)}, ${propiedad.neighborhoodName}` : '',
      venceEl,
    }
  }
  try {
    return firmaGaranteDeDto(await apiRequest<ConsultaEnlaceGaranteResponse>(rutaDelEnlace(token), { auth: false }))
  } catch (error) {
    throw errorDeFirmaGarante(error)
  }
}

/**
 * US-07 — El garante pide la URL de DocuSign donde firma. La pantalla ya pidió
 * la casilla y la confirmación (D2: sin la lectura hasta la última página: el
 * contrato se lee en DocuSign). Redirige enseguida: la URL dura pocos minutos y
 * se usa una sola vez. El enlace deja de servir cuando se registra la firma.
 * En mock, la URL es la del simulador, con la ruta de regreso en el fragmento.
 * @backend POST /api/v1/firma-garante/:token/firmar   (existe · público, sin Bearer) body `{ acepta_condiciones: true }` → 200 IniciarFirmaResponse
 * @throws {ServiceError}
 *   - `not_found`: el mismo mensaje del enlace inválido. `too_many_requests`: 429.
 *   - `validation` `FALTA_ACEPTAR_CONDICIONES`; `conflict` `SOBRE_NO_DISPONIBLE`; `server`: DocuSign no respondió (502).
 */
export async function iniciarFirmaGarante(token: string): Promise<{ url: string }> {
  if (USE_MOCKS) {
    await delay()
    const { contrato, posicion } = await garanteDelEnlaceMock(token)
    return { url: urlDelSimuladorMock({ contratoId: contrato.id, firmante: `garante-${posicion + 1}`, regreso: rutaDelEnlace(token) }) }
  }
  try {
    const body: FirmarContratoRequest = { acepta_condiciones: true }
    return await apiRequest<IniciarFirmaResponse>(`${rutaDelEnlace(token)}/firmar`, { method: 'POST', body, auth: false })
  } catch (error) {
    throw errorDeFirmaGarante(error)
  }
}
