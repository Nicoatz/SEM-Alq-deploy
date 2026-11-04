| **Consultar el monto del alquiler** |
| - |
| Como locatario, quiero consultar el monto del alquiler para conocer cuánto deberé pagar. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión. |
| - Se consulta en el panel del locatario (/panel), en la tarjeta "Tu próximo alquiler", y en Mi alquiler (/panel/alquiler). |
| - Solo se muestran los montos de los contratos en los que el usuario es locatario. |
| *Monto a pagar* |
| - Se debe mostrar el monto del período a pagar: el período pendiente o vencido más antiguo o, si está todo pagado, el período siguiente. |
| - Se deben mostrar el período, la fecha de vencimiento y cuántos días faltan (por ejemplo, "vence el 10/10 · en 23 días"). |
| - El monto del período es el monto actual del contrato, con los ajustes aplicados (US-11). |
| - Si el período tiene un pago parcial, se muestra el saldo pendiente y lo ya pagado. |
| - Los montos se muestran en pesos, con separador de miles y sin decimales. |
| *Intereses por mora* |
| - Si el período está vencido y pasaron los días de gracia de la propiedad, se suman los intereses por mora con el interés diario cargado en la propiedad, por cada día de atraso. |
| - Con intereses, se debe mostrar el total y, debajo, el desglose: alquiler, intereses por mora y días de atraso. |
| - Mientras el período no venció, se debe informar desde cuándo y con qué interés se suma el recargo. |
| *Variantes de la tarjeta* |
| - Al día: se indica "Vence en N días". |
| - Faltan 3 días o menos: se destaca el vencimiento y se agrega "Pagá antes del dd/mm para evitar el recargo". |
| - Vencido: se indica "Vencido hace N días" y el monto muestra el total con intereses y su desglose. |
| - Pagado: la tarjeta pasa al período siguiente y ofrece ver el comprobante del último pago (US-10). |
| - Contrato pendiente de firma: se muestra el monto inicial del contrato, con la aclaración de que el primer período se habilita cuando firmen todas las partes. |
| - Sin contrato: se debe mostrar "Todavía no tenés un contrato activo" con acceso a buscar propiedades. |
| *Panel del locatario* |
| - Se deben mostrar los últimos 3 pagos, con período, fecha, medio, monto y estado, y el acceso al historial completo (US-09). |
| - Con dos o más contratos vigentes, se debe mostrar el monto de cada contrato con su propiedad, y el total del mes. |
| - Cada bloque del panel carga y falla por separado. Si un bloque no se puede traer, muestra su propio mensaje de error con la opción de reintentar. |
| **Pruebas de usuario:** |
| - Probar consultar el monto sin haber iniciado sesión (falla). |
| - Probar consultar el monto con un contrato vigente al día y verificar el monto, el período, la fecha de vencimiento y los días que faltan (pasa). |
| - Probar consultar el monto a 2 días del vencimiento y verificar el aviso para evitar el recargo (pasa). |
| - Probar consultar un período vencido dentro de los días de gracia y verificar que no se sumen intereses (pasa). |
| - Probar consultar un período vencido después de los días de gracia y verificar a mano el cálculo de los intereses y el desglose (pasa). |
| - Probar consultar un período con pago parcial y verificar el saldo pendiente (pasa). |
| - Probar pagar el período y verificar que la tarjeta pase al período siguiente con acceso al comprobante (pasa). |
| - Probar consultar después de un ajuste y verificar que el monto sea el ajustado (pasa). |
| - Probar consultar con un contrato pendiente de firma y verificar que se muestre el monto inicial con la aclaración (pasa). |
| - Probar consultar sin contratos y verificar el mensaje con acceso a buscar propiedades (pasa). |
| - Probar verificar que el panel muestre los últimos 3 pagos y el acceso al historial (pasa). |
| - Probar consultar con dos contratos vigentes y verificar el monto de cada uno y el total del mes (pasa). |
| - Probar consultar el monto en Mi alquiler y verificar que coincida con el del panel (pasa). |
| - Probar simular un error en el bloque de últimos pagos y verificar que el monto se siga mostrando (pasa). |
