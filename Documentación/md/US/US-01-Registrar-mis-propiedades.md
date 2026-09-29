| **Registrar mis propiedades** |
| - |
| Como locador, quiero registrar una propiedad, para incorporarla a la plataforma y poder gestionarla. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión. |
| - Se puede ingresar una descripción para la propiedad a publicar. |
| - Se debe indicar el estado del alquiler: publicado, pausado o alquilado. |
| - Si la propiedad se encuentra alquilada, se puede ingresar desde qué fecha estará disponible para alquilar. |
| - Se debe indicar la provincia en la que se encuentra la propiedad. |
| - Se debe indicar la ciudad en la que se encuentra la propiedad. |
| - Se debe indicar el barrio en el que se encuentra la propiedad. |
| - Se debe indicar la calle en la que se encuentra la propiedad. |
| - Se debe indicar a qué altura de la calle se encuentra la propiedad. |
| - Se debe indicar los metros cuadrados de la superficie total. |
| - Se debe indicar los metros cuadrados de la superficie cubierta. |
| - Se debe indicar el tipo de propiedad (casa, departamento, monoambiente). |
| - Se debe indicar la cantidad de dormitorios de la propiedad si no es un monoambiente. |
| - Se debe indicar la cantidad de ambientes de la propiedad si no es un monoambiente. |
| - Se debe indicar la cantidad de baños de la propiedad. |
| - Se pueden indicar tags de la propiedad, que son características adicionales. |
| - Se deben cargar al menos tres fotos de la propiedad. |
| - Las fotos deberán estar en formato JPG o PNG y no superar los 350kb. |
| - Se pueden cargar hasta 50 fotos por propiedad. |
| - Se puede indicar la antigüedad de la propiedad. |
| - Se debe escoger la primer foto cargada como la imagen principal de la propiedad. |
| - Se puede cambiar la foto principal de la propiedad. |
| - Se debe indicar el monto de alquiler de la propiedad. |
| - Se debe indicar el monto de las expensas de la propiedad. |
| - Se puede indicar el índice de actualización de la propiedad. |
| - Se debe indicar los métodos de pago preferidos. |
| - Se puede indicar el interés por día de atraso. |
| - Si se indicó el interés por día, se deben indicar los días de gracia. |
| - Se puede indicar la frecuencia de ajuste. |
| - Se puede indicar la duración del contrato. |
| - Se puede indicar el depósito solicitado al locatario. |
| - Se debe verificar el rol del usuario y, tras registrar la propiedad, asignarle automáticamente el rol de locador si aún no lo tiene. |
| **Pruebas de usuario:** |
| - Probar registrar una propiedad sin contar con una sesión iniciada (falla). |
| - Probar registrar una propiedad y no haber adjuntado ninguna foto (falla). |
| - Probar registrar una propiedad sin haber ingresado una descripción (pasa). |
| - Probar registrar una propiedad sin haber ingresado una calle (falla). |
| - Probar registrar una propiedad sin haber ingresado una altura de calle (falla). |
| - Probar registrar una propiedad sin haber ingresado los metros cuadrados (falla). |
| - Probar registrar una propiedad sin haber seleccionado el tipo de propiedad (falla). |
| - Probar registrar una propiedad que no es monoambiente sin haber ingresado la cantidad de dormitorios (falla). |
| - Probar registrar una propiedad que no es monoambiente sin haber ingresado la cantidad de ambientes (falla). |
| - Probar registrar una propiedad monoambiente con más de un ambiente (falla). |
| - Probar registrar una propiedad monoambiente con más de un dormitorio (falla). |
| - Probar registrar una propiedad y cargar más de 50 fotos (falla). |
| - Probar registrar una propiedad y cargar una foto en un formato diferente a JPG o PNG (falla). |
| - Probar registrar una propiedad y cargar una foto con peso mayor a 350kb (falla). |
| - Probar registrar una propiedad sin haber ingresado la antigüedad de la propiedad (pasa). |
| - Probar registrar una propiedad sin haber indicado el estado del alquiler (falla).  |
| - Probar registrar una propiedad sin haber indicado la ciudad, provincia y barrio en los que se encuentra (falla). |
| - Probar registrar una propiedad con menos de 0 habitaciones (falla). |
| - Probar registrar una propiedad que no es monoambiente con menos de 1 habitación (falla). |
| - Probar registrar una propiedad que no es monoambiente con menos de 2 ambientes (falla). |
| - Probar registrar una propiedad con 0 o menos metros cuadrados (falla). |
| - Probar registrar una propiedad con 0 o menos baños (falla). |
| - Probar registrar una propiedad sin haber seleccionado tags (pasa). |
| - Probar registrar una propiedad y seleccionar uno o más tags (pasa). |
| - Probar registrar una propiedad sin ingresar un monto de alquiler (falla). |
| - Probar registrar una propiedad sin ingresar un monto de expensas (falla). |
| - Probar registrar una propiedad sin seleccionar un índice de actualización (pasa). |
| - Probar registrar una propiedad sin indicar los métodos de pago preferidos (pasa). |
| - Probar registrar una propiedad indicando el interés por día pero no los días de gracia (falla). |
| - Probar registrar una propiedad indicando el interés por día pero no los días de gracia (falla). |

