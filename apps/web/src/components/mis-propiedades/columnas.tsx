'use client'

/**
 * columnas.tsx — las 8 columnas de "Mis propiedades" (US-02) y la cabecera
 * de su tarjeta móvil.
 *
 * Diseño: "Listado de propiedades" · 01 y 02 ("Las 8 columnas"): foto,
 * dirección, estado, estado del alquiler, reclamos, precio, locatario y
 * próximo ajuste. Sin columna de acciones: la fila entera abre el detalle.
 * Los links de adentro de la fila ("Ver contrato", el contador de reclamos)
 * cortan la propagación del click y van a su propio destino.
 *
 * Quién lo usa: `MisPropiedades.tsx`.
 */
import type { MouseEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PropiedadLocador } from '@rentar/shared-types'
import { IndexBadge, MoneyAmount, StatusTag, type DataTableColumn } from '@rentar/ui'
import { formatARS } from '@rentar/ui/src/utils/formatARS'
import { formatDate } from '@rentar/ui/src/utils/formatDate'
import { tipoCorto } from '@/lib/catalogs/propiedad'
import { USE_MOCKS } from '@/services/shared/config'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { diasHasta, nombreMes } from '@/lib/utils/fechas'
import styles from './MisPropiedades.module.css'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** El próximo ajuste va en ámbar si falta menos de esto (Listado · 02). */
const DIAS_AJUSTE_CERCANO = 60

/** Corta el click para que un link de la fila no abra también el detalle. */
function cortarClick(event: MouseEvent) {
  event.stopPropagation()
}

// ─── Celdas ────────────────────────────────────────────────────────────────

/** Miniatura de la foto principal (64×48, US-02: "imagen principal"). */
export function FotoPropiedad({ propiedad, size = 'table' }: { propiedad: PropiedadLocador; size?: 'table' | 'card' }) {
  const [width, height] = size === 'table' ? [64, 48] : [64, 52]
  // Si la foto no carga (ej. las URLs de prueba del seed), el placeholder.
  const foto = useFotoConRespaldo(propiedad.imageSrc)
  return (
    <Image
      src={foto.src}
      onError={foto.onError}
      alt=""
      width={width}
      height={height}
      // Las fotos del alta son data URLs guardadas en el navegador: no pasan por el optimizador.
      unoptimized
      className={styles.photo}
    />
  )
}

/** Dirección exacta y, debajo, barrio y tipo. */
function Direccion({ propiedad }: { propiedad: PropiedadLocador }) {
  return (
    <span className={styles.address}>
      <span className={styles.addressLine}>{propiedad.address}</span>
      <span className={styles.addressSub}>
        {propiedad.neighborhoodName} · {tipoCorto(propiedad.type, propiedad.rooms)}
      </span>
    </span>
  )
}

/** Estado de la publicación; si está alquilada con fecha, el chip "Disponible dd/mm/aaaa". */
function Estado({ propiedad }: { propiedad: PropiedadLocador }) {
  const conFecha = propiedad.availableFrom && (propiedad.status === 'alquilada' || propiedad.status === 'alquilada_publicada')
  return (
    <span className={styles.stack}>
      <StatusTag domain="propiedad" status={propiedad.status} />
      {conFecha && propiedad.availableFrom && <span className={styles.availableChip}>Disponible {formatDate(propiedad.availableFrom)}</span>}
    </span>
  )
}

/**
 * Estado del alquiler (US-02: "al día, con pago pendiente, retrasada"), con
 * el estilo del diseño: "Retrasada · 19 días". Sin contrato no aplica: raya.
 */
export function EstadoAlquiler({ propiedad }: { propiedad: PropiedadLocador }) {
  if (!propiedad.tenantName || !propiedad.paymentStatus) return <span className={styles.muted}>—</span>
  if (propiedad.paymentStatus === 'retrasada') {
    return (
      <span className={`${styles.chip} ${styles.chipRed}`} data-testid="mis-propiedades-pago">
        Retrasada{propiedad.daysOverdue ? ` · ${propiedad.daysOverdue} ${propiedad.daysOverdue === 1 ? 'día' : 'días'}` : ''}
      </span>
    )
  }
  if (propiedad.paymentStatus === 'pago_pendiente') {
    return (
      <span className={styles.stack}>
        <span className={`${styles.chip} ${styles.chipAmber}`} data-testid="mis-propiedades-pago">
          Con pago pendiente
        </span>
        {propiedad.paymentDueDate && <span className={styles.subText}>Vence el {formatDate(propiedad.paymentDueDate, 'DD/MM')}</span>}
      </span>
    )
  }
  return (
    <span className={styles.stack}>
      <span className={`${styles.chip} ${styles.chipGreen}`} data-testid="mis-propiedades-pago">
        Al día
      </span>
      {propiedad.paymentDueDate && <span className={styles.subText}>{capitalizar(nombreMes(propiedad.paymentDueDate))} cobrado</span>}
    </span>
  )
}

/** "septiembre" → "Septiembre". */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Reclamos sin resolver (US-02): el número es link a Reclamos; si no hay, "Sin reclamos". */
function Reclamos({ propiedad }: { propiedad: PropiedadLocador }) {
  if (propiedad.openClaims === 0) return <span className={styles.muted}>Sin reclamos</span>
  return (
    <Link href="/panel/reclamos" className={styles.claimsChip} onClick={cortarClick} data-testid="mis-propiedades-reclamos">
      {propiedad.openClaims} {propiedad.openClaims === 1 ? 'abierto' : 'abiertos'}
    </Link>
  )
}

/** Precio en dorado y expensas debajo. */
function Precio({ propiedad }: { propiedad: PropiedadLocador }) {
  return (
    <span className={styles.stack}>
      <MoneyAmount amount={propiedad.priceMonthly} emphasis />
      <span className={styles.subText}>{propiedad.expenses > 0 ? `+ ${formatARS(propiedad.expenses)} expensas` : 'sin expensas'}</span>
    </span>
  )
}

/**
 * `true` si es una alquilada cuyo locatario y próximo ajuste el back no manda
 * (con el back real, `/mis-alquileres` todavía no los trae).
 * NOTA: solo en modo real. En modo mock las alquiladas del elenco tienen
 * locatario, y una alquilada creada en el alta (sin locatario) sigue
 * mostrándose como antes.
 */
function datosDeAlquilerNoInformados(propiedad: PropiedadLocador): boolean {
  return !USE_MOCKS && (propiedad.status === 'alquilada' || propiedad.status === 'alquilada_publicada')
}

/**
 * Locatario actual y link al contrato (US-02: "nombre del locatario para
 * propiedades alquiladas").
 *
 * NOTA: una alquilada sin locatario es un dato que NO VINO (con el back
 * real, `/mis-alquileres` todavía no trae el locatario): se muestra "—", no
 * "Sin contrato", que sería falso. "Sin contrato" queda para las que no
 * están alquiladas (y, en modo mock, como estaba).
 */
function Locatario({ propiedad }: { propiedad: PropiedadLocador }) {
  if (!propiedad.tenantName) {
    return <span className={styles.muted}>{datosDeAlquilerNoInformados(propiedad) ? '—' : 'Sin contrato'}</span>
  }
  return (
    <span className={styles.stack}>
      <span className={styles.tenant}>{propiedad.tenantName}</span>
      <Link href="/panel/contratos" className={styles.inlineLink} onClick={cortarClick}>
        Ver contrato
      </Link>
    </span>
  )
}

/**
 * Próximo ajuste y su tipo (US-02). Alquiladas: índice + fecha (en ámbar a
 * menos de 60 días). Sin contrato, el índice cargado se aplica "al firmar".
 * NOTA: una alquilada sin próximo ajuste es un dato que no vino (el back
 * todavía no lo calcula): "—", nunca "al firmar".
 */
function ProximoAjuste({ propiedad }: { propiedad: PropiedadLocador }) {
  if (propiedad.nextAdjustment) {
    const cerca = diasHasta(propiedad.nextAdjustment.date) <= DIAS_AJUSTE_CERCANO
    return (
      <span className={styles.adjust}>
        <IndexBadge index={propiedad.nextAdjustment.index} />
        <span className={cerca ? styles.adjustSoon : undefined}>{formatDate(propiedad.nextAdjustment.date)}</span>
      </span>
    )
  }
  if (propiedad.adjustmentIndex && !propiedad.tenantName && !datosDeAlquilerNoInformados(propiedad)) {
    return (
      <span className={styles.adjust}>
        <IndexBadge index={propiedad.adjustmentIndex} />
        <span className={styles.muted}>al firmar</span>
      </span>
    )
  }
  return <span className={styles.muted}>—</span>
}

// ─── Columnas y tarjeta móvil ──────────────────────────────────────────────

/** Las 8 columnas del diseño. Foto y dirección no se repiten en la tarjeta móvil (van en su cabecera). */
export const columnasMisPropiedades: DataTableColumn<PropiedadLocador>[] = [
  { key: 'foto', title: 'Foto', render: (propiedad) => <FotoPropiedad propiedad={propiedad} />, hideInCard: true },
  { key: 'direccion', title: 'Dirección', render: (propiedad) => <Direccion propiedad={propiedad} />, hideInCard: true },
  { key: 'estado', title: 'Estado', render: (propiedad) => <Estado propiedad={propiedad} /> },
  { key: 'pago', title: 'Estado del alquiler', render: (propiedad) => <EstadoAlquiler propiedad={propiedad} /> },
  { key: 'reclamos', title: 'Reclamos', render: (propiedad) => <Reclamos propiedad={propiedad} /> },
  { key: 'precio', title: 'Precio', render: (propiedad) => <Precio propiedad={propiedad} /> },
  { key: 'locatario', title: 'Locatario actual', render: (propiedad) => <Locatario propiedad={propiedad} /> },
  { key: 'ajuste', title: 'Próximo ajuste', render: (propiedad) => <ProximoAjuste propiedad={propiedad} /> },
]

/** Cabecera de la tarjeta móvil: foto, dirección y barrio (Listado · 03). */
export function CabeceraTarjeta({ propiedad }: { propiedad: PropiedadLocador }) {
  return (
    <span className={styles.cardHeader}>
      <FotoPropiedad propiedad={propiedad} size="card" />
      <span className={styles.address}>
        <span className={styles.addressLine}>{propiedad.address}</span>
        <span className={styles.addressSub}>{propiedad.neighborhoodName}</span>
      </span>
    </span>
  )
}
