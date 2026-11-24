'use client'

/**
 * FotosReclamoField.tsx — las fotos opcionales de un reclamo (US-14).
 *
 * Qué hace (Claude Design, "Reclamos" · 01): zona de arrastrar y soltar, una
 * grilla con las fotos cargadas (nombre, peso y "×" para quitarla) y la tarjeta
 * "Agregar · 2 de 10". Controla las reglas de US-14 al agregar: "hasta 10
 * imágenes en formato JPG/PNG que no excedan los 350kb cada una". Lo que no
 * cumple se rechaza uno por uno, con el motivo ("plano.pdf: solo se aceptan
 * imágenes JPG o PNG"), y el resto se adjunta.
 * NOTA: a diferencia del alta (US-01) no hay foto principal ni orden: las fotos
 * van en el orden en que se cargaron.
 * NOTA: las fotos se leen como data URL y viven en memoria hasta registrar el
 * reclamo; recién ahí se suben al bucket (`reclamos.service#registrarReclamo`).
 *
 * Quién lo usa: `NuevoReclamo`.
 */
import { useEffect, useRef, useState } from 'react'
import { Alert, Upload } from 'antd'
import { CloseOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons'
import Image from 'next/image'
import { FORMATOS_SELECTOR_FOTO, leerComoDataUrl, pesoEnKbTexto } from '@/lib/imagenes/archivosFoto'
import { motivoRechazoFotoReclamo, MOTIVO_FOTOS_DE_MAS, RECLAMO_FOTOS_MAX } from '@/lib/validation/reclamo.rules'
import styles from './NuevoReclamo.module.css'

/** Una foto cargada en el formulario. */
export interface FotoCargada {
  id: string
  /** Data URL. */
  src: string
  nombre: string
  pesoBytes: number
}

/** Props de {@link FotosReclamoField}. */
interface FotosReclamoFieldProps {
  value: FotoCargada[]
  onChange: (fotos: FotoCargada[]) => void
  disabled?: boolean
}

/** Carga de las fotos del reclamo. */
export function FotosReclamoField({ value, onChange, disabled = false }: FotosReclamoFieldProps) {
  const [rechazos, setRechazos] = useState<string[]>([])
  // La lectura de archivos es asíncrona: entre que se eligen y se leen, `value`
  // puede haber cambiado. El ref tiene siempre la última lista.
  const actuales = useRef(value)
  useEffect(() => {
    actuales.current = value
  }, [value])

  // ─── Handlers ───────────────────────────────────────────────────────

  /** Procesa una tanda de archivos elegidos juntos: rechaza uno por uno y adjunta el resto. */
  async function agregar(archivos: File[]): Promise<void> {
    const motivos: string[] = []
    const aceptados: File[] = []
    for (const archivo of archivos) {
      const motivo = motivoRechazoFotoReclamo(archivo)
      if (motivo) motivos.push(`${archivo.name}: ${motivo}.`)
      else aceptados.push(archivo)
    }
    const lugar = RECLAMO_FOTOS_MAX - actuales.current.length
    if (aceptados.length > lugar) {
      aceptados.splice(Math.max(0, lugar)).forEach((archivo) => motivos.push(`${archivo.name}: ${MOTIVO_FOTOS_DE_MAS}.`))
    }
    setRechazos(motivos)
    if (aceptados.length === 0) return

    const nuevas = await Promise.all(
      aceptados.map(async (archivo, index): Promise<FotoCargada> => ({
        id: `foto-${Date.now()}-${index}`,
        src: await leerComoDataUrl(archivo),
        nombre: archivo.name,
        pesoBytes: archivo.size,
      })),
    )
    onChange([...actuales.current, ...nuevas])
  }

  function quitar(id: string): void {
    onChange(value.filter((foto) => foto.id !== id))
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const lleno = value.length >= RECLAMO_FOTOS_MAX
  const propsCarga = {
    // NOTA: `filter: 'native'` deja el filtro de formatos solo en el selector de
    // archivos: lo que se arrastra llega siempre a `agregar()`, que dice por qué
    // no se adjunta (mismo arreglo que el alta, testing del Sprint 2).
    accept: { format: FORMATOS_SELECTOR_FOTO, filter: 'native' as const },
    multiple: true,
    showUploadList: false,
    disabled: disabled || lleno,
    // Nada se sube acá: se procesa la tanda entera una sola vez (con el primer archivo).
    beforeUpload: (file: File, fileList: File[]) => {
      if (file === fileList[0]) void agregar(fileList)
      return false
    },
  }

  return (
    <div className={styles.fotos}>
      <Upload.Dragger {...propsCarga} className={styles.dropzone} data-testid="reclamo-nuevo-fotos-dropzone">
        <span className={styles.dropzoneInner}>
          <InboxOutlined className={styles.dropzoneIcon} />
          <span className={styles.dropzoneTitulo}>Arrastrá archivos acá o hacé clic para elegirlos</span>
        </span>
      </Upload.Dragger>
      <span className={styles.ayuda}>Hasta {RECLAMO_FOTOS_MAX} imágenes JPG o PNG, de 350 KB como máximo cada una.</span>

      {value.length > 0 && (
        <ul className={styles.grillaFotos} data-testid="reclamo-nuevo-fotos">
          {value.map((foto) => (
            <li key={foto.id} className={styles.foto} data-testid="reclamo-nuevo-foto">
              <Image src={foto.src} alt={foto.nombre} width={136} height={90} unoptimized className={styles.fotoImagen} />
              <span className={styles.fotoPie}>
                <span className={styles.fotoNombre}>
                  {foto.nombre} · {pesoEnKbTexto(foto.pesoBytes)}
                </span>
                <button type="button" className={styles.fotoQuitar} onClick={() => quitar(foto.id)} aria-label={`Quitar ${foto.nombre}`} disabled={disabled} data-testid="reclamo-nuevo-foto-quitar">
                  <CloseOutlined />
                </button>
              </span>
            </li>
          ))}
          {!lleno && (
            <li className={styles.fotoAgregar}>
              <Upload {...propsCarga} className={styles.fotoAgregarUpload}>
                <span className={styles.fotoAgregarBoton} data-testid="reclamo-nuevo-foto-agregar">
                  <PlusOutlined />
                  <span>
                    Agregar · {value.length} de {RECLAMO_FOTOS_MAX}
                  </span>
                </span>
              </Upload>
            </li>
          )}
        </ul>
      )}

      {rechazos.length > 0 && (
        <Alert
          type="error"
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setRechazos([])}
          title={rechazos.length === 1 ? 'No se adjuntó 1 archivo' : `No se adjuntaron ${rechazos.length} archivos`}
          description={rechazos.join(' · ')}
          data-testid="reclamo-nuevo-fotos-rechazos"
        />
      )}
    </div>
  )
}
