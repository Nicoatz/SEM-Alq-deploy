/**
 * pdf.ts — el contrato en PDF ("Descargar PDF").
 *
 * Cubre: US-07 Firmar contrato de alquiler: "se debe mostrar el documento del
 * contrato y permitir descargarlo en PDF en cualquier estado".
 *
 * NOTA (decisión del PO, tanda 3 del Sprint 3): se arma en el navegador con
 * `jsPDF` (4.2.1, MIT) y su API de TEXTO, sin `html2canvas`. La librería se
 * carga con `import()` recién al tocar "Descargar PDF": queda en un chunk
 * aparte y no entra en la carga inicial de ninguna página (~130 KB gzip).
 * El texto es el mismo que muestra el visor (`plantilla.ts`); las páginas del
 * PDF son hojas A4 y no coinciden con las del visor (esas se definen por
 * contenido para medir la lectura, ver `paginas.ts`).
 * TODO(backend): cuando el back genere el PDF (con la firma y la IP), este
 * archivo se reemplaza por la descarga de ese documento.
 *
 * Quién lo usa: `components/contratos/DetalleContrato.tsx` (`VistaContrato`,
 * en el detalle del locador y en Mi alquiler).
 */
import type { ContratoDetalle } from '@rentar/shared-types'
import { fechaCorta, MESES_POR_PERIODO } from './fechas'
import { fechaYHora, NOMBRE_ROL } from './firmas'
import { ordinal, tituloContrato } from './plantilla'

/** Cómo se nombra cada estado del contrato en el PDF. */
const ESTADO: Record<ContratoDetalle['status'], string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente de firma',
  vigente: 'Vigente',
  finalizado: 'Finalizado',
  rescindido: 'Rescindido',
}

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/** Nombre del archivo: el código del contrato (o "contrato" si no tiene). */
export function nombreArchivoPdf(contrato: Pick<ContratoDetalle, 'code'>): string {
  return `${contrato.code ?? 'contrato'}.pdf`
}

/** "Nombre Apellido" de una parte. */
function nombre(parte: ContratoDetalle['locador']): string {
  return `${parte.nombre} ${parte.apellido}`.trim() || 'Sin dato'
}

/** Las líneas de "Datos del contrato", como en el detalle. */
function datosDelContrato(contrato: ContratoDetalle): [string, string][] {
  const { condiciones, propiedad } = contrato
  const vigencia =
    condiciones.startDate && contrato.endDate
      ? `Del ${fechaCorta(condiciones.startDate)} al ${fechaCorta(contrato.endDate)}${condiciones.durationMonths ? ` (${condiciones.durationMonths} meses)` : ''}`
      : 'Sin dato'
  const ajuste =
    condiciones.adjustmentIndex === 'sin_ajuste'
      ? 'Sin ajuste'
      : `${condiciones.adjustmentIndex}${condiciones.adjustmentPeriod ? `, cada ${MESES_POR_PERIODO[condiciones.adjustmentPeriod]} meses` : ''}`
  return [
    ['Propiedad', `${propiedad.address}${propiedad.neighborhoodName ? `, ${propiedad.neighborhoodName}` : ''}`],
    ['Locador', nombre(contrato.locador)],
    ['Locatario', nombre(contrato.locatario)],
    ['Garantes', contrato.garantes.length === 0 ? 'Sin garantes' : contrato.garantes.map((garante) => garante.fullName).join(', ')],
    ['Vigencia', vigencia],
    ['Monto inicial', condiciones.initialAmount === null ? 'Sin dato' : pesos.format(condiciones.initialAmount)],
    ['Depósito', condiciones.deposit === null ? 'Sin dato' : pesos.format(condiciones.deposit)],
    ['Ajuste', ajuste],
    ['Vencimiento del pago', condiciones.paymentDueDay === null ? 'Sin dato' : `Día ${condiciones.paymentDueDay} de cada mes`],
  ]
}

/** El estado de cada firma, para el final del documento. */
function lineasDeFirmas(contrato: ContratoDetalle): string[] {
  if (!contrato.firmasRegistradas) return ['Contrato anterior a RentAR: no hay registro de las firmas.']
  return contrato.firmantes.map((firmante) => {
    const rol = NOMBRE_ROL[firmante.rol]
    if (firmante.estado === 'firmado' && firmante.firmadoEl) return `${rol}: ${firmante.nombre}. Firmó el ${fechaYHora(firmante.firmadoEl)}.`
    if (firmante.estado === 'rechazado') return `${rol}: ${firmante.nombre}. Rechazó la firma${firmante.rechazadoEl ? ` el ${fechaYHora(firmante.rechazadoEl)}` : ''}.`
    return `${rol}: ${firmante.nombre}. Pendiente de firma.`
  })
}

/**
 * Arma el PDF del contrato y lo descarga (`<código>.pdf`). Carga `jsPDF` en
 * este momento (import dinámico).
 * @throws el error de la librería si no se pudo cargar o armar (la pantalla muestra un aviso).
 */
export async function descargarContratoPdf(contrato: ContratoDetalle): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ANCHO = doc.internal.pageSize.getWidth()
  const ALTO = doc.internal.pageSize.getHeight()
  const MARGEN = 20
  const UTIL = ANCHO - MARGEN * 2
  const PIE = ALTO - 14
  let y = MARGEN

  /** Escribe un párrafo con salto de línea y de página. */
  function parrafo(texto: string, opciones: { tamanio?: number; negrita?: boolean; despues?: number } = {}): void {
    const tamanio = opciones.tamanio ?? 10.5
    doc.setFont('helvetica', opciones.negrita ? 'bold' : 'normal')
    doc.setFontSize(tamanio)
    const alto = tamanio * 0.45
    for (const linea of doc.splitTextToSize(texto, UTIL) as string[]) {
      if (y + alto > PIE - 6) {
        doc.addPage()
        y = MARGEN
      }
      doc.text(linea, MARGEN, y)
      y += alto
    }
    y += opciones.despues ?? 3
  }

  // ─── Encabezado ─────────────────────────────────────────────────────
  parrafo(tituloContrato(contrato), { tamanio: 15, negrita: true, despues: 2 })
  parrafo(`${contrato.code ?? 'Sin código'} · ${ESTADO[contrato.status]}`, { tamanio: 10, despues: 6 })

  // ─── Datos del contrato ─────────────────────────────────────────────
  parrafo('Datos del contrato', { tamanio: 12, negrita: true, despues: 1 })
  for (const [etiqueta, valor] of datosDelContrato(contrato)) parrafo(`${etiqueta}: ${valor}`, { despues: 1 })
  y += 4

  // ─── Cláusulas ──────────────────────────────────────────────────────
  parrafo('Cláusulas', { tamanio: 12, negrita: true, despues: 2 })
  contrato.clausulas.forEach((clausula, indice) => {
    parrafo(`${ordinal(indice + 1)}. ${clausula.titulo || 'Sin título'}.`, { negrita: true, despues: 0.5 })
    parrafo(clausula.texto || '[sin texto]', { despues: 4 })
  })

  // ─── Firmas ─────────────────────────────────────────────────────────
  y += 2
  parrafo('Firmas', { tamanio: 12, negrita: true, despues: 1 })
  for (const linea of lineasDeFirmas(contrato)) parrafo(linea, { despues: 1 })
  parrafo('En esta versión de RentAR la firma electrónica es simulada: no tiene validez legal.', { tamanio: 9, despues: 0 })

  // ─── Pie de cada hoja ───────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  for (let hoja = 1; hoja <= total; hoja++) {
    doc.setPage(hoja)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(`RentAR · ${contrato.code ?? 'Contrato'}`, MARGEN, PIE + 4)
    doc.text(`Página ${hoja} de ${total}`, ANCHO - MARGEN, PIE + 4, { align: 'right' })
  }

  doc.save(nombreArchivoPdf(contrato))
}
