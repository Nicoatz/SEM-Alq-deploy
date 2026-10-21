'use client'

/**
 * useCantidadAlquileres.ts — cuántos contratos tiene el locatario, para el menú.
 *
 * Qué es: US-27 Consultar mis alquileres: "si tiene dos o más, el ítem del
 * menú pasa a llamarse 'Mis alquileres'". Lo pide una vez por usuario y solo
 * con el rol locatario activo.
 * NOTA (sin parpadeo): mientras no se sabe, el menú dice "Mi alquiler" y
 * apunta a `/panel/alquiler`; si al final son dos o más, el ítem cambia a
 * "Mis alquileres" (`/panel/alquileres`). Si alguien toca el ítem antes de
 * saberlo, `/panel/alquiler` redirige solo al listado. Un error deja el
 * ítem como "Mi alquiler" (la pantalla muestra su propio error).
 *
 * De dónde saca los datos: `contratos.service#contarMisAlquileres`.
 * Quién lo usa: `app/(app)/panel/layout.tsx`.
 */
import { useEffect, useState } from 'react'
import { contarMisAlquileres } from '@/services/contratos.service'

/**
 * @param userId Usuario en sesión (`null` sin sesión).
 * @param activo `true` con el rol locatario activo.
 * @returns la cantidad, o `null` mientras no se sabe.
 */
export function useCantidadAlquileres(userId: string | null, activo: boolean): number | null {
  const [resultado, setResultado] = useState<{ userId: string; cantidad: number } | null>(null)

  useEffect(() => {
    if (!userId || !activo) return
    let cancelado = false
    contarMisAlquileres()
      .then((cantidad) => {
        if (!cancelado) setResultado({ userId, cantidad })
      })
      .catch(() => {
        // Sin el dato, el menú queda como "Mi alquiler".
      })
    return () => {
      cancelado = true
    }
  }, [userId, activo])

  return resultado && resultado.userId === userId ? resultado.cantidad : null
}
