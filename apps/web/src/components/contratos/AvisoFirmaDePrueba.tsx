/**
 * AvisoFirmaDePrueba.tsx — "la firma no tiene validez legal" mientras se use el
 * entorno de prueba de DocuSign.
 *
 * Cubre: US-07 Firmar contrato de alquiler ("Antes de firmar, se debe informar
 * que, mientras se use el entorno de prueba de DocuSign, la firma no tiene
 * validez legal") y la guía del back, §5 (el mismo aviso junto al documento
 * firmado).
 * NOTA (D3, PO 11/11): es un `Alert` local y no `SimulatedFeatureNotice` de
 * `@rentar/ui`, que dice fijo "todavía es simulada". Cuando `/design-sync`
 * vuelva a andar, conviene sumarle una prop `title` y reemplazar este aviso
 * (anotado en `.design-sync/NOTES.md`).
 * Quién lo usa: `FirmaContrato.tsx` y `DetalleContrato.tsx` (documento firmado).
 */
import { Alert } from 'antd'

/** Texto del aviso (D3). */
export const TEXTO_FIRMA_DE_PRUEBA = 'Firma de prueba: mientras usemos el entorno de prueba de DocuSign, la firma no tiene validez legal.'

/** Props de {@link AvisoFirmaDePrueba}. */
interface AvisoFirmaDePruebaProps {
  'data-testid'?: string
}

/** El aviso de firma de prueba (informativo, no un error). */
export function AvisoFirmaDePrueba({ 'data-testid': testId }: AvisoFirmaDePruebaProps) {
  return <Alert type="info" showIcon title={TEXTO_FIRMA_DE_PRUEBA} data-testid={testId} />
}
