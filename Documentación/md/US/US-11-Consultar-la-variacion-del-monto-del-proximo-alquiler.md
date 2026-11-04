| **Consultar la variación del monto del próximo alquiler** |
| - |
| Como locatario, quiero consultar la variación del monto del próximo alquiler para conocer cómo se modificará el importe de acuerdo con el índice establecido en el contrato. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con el usuario locatario del contrato. |
| - Se consulta desde Mi alquiler (/panel/alquiler): en el bloque "Lo que viene" y en el calendario de ajustes de la pestaña "Mi contrato". |
| - Solo se muestra para contratos vigentes. Con dos o más contratos, se consulta en la ficha de cada uno. |
| - Si el usuario intenta acceder por URL a un contrato del que no es locatario, se debe mostrar "No encontramos este alquiler", sin distinguir si existe. |
| *Próximo ajuste* |
| - Se deben mostrar el índice (ICL, IPC o CAC), la periodicidad, la fecha del próximo ajuste y cuántos días faltan. |
| - Se deben mostrar el monto actual y el monto estimado después del ajuste, con la variación en pesos y en porcentaje. |
| - Toda estimación se debe mostrar con "~" y la palabra "estimado", e indicar que el monto se confirma con el valor del índice a la fecha del ajuste. |
| - Si no hay valores del índice para estimar, el monto se debe mostrar como "a definir", con la explicación. |
| - El índice se muestra con su insignia (IndexBadge), que explica qué es y quién lo publica. |
| *Calendario de ajustes* |
| - Se deben mostrar la fecha de inicio con el monto inicial y las fechas de cada ajuste, con su índice. |
| - Los ajustes ya aplicados muestran el monto resultante y la variación respecto del monto anterior. |
| - Solo el próximo ajuste muestra un monto estimado. Los ajustes siguientes se muestran como "a definir". |
| - Se debe destacar el próximo ajuste. |
| *Ajuste aplicado* |
| - Cuando llega la fecha del ajuste, el nuevo monto pasa a ser el monto actual y se usa en los períodos siguientes (US-12). |
| - En Mis pagos (US-09), el primer período posterior a cada ajuste se marca con la insignia del índice, para que se entienda el cambio de monto. |
| *Contrato sin ajuste* |
| - Si el contrato es "Sin ajuste", se debe mostrar que el monto se mantiene hasta la fecha de fin del contrato y no se muestra el calendario. |
| **Pruebas de usuario:** |
| - Probar consultar la variación sin haber iniciado sesión (falla). |
| - Probar acceder por URL a la ficha de un contrato del que no se es locatario (falla). |
| - Probar consultar un contrato con ICL anual y verificar el índice, la periodicidad, la fecha del próximo ajuste y los días que faltan (pasa). |
| - Probar verificar que se muestren el monto actual, el monto estimado con "~" y "estimado", y la variación en pesos y en porcentaje (pasa). |
| - Probar verificar a mano el cálculo del monto estimado con los valores del índice cargados (pasa). |
| - Probar consultar un contrato cuyo índice no tiene valores cargados y verificar que el monto diga "a definir" (pasa). |
| - Probar verificar que el calendario muestre el inicio, los ajustes aplicados con su variación, el próximo estimado y los siguientes "a definir" (pasa). |
| - Probar consultar un contrato después de un ajuste y verificar que el nuevo monto sea el monto actual (pasa). |
| - Probar verificar en Mis pagos que el primer período posterior a un ajuste muestre la insignia del índice (pasa). |
| - Probar consultar un contrato sin ajuste y verificar que no se muestre el calendario y que se indique que el monto se mantiene (pasa). |
| - Probar consultar con dos contratos vigentes y verificar que cada ficha muestre su propia variación (pasa). |
