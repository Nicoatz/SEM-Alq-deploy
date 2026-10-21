| **Consultar usuario** |
| - |
| Como usuario, quiero consultar mis datos para conocer la información registrada en la plataforma. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión. |
| - Se debe acceder desde la opción "Mi perfil" del menú de usuario, a la pantalla /panel/perfil. |
| - Se deben mostrar solo los datos del usuario que inició sesión. No existe forma de ver el perfil de otro usuario. |
| - Se deben mostrar los datos personales: nombre, apellido, DNI, correo electrónico, teléfono y fecha de nacimiento. |
| - El teléfono se debe mostrar con el formato visual UIT-T E.123 (por ejemplo, +54 351 415 2288). |
| - La fecha de nacimiento se debe mostrar con el formato dd/mm/aaaa. |
| - Los datos que el usuario no cargó se deben mostrar como "Sin cargar", con acceso a completarlos. |
| - Se deben mostrar los roles del usuario. Todo usuario es locatario, y es también locador si publicó al menos una propiedad. |
| - Si el usuario no es locador, se debe mostrar el mensaje "Para ser locador, publicá tu primera propiedad" con acceso a publicar. |
| - Se debe mostrar el legajo: situación ocupacional, ingreso mensual declarado y garantías que puede ofrecer. |
| - Se debe indicar si el legajo está completo o incompleto y, si está incompleto, qué datos faltan. |
| - El DNI y los ingresos solo se muestran en esta pantalla y en el detalle de una solicitud enviada (US-36). Nunca en listados. |
| - La pantalla se organiza en bloques: Datos personales, Legajo, Acceso y seguridad, y Mis roles. En móvil, cada bloque se puede desplegar y plegar. |
| **Pruebas de usuario:** |
| - Probar consultar el perfil sin haber iniciado sesión (falla). |
| - Probar consultar el perfil y verificar que se muestren nombre, apellido, DNI, correo, teléfono y fecha de nacimiento del usuario (pasa). |
| - Probar verificar que el teléfono se muestre con el formato E.123 (pasa). |
| - Probar consultar el perfil de un usuario sin teléfono cargado y verificar que se muestre "Sin cargar" (pasa). |
| - Probar consultar el perfil de un usuario que solo es locatario y verificar que se muestre el acceso para publicar su primera propiedad (pasa). |
| - Probar consultar el perfil de un usuario locador y verificar que se muestren los roles de locador y locatario (pasa). |
| - Probar consultar el perfil con el legajo incompleto y verificar que se indique qué datos faltan (pasa). |
| - Probar consultar el perfil con el legajo completo y verificar que se indique como completo (pasa). |
| - Probar intentar acceder al perfil de otro usuario modificando la URL o la petición (falla). |
