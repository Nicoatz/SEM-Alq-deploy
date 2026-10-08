| **Consultar solicitudes de alquiler** |
| - |
| Como locador o locatario, quiero consultar mis solicitudes de alquiler para conocer su estado e información. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión. |
| - Se debe visualizar el estado de la solicitud (aceptada, rechazada, pendiente). |
| - Para el locador, se debe visualizar el nombre y apellido de quien envió la solicitud. |
| - Se debe visualizar el tiempo de creación para las solicitudes pendientes, medido en cantidad de horas para las primeras 23 horas y en cantidad de días a partir de las 24 horas.
| - Para el locador, se debe visualizar un resumen de la solicitud en el listado de solicitudes: cantidad de convivientes, si posee mascotas, tipo de garantía, si declaró o no ingresos. |
| - Se debe mostrar el detalle de la solicitud al seleccionarla, con todos sus datos disponibles: nombre y apellido, fecha en que se envió la solicitud, teléfono de contacto, dirección de correo, DNI, ocupación, ingresos declarados, cantidad de convivientes, comentario respecto a sus mascotas (o "Sí" si no hay comentarios), garantías que ofrece y mensaje.
| - Se debe visualizar la imagen principal de la propiedad asociada a la solicitud. |
| - Se debe mostrar la cantidad de solicitudes. |
| - Se debe mostrar el mensaje de rechazo para propiedades rechazadas en el listado de solicitudes, hasta 80 caracteres (terminar con puntos suspensivos "..." en caso de que el mensaje exceda ese límite). |
| - Se puede filtrar las solicitudes: pendientes, aceptadas, rechazadas o todas. |
| - Se puede ordenar las solicitudes: más nuevas primero o más antiguas primero. |
| - Para el locatario, se puede cancelar la solicitud. |
| - Se debe solicitar por confirmación antes de cancelar la solicitud. |
| **Pruebas de usuario:** |
| - Probar consultar solicitudes de alquiler sin haber iniciado sesión (falla). |
| - Probar consultar solicitudes de alquiler y visualizar el estado, la cantidad total de solicitudes y la imagen principal de la propiedad asociada (pasa). |
| - Probar consultar solicitudes de alquiler como locador y visualizar el nombre y apellido del remitente junto con el resumen de la solicitud en el listado (pasa). |
| - Probar consultar solicitudes de alquiler pendientes creadas hace menos de 24 horas y verificar que el tiempo transcurrido se muestre en horas (pasa). |
| - Probar consultar solicitudes de alquiler pendientes creadas hace 24 horas o más y verificar que el tiempo transcurrido se muestre en días (pasa). |
| - Probar seleccionar una solicitud específica y verificar que se despliegue el detalle completo con todos los datos personales, de contacto y de la solicitud correspondientes (pasa). |
| - Probar visualizar una solicitud rechazada cuyo mensaje de rechazo sea menor o igual a 80 caracteres y verificar que se muestre por completo (pasa). |
| - Probar visualizar una solicitud rechazada cuyo mensaje de rechazo supere los 80 caracteres y verificar que el texto se trunque terminando en "..." (pasa). |
| - Probar filtrar las solicitudes por estado (pendientes, aceptadas, rechazadas y todas) y verificar que el listado se actualice mostrando los resultados correctos (pasa). |
| - Probar ordenar las solicitudes para visualizar las más nuevas primero (pasa). |
| - Probar ordenar las solicitudes para visualizar las más antiguas primero (pasa). |
| - Probar cancelar una solicitud enviada por el locatario, visualizar el pedido de confirmación y confirmar la cancelación (pasa). |
| - Probar cancelar una solicitud enviada por el locatario, visualizar el pedido de confirmación y rechazarlo, manteniendo la solicitud en su estado original (pasa). |
| - Probar cancelar una solicitud habiendo iniciado sesión como locador (falla). |
