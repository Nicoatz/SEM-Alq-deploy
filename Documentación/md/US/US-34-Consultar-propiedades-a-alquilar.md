| **Consultar propiedades disponibles** |
| - |
| Como locatario quiero consultar las propiedades disponibles para acordar un alquiler. |
| **Criterios de aceptación:** |
|- Se deben ver todas las propiedades registradas publicadas o publicadas/alquiladas.|
|- Se debe mostrar la imagen principal de cada propiedad visible.|
|- Se debe mostrar la dirección de cada propiedad visible.|
|- Se debe mostrar el precio de cada propiedad visible.|
|- Se debe mostrar las expensas de cada propiedad visible.|
|- Se debe mostrar la descripción de cada propiedad visible.|
|- Se debe mostrar los m2 de cada propiedad visible.|
|- Se debe mostrar el índice ajuste de cada propiedad visible.|
|- Se debe mostrar la fecha de disponibilidad de cada propiedad visible.|
|- Se puede filtrar las propiedades por barrio, precio mensual (rango), tipo, dormitorios, ambientes, superficie, tags, índice de ajuste. |
|- Se debe paginar las propiedades cuando haya más de 10 resultados. |
|- Se puede ordenar las propiedades por precio, cantidad habitaciones, cantidad mts2. |
|**Pruebas de usuario:**|
|- Probar consultar propiedades disponibles con sus datos sin haber iniciado sesión (pasa). |
|- Probar consultar propiedades disponibles con sus datos habiendo iniciado sesión (pasa). |
|- Probar consultar propiedades disponibles cuando no existen propiedades que cumplan con los filtros y verificar que se muestre un mensaje indicando que no hay resultados (pasa).|
|- Probar consultar propiedades disponibles aplicando filtros. (pasa) |
|- Probar consultar propiedades disponibles aplicando más de un filtro al mismo tiempo y verificar que solo se muestren las propiedades que cumplan con todos los criterios seleccionados. (pasa) |
|- Probar consultar propiedades disponibles, quitar los filtros aplicados y verificar que vuelvan a mostrarse todas las propiedades correspondientes. (pasa) |
|- Probar consultar propiedades disponibles y que se paginen los resultados al haber más de 10 propiedades listadas (pasa). |
|- Probar consultar propiedades disponibles y ordenarlas por precio (pasa). |
|- Probar consultar propiedades disponibles y ordenarlas por cantidad de habitaciones (pasa). |
|- Probar consultar propiedades disponibles y ordenarlas por cantidad de mts2 (pasa). |
|- Probar consultar propiedades ordenandolas por algún criterio, quitar el ordenamiento aplicados y verificar que vuelvan a mostrarse todas las propiedades en el orden correspondientes (pasa).|

| **Consultar detalle de propiedad disponible** |
| - |
| **Criterios de aceptación:** |
| - Se debe poder consultar el detalle de una propiedad disponible mediante su ID. |
| - Solo se debe poder consultar el detalle de propiedades con estado publicado o publicado/alquilado. |
| - Se debe mostrar el tipo de inmueble. |
| - Se debe mostrar la dirección, número, piso, ciudad, barrio y provincia. |
| - Se debe mostrar la cantidad de ambientes, dormitorios y baños. |
| - Se debe mostrar los m2 totales y cubiertos. |
| - Se debe mostrar la descripción de la propiedad. |
| - Se debe mostrar el precio del alquiler. |
| - Se deben mostrar las expensas. |
| - Se debe mostrar el índice de ajuste. |
| - Se debe mostrar la fecha de disponibilidad. |
| - Se deben mostrar los tags asociados a la propiedad. |
| - Se debe mostrar el servicio asociado a la propiedad, si corresponde. |
| - Se deben mostrar todas las fotos de la propiedad, indicando cuál es la foto principal. |
| - Si el ID no corresponde a una propiedad disponible, se debe informar que la propiedad no fue encontrada. |
| - Si el ID proporcionado no es válido, se debe informar que el ID debe ser un número entero válido. |