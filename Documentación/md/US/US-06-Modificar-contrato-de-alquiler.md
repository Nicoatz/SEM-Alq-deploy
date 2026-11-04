| **Modificar contrato de alquiler** |
| - |
| Como locador, quiero modificar un contrato que todavía no fue firmado por el locatario, para corregir su información antes de formalizar el alquiler. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con el usuario locador dueño del contrato. |
| - Solo se pueden modificar contratos en estado "borrador" o "pendiente de firma" sin la firma del locatario. |
| - Los contratos vigentes, finalizados o con la firma del locatario no se pueden modificar. Si se intenta, se debe explicar el motivo. |
| - Si el contrato no existe o no es del usuario, se debe mostrar "No encontramos este contrato", sin distinguir entre los dos casos. |
| *Borrador* |
| - Un borrador se debe retomar desde el paso en que quedó, con todos los datos cargados precargados. |
| - Se puede descartar un borrador, previa confirmación. Al descartarlo, la solicitud aceptada puede volver a originar un contrato. |
| *Contrato pendiente de firma* |
| - Antes de modificar un contrato pendiente de firma, se debe solicitar confirmación avisando que el envío se cancela, que se borran las firmas registradas y que el contrato vuelve a "borrador". |
| - Al confirmar, el contrato vuelve a "borrador" y conserva su código CT-AAAA-NNNN. |
| *Edición* |
| - Se edita con los mismos 4 pasos y las mismas validaciones que en el alta (US-05). |
| - La propiedad y el locatario no se pueden modificar: vienen de la solicitud de origen. |
| - Se pueden modificar los garantes, las condiciones y las cláusulas. |
| - Si la fecha de inicio guardada quedó en el pasado, se debe pedir una nueva antes de volver a enviar a firmar. |
| - Se puede guardar el contrato modificado como borrador o volver a enviarlo a firmar, con la misma casilla de revisión y la misma confirmación que en el alta. |
| - Si el usuario intenta salir con cambios sin guardar, se debe mostrar un aviso. |
| - Cada modificación se debe registrar en el historial del contrato con fecha y hora. |
| **Pruebas de usuario:** |
| - Probar modificar un contrato sin haber iniciado sesión (falla). |
| - Probar modificar el contrato de otro locador, accediendo por URL (falla). |
| - Probar retomar un borrador y verificar que se abra en el paso en que quedó, con los datos precargados (pasa). |
| - Probar modificar las condiciones de un borrador y guardar (pasa). |
| - Probar descartar un borrador confirmando la acción, y verificar que se pueda iniciar un contrato nuevo desde la misma solicitud (pasa). |
| - Probar descartar un borrador y cancelar la confirmación (pasa: el borrador se mantiene). |
| - Probar modificar un contrato pendiente de firma sin la firma del locatario, confirmar y verificar que vuelva a borrador, con las firmas borradas y el mismo código (pasa). |
| - Probar modificar un contrato pendiente de firma y cancelar la confirmación (pasa: el contrato sigue pendiente, con sus firmas). |
| - Probar modificar un contrato que el locatario ya firmó (falla). |
| - Probar modificar un contrato vigente o finalizado (falla). |
| - Probar intentar cambiar la propiedad o el locatario (falla). |
| - Probar agregar, modificar y quitar garantes con las validaciones de US-05 (pasa). |
| - Probar modificar el monto con un valor igual a 0 o con decimales (falla). |
| - Probar volver a enviar a firmar un contrato cuya fecha de inicio quedó en el pasado sin actualizarla (falla). |
| - Probar volver a enviar a firmar un contrato modificado y verificar que quede pendiente de firma con todas las firmas pendientes (pasa). |
| - Probar salir con cambios sin guardar y verificar que se muestre el aviso (pasa). |
| - Probar modificar un contrato y verificar que la modificación figure en el historial con fecha y hora (pasa). |
