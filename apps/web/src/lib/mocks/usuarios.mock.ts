/**
 * usuarios.mock.ts — las personas del elenco único de RentAR.
 *
 * Qué es: las cuentas que usan las pantallas del Sprint 1 en modo mock.
 * Fuente de verdad: `docs/MapaDePantallas.pdf`, sección "El elenco y las
 * propiedades". La cuenta admin del mapa (Equipo RentAR) no está: el panel
 * de administración no es de este sprint.
 *
 * Quién lo usa: la rama mock de `services/auth.service.ts` y
 * `services/usuarios.service.ts`. Ninguna pantalla lo importa directo.
 *
 * TODO(db): son filas de `usuario` + `usuario_x_rol` en Supabase (US-19, US-39).
 */
import type { UsuarioSesion } from '@rentar/shared-types'

/**
 * Contraseña de todas las cuentas del elenco en modo mock. Cumple la regla
 * de US-19 (8+ caracteres, mayúscula, minúscula, alfanumérica), así las
 * pruebas de US-39 ("contraseña incorrecta → falla") se pueden hacer con
 * cualquier otra.
 *
 * NOTA: solo existe en modo mock. El back real guarda un hash, nunca la
 * contraseña (ver `docs/HANDOFF-BACKEND.md`).
 */
export const MOCK_PASSWORD = 'Rentar2026'

/**
 * Una cuenta mock: el tipo de vista más la contraseña para poder simular el
 * login. `password` nunca sale de la rama mock de los services.
 */
export type UsuarioMock = UsuarioSesion & { password: string }

/** Las cinco cuentas del elenco (ver `README.md`). */
export const usuarios: UsuarioMock[] = [
  {
    id: 'usr-nicolas',
    nombre: 'Nicolás',
    apellido: 'Arrieta',
    email: 'nicolas.arrieta@rentar.test',
    password: MOCK_PASSWORD,
    // Único rol: locador. Dueño de 7 propiedades, 4 alquiladas (ver
    // propiedades.mock.ts).
    roles: ['locador'],
    status: 'activo',
    telefono: '+54 351 555-0101',
    dni: '30123456',
    fechaNacimiento: '1985-06-14',
  },
  {
    id: 'usr-sofia',
    nombre: 'Sofía',
    apellido: 'Ledesma',
    email: 'sofia.ledesma@rentar.test',
    password: MOCK_PASSWORD,
    // Única cuenta con dos roles: locataria de Obispo Trejo 1250 7° B
    // (contrato CT-2026-0148, de Nicolás) y locadora de Mariano Moreno 285.
    // Es la que ejercita el cambio de contexto del UserMenu.
    roles: ['locador', 'locatario'],
    status: 'activo',
    telefono: '+54 351 555-0102',
    dni: '35123456',
    fechaNacimiento: '1991-02-03',
  },
  {
    id: 'usr-julieta',
    nombre: 'Julieta',
    apellido: 'Peralta',
    email: 'julieta.peralta@rentar.test',
    password: MOCK_PASSWORD,
    // La que busca (flujo público): encuentra Rondeau 480 y la solicita.
    roles: ['locatario'],
    status: 'activo',
    telefono: '+54 351 555-0103',
    dni: '40123456',
    fechaNacimiento: '1998-11-21',
  },
  // NOTA: Matías y Diego no están en el mapa. Se sumaron en la tanda 2 del
  // Sprint 2, con el OK del PO, como postulantes de Rondeau 480 y Fructuoso
  // Rivera 785 (nombres del diseño "Flujo de solicitudes · 02"). No son
  // inquilinos de ninguna propiedad. Ver `README.md`, "Las solicitudes".
  {
    id: 'usr-matias',
    nombre: 'Matías',
    apellido: 'Quiroga',
    email: 'matias.quiroga@rentar.test',
    password: MOCK_PASSWORD,
    roles: ['locatario'],
    status: 'activo',
    telefono: '+54 351 555-0104',
    dni: '39123456',
    fechaNacimiento: '1996-04-08',
  },
  {
    id: 'usr-diego',
    nombre: 'Diego',
    apellido: 'Ferreyra',
    email: 'diego.ferreyra@rentar.test',
    password: MOCK_PASSWORD,
    roles: ['locatario'],
    status: 'activo',
    telefono: '+54 351 555-0105',
    dni: '37123456',
    fechaNacimiento: '1993-09-30',
  },
]
