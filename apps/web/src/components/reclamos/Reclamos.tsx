'use client'

/**
 * Reclamos.tsx — `/panel/reclamos`, los reclamos del usuario según su rol activo.
 *
 * Cubre US-15 Consultar reclamos:
 * - "Si no hay reclamos para ninguna propiedad … informarlo con un mensaje
 *   amigable": un vacío distinto para el locador y para el locatario.
 * - "la propiedad del reclamo con su imagen principal y dirección, el estado …,
 *   el tipo de reclamo y un fragmento del mensaje".
 * - "si se es locatario … la foto de perfil y nombre del locador; si se es
 *   locador … del locatario".
 *
 * Qué muestra (Claude Design, "Reclamos" · 02, 02b, 04 y 05):
 * - Locador: "Reclamos", agrupados por propiedad, con su locatario.
 * - Locatario: "Mis reclamos", sin agrupar, con el locador y el botón
 *   "Registrar reclamo" (US-14).
 * - Pestañas por estado con contador, filtro por tipo y orden "Más recientes
 *   primero" (el único que pide la Tanda A).
 * - Carga con skeleton, error con "Reintentar" y vacío.
 *
 * Rol: la vista sale del rol activo ("Viendo como"), sin `RequireRole` (igual
 * que hoy). En real, el rol viaja como `?rol=`.
 *
 * De dónde saca los datos: `listarReclamos` (`services/reclamos.service.ts`).
 * Quién lo usa: `app/(app)/panel/reclamos/page.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Select, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { TIPOS_RECLAMO } from '@/lib/reclamos/catalogo'
import {
  agruparPorPropiedad,
  contarPorPestania,
  filtrarPorPestania,
  filtrarPorTipo,
  ordenarRecientes,
  PESTANIAS_RECLAMOS,
  resumenEstados,
  TODOS_LOS_TIPOS,
  type FiltroTipoReclamo,
  type PestaniaReclamos,
} from '@/lib/reclamos/filtros'
import type { RolReclamos } from '@/lib/reclamos/tipos'
import { listarReclamos } from '@/services/reclamos.service'
import { PestaniasSolicitudes } from '@/components/solicitudes/PestaniasSolicitudes'
import { FilaReclamo } from './FilaReclamo'
import { GrupoReclamos } from './GrupoReclamos'
import styles from './Reclamos.module.css'

/** Opciones del filtro por tipo (US-14: los cinco tipos). */
const OPCIONES_TIPO = [{ value: TODOS_LOS_TIPOS, label: 'Todos los tipos' }, ...TIPOS_RECLAMO.map((tipo) => ({ value: tipo.nombre, label: tipo.label }))]

/** Orden: por ahora el único que pide la Tanda A. Se muestra igual, como en el diseño. */
const OPCIONES_ORDEN = [{ value: 'recientes', label: 'Más recientes primero' }]

/** Textos que cambian con el rol (· 02 y 02b). */
const TEXTOS: Record<RolReclamos, { titulo: string; miga: string }> = {
  locador: { titulo: 'Reclamos', miga: 'Reclamos' },
  locatario: { titulo: 'Mis reclamos', miga: 'Mis reclamos' },
}

/** Skeleton con la forma del listado: un encabezado y dos filas (· 05). */
function Cargando() {
  return (
    <div className={styles.grupo} data-testid="reclamos-cargando" aria-busy="true">
      <div className={styles.skeletonHeader}>
        <Skeleton.Image active className={styles.skeletonFoto} />
        <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 1, width: '25%' }} />
      </div>
      {[0, 1].map((fila) => (
        <div key={fila} className={styles.skeletonFila}>
          <Skeleton.Button active shape="round" />
          <Skeleton active title={false} paragraph={{ rows: 2, width: ['90%', '50%'] }} />
          <Skeleton.Button active shape="round" size="small" />
        </div>
      ))}
    </div>
  )
}

/** Los reclamos del usuario en sesión, según el rol activo. */
export function Reclamos() {
  const router = useRouter()
  const { activeRole } = useAuth()
  // Sin rol todavía (la sesión se está resolviendo), se toma locatario: todas las cuentas lo son.
  const rol: RolReclamos = activeRole === 'locador' ? 'locador' : 'locatario'
  const cargar = useCallback(() => listarReclamos(rol), [rol])
  const carga = useServiceCall(cargar)

  // ─── Estado local ───────────────────────────────────────────────────
  const [pestania, setPestania] = useState<PestaniaReclamos>('todos')
  const [tipo, setTipo] = useState<FiltroTipoReclamo>(TODOS_LOS_TIPOS)

  const todos = useMemo(() => (carga.status === 'listo' ? ordenarRecientes(carga.data) : []), [carga])
  const delTipo = useMemo(() => filtrarPorTipo(todos, tipo), [todos, tipo])
  const visibles = useMemo(() => filtrarPorPestania(delTipo, pestania), [delTipo, pestania])
  const contadores = carga.status === 'listo' ? contarPorPestania(delTipo) : null

  // ─── Handlers ───────────────────────────────────────────────────────
  const registrar = () => router.push('/panel/reclamos/nuevo')
  const limpiarFiltros = () => {
    setPestania('todos')
    setTipo(TODOS_LOS_TIPOS)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const botonRegistrar =
    rol === 'locatario' ? (
      <Button type="primary" icon={<PlusOutlined />} onClick={registrar} data-testid="reclamos-registrar-button">
        Registrar reclamo
      </Button>
    ) : undefined

  const subtitulo = carga.status === 'listo' && todos.length > 0 ? resumenEstados(todos) : undefined

  return (
    <div className={styles.page} data-testid="reclamos-page" data-rol={rol}>
      <PageHeader
        title={TEXTOS[rol].titulo}
        subtitle={subtitulo}
        breadcrumb={[{ label: 'Mi panel', href: '/panel' }, { label: TEXTOS[rol].miga }]}
        actions={botonRegistrar}
      />

      {carga.status === 'cargando' && <Cargando />}

      {carga.status === 'error' && (
        <Alert
          type="error"
          showIcon
          title="No pudimos cargar los reclamos"
          description={carga.message}
          action={
            <Button onClick={carga.reintentar} data-testid="reclamos-reintentar">
              Reintentar
            </Button>
          }
          data-testid="reclamos-error"
        />
      )}

      {carga.status === 'listo' && todos.length === 0 && (
        <div className={styles.vacio} data-testid="reclamos-vacio" data-rol={rol}>
          {rol === 'locador' ? (
            <EmptyState
              title="Todo en orden por acá"
              description="Ninguna de tus propiedades tiene reclamos. Cuando un locatario registre uno, te avisamos y aparece en esta lista."
              action={
                <Button type="primary" onClick={() => router.push('/panel/propiedades')} data-testid="reclamos-vacio-propiedades">
                  Ver mis propiedades
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No registraste ningún reclamo"
              description="Si algo de la propiedad que alquilás necesita atención, registrá un reclamo y le llega al locador."
              action={
                <Button type="primary" onClick={registrar} data-testid="reclamos-vacio-registrar">
                  Registrar reclamo
                </Button>
              }
            />
          )}
        </div>
      )}

      {carga.status === 'listo' && todos.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <PestaniasSolicitudes
              opciones={PESTANIAS_RECLAMOS}
              value={pestania}
              onChange={setPestania}
              contadores={contadores}
              testIdPrefix="reclamos"
              ariaLabel="Estado del reclamo"
            />
            <div className={styles.toolbarSelects}>
              <Select
                className={styles.select}
                value={tipo}
                onChange={setTipo}
                options={OPCIONES_TIPO}
                aria-label="Tipo de reclamo"
                data-testid="reclamos-filtro-tipo"
              />
              <Select className={styles.select} value="recientes" options={OPCIONES_ORDEN} aria-label="Orden" data-testid="reclamos-orden" />
            </div>
          </div>

          {visibles.length === 0 ? (
            <div className={styles.vacio} data-testid="reclamos-sin-resultados">
              <EmptyState
                title="No hay reclamos con estos filtros"
                description="Probá con otro estado o con todos los tipos."
                action={
                  <Button onClick={limpiarFiltros} data-testid="reclamos-limpiar-filtros">
                    Ver todos
                  </Button>
                }
              />
            </div>
          ) : rol === 'locador' ? (
            <div className={styles.lista}>
              {agruparPorPropiedad(visibles).map((grupo) => (
                <GrupoReclamos key={grupo.propiedad.id} grupo={grupo} />
              ))}
            </div>
          ) : (
            <div className={styles.grupo} data-testid="reclamos-lista-locatario">
              {visibles.map((reclamo) => (
                <FilaReclamo key={reclamo.id} reclamo={reclamo} vista="locatario" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
