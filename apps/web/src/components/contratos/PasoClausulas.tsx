'use client'

/**
 * PasoClausulas.tsx — paso 3 del alta de contrato: "Cláusulas".
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 3 · Cláusulas":
 * - el contrato sale de la plantilla de locación de vivienda de RentAR,
 *   completada con los pasos 1 y 2 (`lib/contratos/plantilla.ts`);
 * - las fijas no se editan y se muestran bloqueadas;
 * - las editables se modifican, hasta 1.000 caracteres;
 * - se agregan cláusulas propias (hasta 1.000 caracteres) y se eliminan;
 * - se indica el total de cláusulas y cuántas se editaron;
 * - "Ver contrato completo".
 * Decisión del PO: solo la plantilla, sin "Subir mi PDF".
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 04): la lista de
 * cláusulas con su número, el candado en las fijas, "Editar" en las demás y
 * el contador "14 cláusulas · 2 editadas".
 * NOTA: el texto se edita directo sobre el borrador (no hay "Guardar
 * cláusula"): lo escrito no se pierde al cambiar de paso. "Volver al texto
 * de la plantilla" deshace una edición.
 *
 * Quién lo usa: `AltaContrato.tsx`.
 */
import { useState } from 'react'
import { Button, Input, Modal, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, FileTextOutlined, LockOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import type { ClausulaContrato, ContratoBorrador } from '@rentar/shared-types'
import { contarClausulas, ordinal, PLANTILLA_NOMBRE, textoOriginal, tituloContrato } from '@/lib/contratos/plantilla'
import { CLAUSULA_MAX, errorDeClausula } from '@/lib/contratos/validaciones'
import styles from './AltaContrato.module.css'

/** Props de {@link PasoClausulas}. */
interface PasoClausulasProps {
  borrador: ContratoBorrador
  onClausulasChange: (clausulas: ClausulaContrato[]) => void
  /** `true` después de tocar "Siguiente" o "Enviar": se muestran todos los errores. */
  mostrarErrores: boolean
}

/** Etiqueta del tipo de cláusula. */
const ETIQUETA_TIPO: Record<ClausulaContrato['tipo'], string> = {
  fija: 'Fija',
  editable: 'Editable',
  propia: 'Agregada por vos',
}

/** Clave nueva para una cláusula propia. */
function claveNueva(clausulas: readonly ClausulaContrato[]): string {
  const usadas = new Set(clausulas.map((clausula) => clausula.key))
  let numero = 1
  while (usadas.has(`propia-${numero}`)) numero++
  return `propia-${numero}`
}

/** El contrato entero, para "Ver contrato completo" (US-05). */
export function ContratoCompleto({ borrador }: { borrador: ContratoBorrador }) {
  return (
    <div className={styles.documento} data-testid="contrato-documento">
      <h2 className={styles.documentoTitulo}>{tituloContrato(borrador)}</h2>
      {borrador.clausulas.map((clausula, indice) => (
        <p key={clausula.key} className={styles.documentoClausula}>
          <strong>
            {ordinal(indice + 1)}. {clausula.titulo || 'Sin título'}.
          </strong>{' '}
          {clausula.texto || '[sin texto]'}
        </p>
      ))}
    </div>
  )
}

/** Paso 3 del alta: las cláusulas de la plantilla y las propias. */
export function PasoClausulas({ borrador, onClausulasChange, mostrarErrores }: PasoClausulasProps) {
  const { clausulas } = borrador
  const conteo = contarClausulas(clausulas)

  // ─── Estado local ───────────────────────────────────────────────────
  /** Cláusulas abiertas para editar. */
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(() => new Set())
  const [verCompleto, setVerCompleto] = useState(false)

  // ─── Handlers ───────────────────────────────────────────────────────
  function abrir(key: string, abierta: boolean): void {
    setAbiertas((actual) => {
      const siguiente = new Set(actual)
      if (abierta) siguiente.add(key)
      else siguiente.delete(key)
      return siguiente
    })
  }

  /** Cambia el texto (o el título, en las propias). Una editable queda "editada" si se aparta de la plantilla. */
  function cambiar(key: string, cambios: Partial<Pick<ClausulaContrato, 'titulo' | 'texto'>>): void {
    onClausulasChange(
      clausulas.map((clausula) => {
        if (clausula.key !== key) return clausula
        const nueva = { ...clausula, ...cambios }
        if (nueva.tipo !== 'editable') return nueva
        return { ...nueva, editada: nueva.texto !== textoOriginal(nueva.key, borrador) }
      }),
    )
  }

  /** "Volver al texto de la plantilla". */
  function restaurar(key: string): void {
    const original = textoOriginal(key, borrador)
    if (original === null) return
    onClausulasChange(clausulas.map((clausula) => (clausula.key === key ? { ...clausula, texto: original, editada: false } : clausula)))
  }

  function agregar(): void {
    const key = claveNueva(clausulas)
    onClausulasChange([...clausulas, { key, tipo: 'propia', titulo: '', texto: '', editada: false }])
    abrir(key, true)
  }

  function eliminar(key: string): void {
    onClausulasChange(clausulas.filter((clausula) => clausula.key !== key))
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.paso} data-testid="contrato-paso-clausulas">
      <div className={styles.clausulasHead}>
        <span className={styles.clausulasResumen}>
          <Tag icon={<FileTextOutlined />} className={styles.plantillaTag}>
            {PLANTILLA_NOMBRE}
          </Tag>
          {/* US-05: "la cantidad total de cláusulas y cuántas fueron editadas". */}
          <span data-testid="contrato-clausulas-contador">
            <strong>{conteo.total} cláusulas</strong> · {conteo.editadas} {conteo.editadas === 1 ? 'editada' : 'editadas'}
            {conteo.propias > 0 ? ` · ${conteo.propias} ${conteo.propias === 1 ? 'agregada por vos' : 'agregadas por vos'}` : ''}
          </span>
        </span>
        <Button icon={<FileTextOutlined />} onClick={() => setVerCompleto(true)} data-testid="contrato-ver-completo">
          Ver contrato completo
        </Button>
      </div>

      <ol className={styles.clausulas}>
        {clausulas.map((clausula, indice) => {
          const abierta = clausula.tipo !== 'fija' && abiertas.has(clausula.key)
          const error = mostrarErrores || abierta ? errorDeClausula(clausula) : null
          return (
            <li
              key={clausula.key}
              className={`${styles.clausula} ${clausula.editada || clausula.tipo === 'propia' ? styles.clausulaMarcada : ''}`}
              data-testid="contrato-clausula"
              data-tipo={clausula.tipo}
            >
              <div className={styles.clausulaHead}>
                <span className={styles.clausulaTitulo}>
                  {indice + 1} · {clausula.titulo || 'Cláusula sin título'}
                </span>
                <span className={styles.acciones}>
                  {clausula.tipo === 'fija' ? (
                    <Tag icon={<LockOutlined />} data-testid="contrato-clausula-bloqueada">
                      Fija: no se edita
                    </Tag>
                  ) : (
                    <>
                      <Tag>{clausula.editada ? 'Editada' : ETIQUETA_TIPO[clausula.tipo]}</Tag>
                      <Button size="small" icon={<EditOutlined />} onClick={() => abrir(clausula.key, !abierta)} data-testid="contrato-clausula-editar">
                        {abierta ? 'Listo' : 'Editar'}
                      </Button>
                    </>
                  )}
                  {clausula.tipo === 'propia' && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminar(clausula.key)} data-testid="contrato-clausula-eliminar">
                      Eliminar
                    </Button>
                  )}
                </span>
              </div>

              {abierta ? (
                <div className={styles.clausulaEditor}>
                  {clausula.tipo === 'propia' && (
                    <Input
                      value={clausula.titulo}
                      onChange={(evento) => cambiar(clausula.key, { titulo: evento.target.value })}
                      placeholder="Título de la cláusula"
                      maxLength={80}
                      aria-label="Título de la cláusula"
                      data-testid="contrato-clausula-titulo"
                    />
                  )}
                  {/* El contador marca en rojo al pasar de 1.000, sin cortar lo escrito: el error lo explica. */}
                  <Input.TextArea
                    value={clausula.texto}
                    onChange={(evento) => cambiar(clausula.key, { texto: evento.target.value })}
                    autoSize={{ minRows: 3, maxRows: 10 }}
                    count={{ show: true, max: CLAUSULA_MAX }}
                    status={error ? 'error' : undefined}
                    aria-label={`Texto de la cláusula ${indice + 1}`}
                    data-testid="contrato-clausula-texto"
                  />
                  {clausula.tipo === 'editable' && clausula.editada && (
                    <Button size="small" type="link" icon={<UndoOutlined />} onClick={() => restaurar(clausula.key)} data-testid="contrato-clausula-restaurar">
                      Volver al texto de la plantilla
                    </Button>
                  )}
                </div>
              ) : (
                <p className={styles.clausulaTexto}>{clausula.texto || 'Sin texto todavía.'}</p>
              )}

              {error && (
                <p className={styles.clausulaError} role="alert" data-testid="contrato-clausula-error">
                  {error}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <Button icon={<PlusOutlined />} onClick={agregar} className={styles.agregar} data-testid="contrato-clausula-agregar">
        Agregar una cláusula propia
      </Button>

      <Modal
        open={verCompleto}
        title="Contrato completo"
        onCancel={() => setVerCompleto(false)}
        footer={
          <Button type="primary" onClick={() => setVerCompleto(false)} data-testid="contrato-ver-completo-cerrar">
            Cerrar
          </Button>
        }
        width={760}
        data-testid="contrato-ver-completo-modal"
      >
        <ContratoCompleto borrador={borrador} />
      </Modal>
    </div>
  )
}
