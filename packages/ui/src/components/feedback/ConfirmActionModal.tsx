'use client'

/**
 * ConfirmActionModal.tsx — modal de confirmación para acciones que no se pueden deshacer.
 *
 * Quién lo usa: el catálogo `/design-system` y las pantallas de solicitudes (aceptar, rechazar y
 * cancelar, US-37 y US-38); lo usará el detalle, por ejemplo para eliminar (US-04).
 */
import { ExclamationCircleFilled } from '@ant-design/icons'
import { Modal } from 'antd'
import type { ReactNode } from 'react'

/** Props de {@link ConfirmActionModal}. */
interface ConfirmActionModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Si es `true`, el botón de confirmar se pinta en rojo (eliminar, dar de baja). */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  /**
   * Cuerpo extra debajo de `description` (ej. "Las otras 2 solicitudes siguen pendientes", o el
   * error de la acción con su `Alert`). Opcional: sin `children` el modal es el de siempre.
   */
  children?: ReactNode
  /**
   * `true` mientras la acción confirmada está en curso: el botón de confirmar muestra el spinner.
   * El modal no se cierra solo: lo cierra quien lo usa cuando la acción termina.
   */
  confirmLoading?: boolean
  /**
   * Si es `true`, no se muestra el botón secundario: queda solo el de
   * confirmar. Para los avisos que no tienen nada que elegir (ej. "No podés
   * eliminar una propiedad con contrato vigente" · "Entendido"). La cruz y
   * Escape siguen llamando a `onCancel`.
   */
  hideCancel?: boolean
  'data-testid'?: string
}

/**
 * Confirmación de una acción destructiva o irreversible (eliminar una
 * propiedad, cerrar un reclamo, dar de baja la suscripción). Nunca ejecuta
 * la acción por su cuenta — solo confirma, `onConfirm` decide qué pasa.
 */
export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
  children,
  confirmLoading = false,
  hideCancel = false,
  ...rest
}: ConfirmActionModalProps) {
  return (
    <Modal
      open={open}
      title={
        <span>
          <ExclamationCircleFilled style={{ color: danger ? 'var(--rentar-color-error)' : 'var(--rentar-color-warning)', marginRight: 8 }} />
          {title}
        </span>
      }
      onOk={onConfirm}
      onCancel={onCancel}
      okText={confirmLabel}
      cancelText={cancelLabel}
      confirmLoading={confirmLoading}
      okButtonProps={{ danger, 'data-testid': 'confirm-action-ok' }}
      cancelButtonProps={{ 'data-testid': 'confirm-action-cancel' }}
      // Sin botón secundario: el pie queda solo con el de confirmar.
      footer={hideCancel ? (_, { OkBtn }) => <OkBtn /> : undefined}
      {...rest}
    >
      {description && <p>{description}</p>}
      {children}
    </Modal>
  )
}
