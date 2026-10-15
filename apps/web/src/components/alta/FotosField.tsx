'use client'

/**
 * FotosField.tsx — la carga de fotos del alta (US-01, Alta · 03).
 *
 * Qué hace: zona de arrastrar-y-soltar + grilla de fotos cargadas. Cada foto
 * se puede mover con ← →, marcar como principal o quitar. Controla las
 * reglas de US-01 al agregar: solo JPG o PNG, hasta 350 KB cada una y hasta
 * 50 en total (lo que no cumple se rechaza y se dice por qué, también al
 * arrastrarlo). El mínimo de
 * 3 lo valida el paso, al tocar "Siguiente".
 *
 * Foto principal (US-01: "la primer foto cargada", "se puede cambiar"): se
 * guarda por id en el campo `mainPhotoId` del formulario, así acompaña a la
 * foto cuando se reordena. Quitar la principal pasa la portada a la que
 * queda en su lugar.
 *
 * NOTA: las fotos se leen como data URL y viven en el navegador (modo mock).
 * TODO(backend): con el back real se suben a un storage y viaja la URL.
 * Quién lo usa: `PasosAlta.tsx`, dentro de un `Form.Item name="photos"`.
 */
import { useState } from 'react'
import { Alert, Button, Form, Upload } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, CameraOutlined } from '@ant-design/icons'
import Image from 'next/image'
import type { FotoNueva } from '@rentar/shared-types'
import { FOTO_PESO_MAXIMO_BYTES, FOTO_TIPOS_ACEPTADOS, FOTOS_MAXIMO, FOTOS_MINIMO, type AltaValues } from '@/lib/validation/propiedad.rules'
import styles from './Alta.module.css'

/** Lee un archivo como data URL. */
function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** "512 KB". */
function pesoTexto(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`
}

/** Formatos que ofrece el selector de archivos del sistema (`<input accept>`). */
const FORMATOS_SELECTOR = '.jpg,.jpeg,.png,image/jpeg,image/png'

/**
 * Por qué se rechaza un archivo, o `null` si cumple US-01. El tipo se mira por
 * MIME y por extensión, y tienen que cumplir los dos.
 */
function motivoRechazo(file: File): string | null {
  const extensionOk = /\.(jpe?g|png)$/i.test(file.name)
  if (!FOTO_TIPOS_ACEPTADOS.includes(file.type) || !extensionOk) return 'solo JPG o PNG'
  if (file.size > FOTO_PESO_MAXIMO_BYTES) return `pesa ${pesoTexto(file.size)} y el máximo es ${pesoTexto(FOTO_PESO_MAXIMO_BYTES)}`
  return null
}

interface FotosFieldProps {
  value?: FotoNueva[]
  onChange?: (value: FotoNueva[]) => void
}

/** Carga, orden y foto principal de las fotos del alta. */
export function FotosField({ value = [], onChange }: FotosFieldProps) {
  const form = Form.useFormInstance<AltaValues>()
  const mainPhotoId = Form.useWatch('mainPhotoId', form) ?? null
  const [rechazos, setRechazos] = useState<string[]>([])

  // ─── Handlers ───────────────────────────────────────────────────────

  /** Las fotos actuales, leídas del formulario (la lectura de archivos es asíncrona: `value` puede estar viejo). */
  function fotosActuales(): FotoNueva[] {
    return (form.getFieldValue('photos') as FotoNueva[] | undefined) ?? []
  }

  function cambiar(fotos: FotoNueva[], principal: string | null): void {
    onChange?.(fotos)
    // Sin principal elegida, la principal es la primera (US-01).
    const principalValida = principal && fotos.some((foto) => foto.id === principal) ? principal : (fotos[0]?.id ?? null)
    form.setFieldValue('mainPhotoId', principalValida)
  }

  /** Procesa una tanda de archivos elegidos juntos. */
  async function agregar(archivos: File[]): Promise<void> {
    const motivos: string[] = []
    const aceptados: File[] = []
    for (const archivo of archivos) {
      const motivo = motivoRechazo(archivo)
      if (motivo) motivos.push(`${archivo.name}: ${motivo}.`)
      else aceptados.push(archivo)
    }
    const lugar = FOTOS_MAXIMO - fotosActuales().length
    if (aceptados.length > lugar) {
      aceptados.splice(lugar).forEach((archivo) => motivos.push(`${archivo.name}: ya hay ${FOTOS_MAXIMO} fotos, que es el máximo.`))
    }
    setRechazos(motivos)
    if (aceptados.length === 0) return

    const nuevas = await Promise.all(
      aceptados.map(async (archivo, index): Promise<FotoNueva> => ({
        id: `foto-${Date.now()}-${index}`,
        src: await leerComoDataUrl(archivo),
        name: archivo.name,
      })),
    )
    cambiar([...fotosActuales(), ...nuevas], form.getFieldValue('mainPhotoId') as string | null)
  }

  function mover(index: number, paso: -1 | 1): void {
    const destino = index + paso
    if (destino < 0 || destino >= value.length) return
    const fotos = [...value]
    ;[fotos[index], fotos[destino]] = [fotos[destino], fotos[index]]
    cambiar(fotos, mainPhotoId)
  }

  function quitar(index: number): void {
    const fotos = value.filter((_, i) => i !== index)
    const eraPrincipal = value[index]?.id === mainPhotoId
    // Si se quita la principal, la portada pasa a la que queda en su lugar.
    const principal = eraPrincipal ? (fotos[Math.min(index, fotos.length - 1)]?.id ?? null) : mainPhotoId
    cambiar(fotos, principal)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const faltan = Math.max(0, FOTOS_MINIMO - value.length)

  return (
    <div className={styles.photos}>
      <Upload.Dragger
        // NOTA: `filter: 'native'` hace que el filtro de formatos quede solo en
        // el selector de archivos. Con `accept` como texto, antd (rc-upload)
        // descarta en silencio lo que se arrastra y no coincide, antes de
        // `beforeUpload`: el usuario soltaba un .webp y no pasaba nada (testing
        // del Sprint 2, Prueba 13). Así todo llega a `agregar()` y
        // `motivoRechazo` dice por qué no se agrega.
        accept={{ format: FORMATOS_SELECTOR, filter: 'native' }}
        multiple
        showUploadList={false}
        // Nada se sube: se lee el archivo en el navegador. Se procesa la tanda
        // entera una sola vez (con el primer archivo) para no pisar la lista.
        beforeUpload={(file, fileList) => {
          if (file === fileList[0]) void agregar(fileList)
          return false
        }}
        className={styles.dropzone}
        data-testid="alta-fotos-dropzone"
      >
        <span className={styles.dropzoneInner}>
          <CameraOutlined className={styles.dropzoneIcon} />
          <span className={styles.dropzoneTitle}>Arrastrá las fotos acá o tocá para elegirlas</span>
          <span className={styles.dropzoneHint}>
            JPG o PNG, de hasta 350 KB cada una, entre {FOTOS_MINIMO} y {FOTOS_MAXIMO} fotos. Sacalas de día y con las luces prendidas.
          </span>
        </span>
      </Upload.Dragger>

      {rechazos.length > 0 && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setRechazos([])}
          title={rechazos.length === 1 ? 'No agregamos una foto' : `No agregamos ${rechazos.length} fotos`}
          description={
            <ul className={styles.rejectList}>
              {rechazos.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          }
          data-testid="alta-fotos-rechazos"
        />
      )}

      <div className={styles.photosHeader}>
        <span className={styles.photosCount} data-testid="alta-fotos-cantidad">
          {value.length === 1 ? '1 foto cargada' : `${value.length} fotos cargadas`}
          {faltan > 0 && value.length > 0 && <span className={styles.photosMissing}> · te faltan {faltan}</span>}
        </span>
        <span className={styles.photosHelp}>La portada es la que se ve en toda la app. Cambiá el orden con las flechas.</span>
      </div>

      {value.length > 0 && (
        <ol className={styles.photoGrid}>
          {value.map((foto, index) => {
            const principal = foto.id === mainPhotoId
            return (
              <li key={foto.id} className={`${styles.photoCard} ${principal ? styles.photoCardMain : ''}`} data-testid="alta-foto">
                <Image src={foto.src} alt={foto.name} width={240} height={160} unoptimized className={styles.photoImage} />
                <div className={styles.photoBar}>
                  {principal ? (
                    <span className={styles.coverBadge} data-testid="alta-foto-portada">
                      Portada
                    </span>
                  ) : (
                    <Button size="small" className={styles.coverButton} onClick={() => cambiar(value, foto.id)} data-testid="alta-foto-principal">
                      Marcar como principal
                    </Button>
                  )}
                  <span className={styles.photoTools}>
                    <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => mover(index, -1)} disabled={index === 0} aria-label={`Mover ${foto.name} antes`} />
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowRightOutlined />}
                      onClick={() => mover(index, 1)}
                      disabled={index === value.length - 1}
                      aria-label={`Mover ${foto.name} después`}
                    />
                    <Button size="small" type="text" danger onClick={() => quitar(index)} data-testid="alta-foto-quitar">
                      Quitar
                    </Button>
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
