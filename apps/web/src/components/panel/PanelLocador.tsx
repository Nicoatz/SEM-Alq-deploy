'use client'

/**
 * PanelLocador.tsx — `/panel`, el inicio del locador.
 *
 * Qué muestra (Claude Design, "Panel de inicio" · 01 y 03): el saludo con
 * las cosas para resolver hoy, las StatCards ("primero la plata"), próximos
 * cobros, reclamos recientes y contratos por vencer o ajustar en 60 días.
 * Sin propiedades, el panel se convierte en onboarding (· 02).
 *
 * De dónde saca los datos: cada bloque se pide por separado, así si falla
 * uno falla solo ese (· 03). Conteos de propiedades:
 * `propiedades.service#listarMisPropiedades`; el resto, `panel.service`.
 * Cómo se calcula cada cifra: ver `lib/mocks/panel.mock.ts`.
 *
 * NOTA: el banner "Tu suscripción vence el 30/09" del diseño no va: la
 * suscripción no es de este sprint y el elenco no la define.
 *
 * "N solicitudes nuevas" es un link a `/panel/solicitudes` (US-36, tanda 2
 * del Sprint 2): el diseño del panel no dibuja una tarjeta de solicitudes.
 *
 * Cubre: sin US en Sprint 0 (inicio del locador, mapa A3). Los conteos de
 * propiedades cierran con US-02 (7 cargadas, 4 alquiladas para Nicolás).
 * Quién lo usa: `app/(app)/panel/page.tsx`.
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { Button, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import type { PropiedadLocador, ResumenCobros, ResumenReclamos, SolicitudPanel } from '@rentar/shared-types'
import { StatCard } from '@rentar/ui'
import { formatARS } from '@rentar/ui/src/utils/formatARS'
import { useServiceCall, type EstadoServicio } from '@/lib/hooks/useServiceCall'
import { diasDesde, esDelMesActual, fechaLarga, hoy, nombreMes, textoDias } from '@/lib/utils/fechas'
import { getEventosContratos, getResumenCobros, getResumenReclamos, getSolicitudesPendientes } from '@/services/panel.service'
import { listarMisPropiedades } from '@/services/propiedades.service'
import { Bloque, BloqueCargando, BloqueError, ContratosProximos, ProximosCobros, ReclamosRecientes } from './BloquesPanel'
import { OnboardingLocador } from './OnboardingLocador'
import styles from './Panel.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * "Buen día" hasta las 13, "Buenas tardes" hasta las 20, después "Buenas noches".
 * NOTA: usa la hora real a propósito: el "hoy" fijo del modo mock fija la
 * fecha (los días de atraso), no la hora del día.
 */
function saludo(): string {
  const hora = new Date().getHours()
  if (hora < 13) return 'Buen día'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

/** "1 cobro vencido" / "2 cobros vencidos". */
function contar(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}

/** "a, b y c", con partes que pueden ser links. */
function enumerar(partes: ReactNode[]): ReactNode {
  return partes.map((parte, index) => (
    <Fragment key={index}>
      {index > 0 && (index === partes.length - 1 ? ' y ' : ', ')}
      {parte}
    </Fragment>
  ))
}

/**
 * "Tenés 4 cosas para resolver hoy: 2 cobros vencidos, 1 reclamo sin
 * responder y 1 solicitud nueva." Mientras algún bloque carga (o si falló),
 * no se cuenta: mejor no decir un número que después cambia. "1 solicitud
 * nueva" lleva a Solicitudes recibidas.
 */
function pendientesDeHoy(
  cobros: EstadoServicio<ResumenCobros>,
  reclamos: EstadoServicio<ResumenReclamos>,
  solicitudes: EstadoServicio<SolicitudPanel[]>,
): ReactNode {
  if (cobros.status !== 'listo' || reclamos.status !== 'listo' || solicitudes.status !== 'listo') return null
  const partes: ReactNode[] = []
  if (cobros.data.overdueCount) partes.push(contar(cobros.data.overdueCount, 'cobro vencido', 'cobros vencidos'))
  if (reclamos.data.unanswered) partes.push(contar(reclamos.data.unanswered, 'reclamo sin responder', 'reclamos sin responder'))
  if (solicitudes.data.length) {
    partes.push(
      <Link href="/panel/solicitudes" className={styles.inlineLink} data-testid="panel-solicitudes-link">
        {contar(solicitudes.data.length, 'solicitud nueva', 'solicitudes nuevas')}
      </Link>,
    )
  }
  const total = cobros.data.overdueCount + reclamos.data.unanswered + solicitudes.data.length
  if (total === 0) return 'No tenés nada pendiente para hoy.'
  return (
    <>
      Tenés {contar(total, 'cosa', 'cosas')} para resolver hoy: {enumerar(partes)}.
    </>
  )
}

/** Conteos de propiedades para las StatCards. */
function conteos(propiedades: PropiedadLocador[]) {
  const alquiladas = propiedades.filter((item) => item.status === 'alquilada' || item.status === 'alquilada_publicada').length
  return {
    cargadas: propiedades.length,
    alquiladas,
    publicadas: propiedades.filter((item) => item.status === 'publicada').length,
    nuevasEsteMes: propiedades.filter((item) => item.publishedAt && esDelMesActual(item.publishedAt)).length,
  }
}

/** Tarjeta vacía con la forma de una StatCard, mientras carga su bloque. */
function StatCardCargando() {
  return (
    <Skeleton.Node active className={styles.skeletonStat}>
      <span />
    </Skeleton.Node>
  )
}

// ─── Pantalla ───────────────────────────────────────────────────────────

/** Inicio del locador. `nombre` es el nombre de pila, para el saludo. */
export function PanelLocador({ nombre }: { nombre: string }) {
  const router = useRouter()
  const propiedades = useServiceCall(listarMisPropiedades)
  const cobros = useServiceCall(getResumenCobros)
  const reclamos = useServiceCall(getResumenReclamos)
  const contratos = useServiceCall(getEventosContratos)
  const solicitudes = useServiceCall(getSolicitudesPendientes)

  // Sin propiedades no hay métricas: onboarding (· 02).
  if (propiedades.status === 'listo' && propiedades.data.length === 0) {
    return <OnboardingLocador nombre={nombre} />
  }

  const pendientes = pendientesDeHoy(cobros, reclamos, solicitudes)
  const cuenta = propiedades.status === 'listo' ? conteos(propiedades.data) : null
  const mes = cobros.status === 'listo' ? nombreMes(`${cobros.data.month}-01`) : nombreMes(hoy().format('YYYY-MM-DD'))

  // ─── StatCards ──────────────────────────────────────────────────────
  const statCobrado =
    cobros.status === 'listo' ? (
      <StatCard
        title="Cobrado / Total del mes"
        value={`${formatARS(cobros.data.collected)} / ${formatARS(cobros.data.total)}`}
        delta={{
          label:
            cobros.data.total > 0
              ? `${Math.round((cobros.data.collected / cobros.data.total) * 100)} % cobrado · faltan ${formatARS(cobros.data.total - cobros.data.collected)}`
              : 'Sin cobros este mes',
          trend: cobros.data.total > 0 ? 'up' : 'neutral',
        }}
        data-testid="panel-stat-cobrado"
      />
    ) : cobros.status === 'cargando' ? (
      <StatCardCargando />
    ) : (
      <StatCard title="Cobrado / Total del mes" value="—" data-testid="panel-stat-cobrado" />
    )

  const vencidoMasViejo =
    cobros.status === 'listo'
      ? Math.max(0, ...cobros.data.items.filter((cobro) => cobro.status === 'vencido').map((cobro) => diasDesde(cobro.dueDate)))
      : 0
  const statVencidos =
    cobros.status === 'listo' ? (
      <StatCard
        title="Cobros vencidos"
        value={<span className={cobros.data.overdueAmount > 0 ? styles.overdueValue : undefined}>{formatARS(cobros.data.overdueAmount)}</span>}
        delta={
          cobros.data.overdueCount > 0
            ? { label: `${contar(cobros.data.overdueCount, 'cobro', 'cobros')} · el más viejo, ${textoDias(vencidoMasViejo)}`, trend: 'down' }
            : { label: 'Nada vencido', trend: 'neutral' }
        }
        data-testid="panel-stat-vencidos"
      />
    ) : cobros.status === 'cargando' ? (
      <StatCardCargando />
    ) : (
      <StatCard title="Cobros vencidos" value="—" data-testid="panel-stat-vencidos" />
    )

  return (
    <div className={styles.page} data-testid="panel-locador">
      {/* Saludo y acciones: se pintan de entrada, no dependen de datos (· 03). */}
      <div className={styles.top}>
        <div className={styles.greeting}>
          <h2 className={styles.greetingTitle}>
            {saludo()}, {nombre}
          </h2>
          <p className={styles.greetingText} data-testid="panel-pendientes">
            {fechaLarga()}
            {pendientes && <> · {pendientes}</>}
          </p>
        </div>
        <div className={styles.actions}>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => router.push('/panel/propiedades/nueva')} data-testid="panel-publicar">
            Publicar propiedad
          </Button>
          <Button size="large" onClick={() => router.push('/panel/cobros')} data-testid="panel-registrar-pago">
            Registrar un pago
          </Button>
        </div>
      </div>

      {/* StatCards de escritorio: 3 + 2 (· 01). */}
      <div className={styles.statsDesktop}>
        <div className={styles.statsRow3}>
          {cuenta ? (
            <>
              <StatCard
                title="Propiedades cargadas"
                value={String(cuenta.cargadas)}
                delta={cuenta.nuevasEsteMes > 0 ? { label: `+${cuenta.nuevasEsteMes} este mes`, trend: 'up' } : undefined}
                data-testid="panel-stat-cargadas"
              />
              <StatCard
                title="Propiedades alquiladas"
                value={String(cuenta.alquiladas)}
                delta={{ label: contar(cuenta.publicadas, 'disponible', 'disponibles'), trend: 'neutral' }}
                data-testid="panel-stat-alquiladas"
              />
            </>
          ) : propiedades.status === 'cargando' ? (
            <>
              <StatCardCargando />
              <StatCardCargando />
            </>
          ) : (
            <>
              <StatCard title="Propiedades cargadas" value="—" data-testid="panel-stat-cargadas" />
              <StatCard title="Propiedades alquiladas" value="—" data-testid="panel-stat-alquiladas" />
            </>
          )}
          {reclamos.status === 'listo' ? (
            <StatCard
              title="Reclamos abiertos"
              value={String(reclamos.data.open)}
              delta={reclamos.data.unanswered > 0 ? { label: `${reclamos.data.unanswered} sin responder`, trend: 'down' } : undefined}
              data-testid="panel-stat-reclamos"
            />
          ) : reclamos.status === 'cargando' ? (
            <StatCardCargando />
          ) : (
            <StatCard title="Reclamos abiertos" value="—" data-testid="panel-stat-reclamos" />
          )}
        </div>
        <div className={styles.statsRow2}>
          {statCobrado}
          {statVencidos}
        </div>
      </div>

      {/* StatCards de móvil: dos columnas, cuatro cifras (· 03). */}
      <div className={styles.statsMobile}>
        <MiniStat label="Publicadas" value={cuenta ? String(cuenta.publicadas) : null} failed={propiedades.status === 'error'} />
        <MiniStat label="Alquiladas" value={cuenta ? String(cuenta.alquiladas) : null} failed={propiedades.status === 'error'} />
        <MiniStat
          label={`Cobrado en ${mes}`}
          value={cobros.status === 'listo' ? formatARS(cobros.data.collected) : null}
          failed={cobros.status === 'error'}
          tone="gold"
        />
        <MiniStat label="Vencidos" value={cobros.status === 'listo' ? formatARS(cobros.data.overdueAmount) : null} failed={cobros.status === 'error'} tone="red" />
      </div>
      <Button type="primary" size="large" block icon={<PlusOutlined />} className={styles.mobileOnly} onClick={() => router.push('/panel/propiedades/nueva')} data-testid="panel-publicar-movil">
        Publicar propiedad
      </Button>

      <div className={styles.blocksGrid}>
        <Bloque title="Próximos cobros" link={{ href: '/panel/cobros', label: 'Ver todos', testId: 'panel-cobros-ver-todos' }} data-testid="panel-bloque-cobros">
          {cobros.status === 'listo' && <ProximosCobros resumen={cobros.data} />}
          {cobros.status === 'cargando' && <BloqueCargando />}
          {cobros.status === 'error' && <BloqueError title="No pudimos traer tus cobros" onReintentar={cobros.reintentar} data-testid="panel-error-cobros" />}
        </Bloque>
        <Bloque title="Reclamos recientes" link={{ href: '/panel/reclamos', label: 'Ver todos', testId: 'panel-reclamos-ver-todos' }} data-testid="panel-bloque-reclamos">
          {reclamos.status === 'listo' && <ReclamosRecientes resumen={reclamos.data} />}
          {reclamos.status === 'cargando' && <BloqueCargando />}
          {reclamos.status === 'error' && <BloqueError title="No pudimos traer tus reclamos" onReintentar={reclamos.reintentar} data-testid="panel-error-reclamos" />}
        </Bloque>
      </div>

      <Bloque
        title="Contratos por vencer o por ajustar · próximos 60 días"
        link={{ href: '/panel/contratos', label: 'Ir a Contratos', testId: 'panel-ir-contratos' }}
        data-testid="panel-bloque-contratos"
      >
        {contratos.status === 'listo' && <ContratosProximos eventos={contratos.data} />}
        {contratos.status === 'cargando' && <BloqueCargando filas={2} />}
        {contratos.status === 'error' && <BloqueError title="No pudimos traer tus contratos" onReintentar={contratos.reintentar} data-testid="panel-error-contratos" />}
      </Bloque>

      {propiedades.status === 'error' && (
        <BloqueError title="No pudimos traer tus propiedades" onReintentar={propiedades.reintentar} data-testid="panel-error-propiedades" />
      )}
    </div>
  )
}

// ─── StatCard compacta de móvil ─────────────────────────────────────────

interface MiniStatProps {
  label: string
  /** `null` mientras carga. */
  value: string | null
  failed: boolean
  /** Dorado para la plata cobrada, rojo para lo vencido (· 03). */
  tone?: 'gold' | 'red'
}

/** Tarjeta chica de dos columnas del panel móvil (compuesta acá: aprobado por producto). */
function MiniStat({ label, value, failed, tone }: MiniStatProps) {
  if (value === null && !failed) {
    return (
      <Skeleton.Node active className={styles.skeletonMiniStat}>
        <span />
      </Skeleton.Node>
    )
  }
  return (
    <div className={`${styles.miniStat} ${tone === 'gold' ? styles.miniStatGold : ''} ${tone === 'red' ? styles.miniStatRed : ''}`}>
      <span className={styles.miniStatLabel}>{label}</span>
      <span className={styles.miniStatValue}>{value ?? '—'}</span>
    </div>
  )
}
