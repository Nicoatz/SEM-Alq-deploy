| **Cancelar reclamo** |
| - |
| Como locatario, quiero cancelar un reclamo que realicé, para darlo de baja si ya no requiere atención. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión como el locatario que registró el reclamo. |
| - El locador no puede cancelar un reclamo. |
| - Solo se puede cancelar un reclamo que se encuentre en estado "abierto" o "en proceso". |
| - No se puede cancelar un reclamo que ya se encuentre en estado "resuelto" o "cancelado". |
| - Se debe solicitar confirmación al locatario antes de efectuar la cancelación. |
| - Al confirmar, el estado del reclamo debe actualizarse a "cancelado" y quedar reflejado en el listado y detalle de reclamos. |
| **Pruebas de usuario:** |
| - Probar cancelar un reclamo sin haber iniciado sesión (falla). |
| - Probar cancelar un reclamo siendo el locador de la propiedad (falla). |
| - Probar cancelar un reclamo siendo un locatario distinto al que registró el reclamo (falla). |
| - Probar cancelar un reclamo en estado "abierto" y verificar que su estado pase a "cancelado" (pasa). |
| - Probar cancelar un reclamo en estado "en proceso" y verificar que su estado pase a "cancelado" (pasa). |
| - Probar cancelar un reclamo que ya se encuentra en estado "resuelto" o "cancelado" (falla). |
