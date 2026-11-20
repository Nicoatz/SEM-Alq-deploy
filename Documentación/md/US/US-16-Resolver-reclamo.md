| **Resolver reclamo** |
| - |
| Como locatario, quiero marcar un reclamo como resuelto, para indicar que la necesidad o inconveniente reportado ya fue solucionado por el locador. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión como el locatario que registró el reclamo. |
| - El locador no puede marcar un reclamo como resuelto. |
| - Solo se puede marcar como resuelto un reclamo que se encuentre en estado "en proceso". |
| - No se puede marcar como resuelto un reclamo en estado "abierto", "resuelto" o "cancelado". |
| - Se debe solicitar confirmación al locatario antes de cambiar el estado del reclamo a "resuelto". |
| - Al confirmar, el estado del reclamo debe actualizarse a "resuelto" y quedar registrado tanto en el listado de reclamos como en su detalle. |
| **Pruebas de usuario:** |
| - Probar marcar un reclamo como resuelto sin haber iniciado sesión (falla). |
| - Probar marcar un reclamo como resuelto siendo el locador de la propiedad (falla). |
| - Probar marcar un reclamo como resuelto siendo un locatario distinto al que registró el reclamo (falla). |
| - Probar marcar un reclamo en estado "en proceso" como resuelto y verificar que su estado cambie a "resuelto" (pasa). |
| - Probar marcar un reclamo en estado "abierto" como resuelto (falla). |
| - Probar marcar un reclamo que ya se encuentra en estado "resuelto" o "cancelado" como resuelto (falla). |
