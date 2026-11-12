'use client'

/**
 * useFormularioValido.ts — si todas las reglas de un formulario de antd pasan.
 *
 * Qué es: un hook que, cada vez que cambia algún valor, corre las reglas de
 * todos los campos con `validateFields({ validateOnly: true })` y devuelve si
 * pasaron. Lo usan los bloques de "Mi perfil" para deshabilitar Guardar.
 * Cubre: US-21 Modificar usuario (pedido del PO del 12/11: Guardar
 * deshabilitado si algún campo del bloque tiene un error).
 * Quién lo usa: `components/perfil/DatosPersonalesBloque.tsx` y
 * `components/perfil/AccesoSeguridadBloque.tsx`.
 *
 * NOTA (por qué `validateOnly` y no `getFieldsError`): `getFieldsError` solo
 * ve los errores que ya se pintaron (los de los campos tocados) y se lee en
 * el render, antes de que termine la validación async: el botón quedaría un
 * paso atrasado. `validateOnly` corre todas las reglas, también las de los
 * campos que el usuario no tocó y las que dependen de otro campo, sin
 * pintar errores; los mensajes en el campo siguen saliendo por `onChange`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Form, type FormInstance } from 'antd'

/** Lo que devuelve {@link useFormularioValido}. */
interface FormularioValido {
  /** Todas las reglas pasan. Arranca en `false` hasta la primera validación. */
  valido: boolean
  /**
   * Vuelve a validar sin que haya cambiado un valor: por ejemplo, después de
   * que el back rechazó un valor y se sumó a una regla.
   */
  revalidar: () => void
}

/** Valida en silencio el formulario `form` en cada cambio y dice si pasa. */
export function useFormularioValido<Valores>(form: FormInstance<Valores>): FormularioValido {
  const valores: unknown = Form.useWatch([], form)
  const [vuelta, setVuelta] = useState(0)
  const [valido, setValido] = useState(false)

  useEffect(() => {
    // Si el usuario escribe rápido, una validación vieja puede terminar
    // después de una nueva: solo cuenta la del último cambio.
    let vigente = true
    form.validateFields({ validateOnly: true }).then(
      () => vigente && setValido(true),
      () => vigente && setValido(false),
    )
    return () => {
      vigente = false
    }
  }, [form, valores, vuelta])

  const revalidar = useCallback(() => setVuelta((actual) => actual + 1), [])
  return { valido, revalidar }
}
