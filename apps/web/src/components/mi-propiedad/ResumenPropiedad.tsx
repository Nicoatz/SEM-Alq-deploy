'use client'

/**
 * ResumenPropiedad.tsx — el Resumen del detalle de una propiedad del
 * locador: la ficha, las condiciones, las fotos y, al costado, lo que sigue,
 * los accesos rápidos y la Zona sensible.
 *
 * Qué muestra (Claude Design, "Detalle de propiedad del locador" · 01). Cubre
 * la ficha de US-03 y US-04 (numeración de Jira).
 * NOTA: es lo único del diseño que va en esta tanda (decisión del PO): las
 * pestañas Contrato vigente, Cobros, Reclamos e Historial no se muestran,
 * porque dependen de módulos de otros sprints y con el back real quedarían
 * vacías. Tampoco van "Pausar" (no tiene US ni endpoint), "Ver contrato
 * vigente", "Emitir cobro manual" ni "Escribirle a <locatario>", y "Lo que
 * sigue" no incluye el próximo cobro.
 *
 * Quién lo usa: `MiPropiedad`.
 */
import Image from 'next/image'
import Link from 'next/link'
import { Button } from 'antd'
import { DeleteOutlined, RightOutlined } from '@ant-design/icons'
import type { PropiedadLocadorDetalle } from '@rentar/shared-types'
import { DetailList } from '@rentar/ui'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { puedeEliminar } from '@/lib/validation/propiedad.rules'
import { fecha, filasCondiciones, filasPropiedad } from './textosPropiedad'
import styles from './MiPropiedad.module.css'

/** Cuántas miniaturas se ven antes del "+N". */
const MINIATURAS = 4

/** Props de {@link ResumenPropiedad}. */
interface ResumenPropiedadProps {
  detalle: PropiedadLocadorDetalle
  /** Link a la publicación pública, o `null` si no se ve en la búsqueda. */
  hrefPublica: string | null
  hrefEditar: string
  onEliminar: () => void
}

/** Una miniatura con respaldo si la foto no carga. */
function Miniatura({ src, principal }: { src: string; principal: boolean }) {
  const foto = useFotoConRespaldo(src)
  return (
    // Las fotos del alta son data URLs guardadas en el navegador: no pasan por el optimizador.
    <Image src={foto.src} onError={foto.onError} alt="" width={120} height={76} unoptimized className={`${styles.thumb} ${principal ? styles.thumbMain : ''}`} />
  )
}

/** El Resumen de la propiedad. */
export function ResumenPropiedad({ detalle, hrefPublica, hrefEditar, onEliminar }: ResumenPropiedadProps) {
  const { values, activeContract } = detalle
  const fotos = values.photos
  const ocultas = fotos.length - MINIATURAS
  const eliminable = puedeEliminar(detalle)

  return (
    <div className={styles.resumen}>
      <div className={styles.resumenMain}>
        <section className={styles.card} data-testid="mi-propiedad-ficha">
          <DetailList title="La propiedad" items={filasPropiedad(values)} column={2} />
          {values.description && <p className={styles.descripcion}>{values.description}</p>}
        </section>

        <section className={styles.card} data-testid="mi-propiedad-condiciones">
          <DetailList title="Condiciones de alquiler" items={filasCondiciones(values)} column={2} />
          {/* · 06: con contrato vigente, el precio y el ajuste los fija el contrato. */}
          {activeContract && <p className={styles.nota}>Con el contrato {activeContract.id} vigente, el precio y el ajuste los fija el contrato.</p>}
        </section>

        <section className={styles.card} data-testid="mi-propiedad-fotos">
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Fotos · {fotos.length}</h3>
            <Link href={`${hrefEditar}#fotos`} className={styles.link} data-testid="mi-propiedad-editar-fotos">
              Editar fotos
            </Link>
          </div>
          <div className={styles.thumbs}>
            {fotos.slice(0, MINIATURAS).map((foto, index) => (
              <Miniatura key={foto.id} src={foto.src} principal={index === values.mainPhotoIndex} />
            ))}
            {ocultas > 0 && <span className={styles.thumbMore}>+{ocultas}</span>}
          </div>
        </section>
      </div>

      <aside className={styles.resumenSide}>
        {/* Lo que sigue (· 01): solo lo que sale del contrato; el próximo cobro es del módulo de cobros. */}
        {activeContract && (activeContract.nextAdjustmentDate || activeContract.endDate) && (
          <section className={styles.siguiente} data-testid="mi-propiedad-lo-que-sigue">
            <h3 className={styles.cardTitle}>Lo que sigue en esta propiedad</h3>
            <ul className={styles.eventos}>
              {activeContract.nextAdjustmentDate && (
                <li>
                  <strong>{fecha(activeContract.nextAdjustmentDate)}</strong> — ajuste{values.adjustmentIndex ? ` por ${values.adjustmentIndex}` : ''}.
                </li>
              )}
              {activeContract.endDate && (
                <li>
                  <strong>{fecha(activeContract.endDate)}</strong> — vence el contrato.
                </li>
              )}
            </ul>
          </section>
        )}

        {hrefPublica && (
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Accesos rápidos</h3>
            <Link href={hrefPublica} className={styles.acceso} data-testid="mi-propiedad-ver-publica-acceso">
              Ver la publicación pública
              <RightOutlined aria-hidden="true" />
            </Link>
          </section>
        )}

        <section className={styles.card} data-testid="mi-propiedad-zona-sensible">
          <h3 className={styles.cardTitle}>Zona sensible</h3>
          <p className={styles.nota}>
            Eliminar la saca de Mis propiedades y de la búsqueda. Los contratos y reclamos anteriores se conservan.
          </p>
          {/* NOTA: con contrato vigente no se deshabilita: abre el aviso que explica por qué (decisión del PO, ver NOTES.md). */}
          <Button danger icon={<DeleteOutlined />} onClick={onEliminar} className={styles.pill} data-testid="mi-propiedad-eliminar-button">
            Eliminar propiedad
          </Button>
          {!eliminable && <span className={styles.motivo}>Tiene contrato vigente: por ahora no se puede eliminar.</span>}
        </section>
      </aside>
    </div>
  )
}
