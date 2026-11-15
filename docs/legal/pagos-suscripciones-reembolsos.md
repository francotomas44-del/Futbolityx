# Pagos, Suscripciones y Reembolsos

**Futbolityx** · Versión 2.0 · Última actualización: 14 de noviembre de 2026

> Este documento forma parte del conjunto legal de Futbolityx. Complementa los
> [Términos y Condiciones](terminos-y-condiciones.md) y la
> [Política de Privacidad](politica-de-privacidad.md).

## 1. Alcance

Futbolityx ofrece un plan **Free** y planes pagos **Pro** y **Elite**. Los planes
pagos se contratan como **suscripciones** con renovación automática, salvo que el
usuario las cancele antes del siguiente período.

Este documento regula:

- los precios y la forma de pago;
- la activación, renovación, cambio y cancelación de los planes;
- las fallas de pago y la suspensión del acceso;
- los reembolsos y el derecho de revocación;
- la relación con los proveedores de pago.

Futbolityx **no** es un servicio de apuestas, no organiza apuestas, no fija cuotas
y no custodia fondos de apuestas. El pago es únicamente por el uso de la
herramienta de análisis y sus funciones adicionales.

## 2. Planes y precios

Los planes y precios vigentes se muestran en la aplicación y en
`GET /v1/plans`. Al momento de esta versión, la propuesta es:

- **Free:** gratis.
- **Pro:** ARS 6.900/mes · ARS 59.000/año · USD 9/mes · USD 90/año.
- **Elite:** ARS 14.900/mes · ARS 129.000/año · USD 19/mes · USD 190/año.

Los precios pueden mostrarse con impuestos incluidos o discriminados según el
proveedor y la jurisdicción. El precio aplicable es el que se muestra en el
checkout antes de confirmar el pago.

Los precios son una **propuesta de lanzamiento** hasta que se habiliten los
cobros. Futbolityx puede modificarlos; los cambios no afectan retroactivamente
períodos ya pagados. Si un cambio de precio afecta una renovación, se avisará
con una anticipación razonable antes del siguiente cobro.

## 3. Proveedores de pago

Futbolityx utiliza:

- **Mercado Pago** para pagos en pesos argentinos (ARS);
- **Paddle** para pagos internacionales en dólares estadounidenses (USD).

El proveedor procesa el pago, la tarjeta o el medio elegido, la factura o
comprobante y las devoluciones. Futbolityx **no recibe ni almacena números de
tarjeta, códigos de seguridad ni credenciales bancarias**.

Al contratar, el usuario también acepta los términos y la política de privacidad
del proveedor correspondiente. Si el proveedor rechaza el pago, la suscripción no
se activa.

## 4. Cuenta y autorización

Para contratar un plan pago se requiere una cuenta creada con un email válido
mediante el enlace de acceso (magic link). El usuario debe:

- usar un email del que sea titular y que revise periódicamente;
- mantener la confidencialidad de su acceso;
- no compartir la cuenta ni revender el acceso;
- informar de inmediato cualquier uso no autorizado a **futbolityx@gmail.com**.

La cuenta es personal. Futbolityx puede limitar o suspender cuentas que compartan
credenciales, revendan el acceso o abusen de los límites del plan.

## 5. Activación y renovación automática

Al confirmar el checkout, el usuario autoriza al proveedor a cobrar el precio del
plan elegido y, si corresponde, a renovarlo automáticamente al final de cada
período (mensual o anual) hasta que lo cancele.

La suscripción se activa cuando el proveedor confirma el pago y Futbolityx recibe
el webhook firmado. La activación puede demorar algunos segundos o minutos. Si el
plan no se refleja en la cuenta, el usuario puede actualizar el panel o escribir
a **futbolityx@gmail.com**.

El cobro de renovación se realiza en la fecha del ciclo facturado. Si esa fecha no
existe en un mes determinado, se aplica la última fecha válida del mes.

## 6. Cancelación

El usuario puede cancelar la renovación automática en cualquier momento desde el
panel de cuenta o escribiendo a **futbolityx@gmail.com**.

La cancelación:

- detiene los cobros futuros;
- mantiene el acceso al plan hasta el final del período ya pagado;
- no genera un reembolso automático por el tiempo no utilizado, salvo lo previsto
  en la sección 8 o en normas imperativas.

Si el usuario elimina su cuenta, se aplica lo mismo respecto del período pagado.
Futbolityx puede conservar los registros de facturación exigidos por la ley.

## 7. Cambios de plan

- **Mejora (upgrade):** se cobra el precio del nuevo plan según el proveedor. El
  acceso al nuevo plan se activa cuando se confirma el pago. El proveedor puede
  prorratear o no el período anterior; el importe se muestra antes de confirmar.
- **Baja (downgrade):** el cambio se aplica al final del período pagado, salvo que
  el proveedor permita otra modalidad. No se reembolsa la diferencia por el
  período en curso, salvo lo previsto en la sección 8.

Futbolityx no garantiza prorrateos que dependan de la configuración del proveedor.

## 8. Reembolsos y derecho de revocación

### 8.1 Derecho de revocación

Cuando la ley aplicable reconozca un derecho de revocación o arrepentimiento en
contratos a distancia (por ejemplo, el artículo 34 de la Ley 24.240 de Defensa del
Consumidor de Argentina), el usuario puede solicitarlo dentro de los **10 días
corridos** de la contratación, siempre que no haya consumido sustancialmente el
servicio.

La solicitud debe enviarse a **futbolityx@gmail.com** con el email de la cuenta, la
fecha del pago y el identificador de la operación. Futbolityx responderá y
coordinará la devolución con el proveedor.

### 8.2 Reembolsos por fallas imputables a Futbolityx

Si el servicio pago no se presta por una falla imputable a Futbolityx durante un
período significativo, el usuario puede solicitar un reembolso proporcional o un
crédito. Se evaluará de buena fe según el tiempo afectado y el uso realizado.

### 8.3 Casos generales

Salvo los supuestos anteriores o normas imperativas:

- no se reembolsan períodos ya iniciados por falta de uso;
- no se reembolsan cuentas suspendidas por incumplimiento de los Términos;
- no se reembolsan diferencias por cambio de plan o de período;
- los reembolsos se realizan por el mismo medio de pago, cuando sea posible.

Los derechos irrenunciables del consumidor prevalecen sobre esta sección.

## 9. Fallas de pago y suspensión

Si el proveedor rechaza un cobro:

1. Futbolityx puede reintentar el cobro o pedir al usuario que actualice el medio
   de pago.
2. Durante un período de gracia razonable, el acceso puede mantenerse.
3. Si el pago no se regulariza, el plan puede volver a Free y las funciones pagas
   pueden quedar bloqueadas.

La suspensión por falta de pago no elimina la deuda devengada ni impide el cobro
de períodos ya iniciados, en la medida permitida por la ley.

## 10. Facturación e impuestos

El comprobante o factura se emite a través del proveedor de pago o del mecanismo
que corresponda según la jurisdicción. El usuario es responsable de los impuestos,
retenciones o cargas aplicables a su situación.

Futbolityx puede solicitar datos fiscales cuando la ley lo exija. Esos datos se
tratan conforme a la Política de Privacidad.

## 11. Contracargos

Si el usuario inicia un contracargo, Futbolityx puede suspender el acceso mientras
se investiga y aportar al proveedor la información de la cuenta y del uso. El
contracargo no exime del pago de períodos devengados si el cargo era válido.

## 12. Límites de uso y uso razonable

Los planes incluyen límites de análisis, funciones y datos en vivo. Los límites
vigentes se muestran en la aplicación y pueden ajustarse por razones técnicas,
de seguridad o de costos, sin afectar negativamente el período ya pagado de forma
sustancial.

Queda prohibido el uso automatizado abusivo, la reventa de acceso, la elusión de
límites y el uso compartido de credenciales. Futbolityx puede aplicar límites
técnicos y suspender cuentas ante abuso.

## 13. Disponibilidad y cambios del servicio

El servicio se presta “según disponibilidad”. Futbolityx puede modificar funciones
por razones técnicas, legales o de seguridad. Si se discontinúa un plan pago, se
ofrecerá una alternativa razonable o el reembolso proporcional del período no
utilizado, salvo normas imperativas en contrario.

## 14. Atención al cliente y reclamos

Canal oficial: **futbolityx@gmail.com** (asunto “Pagos”).

El usuario puede reclamar por:

- cobros no reconocidos;
- activación o renovación incorrecta;
- cancelaciones no procesadas;
- reembolsos.

Futbolityx responderá en un plazo razonable y, en todos los casos, dentro de los
plazos legales aplicables. También puede acudir a los organismos de defensa del
consumidor correspondientes.

## 15. Legislación aplicable

Este documento se rige por la legislación de la **República Argentina**, sin
perjuicio de las normas imperativas de protección al consumidor y de la
jurisdicción que corresponda al usuario.

## 16. Documentos relacionados

- [Términos y Condiciones](terminos-y-condiciones.md)
- [Política de Privacidad](politica-de-privacidad.md)
- [Política de Cookies](politica-de-cookies.md)
- [Aviso Legal](aviso-legal.md)
- [Descargo de Responsabilidad](descargo-de-responsabilidad.md)
- [Juego Responsable](juego-responsable.md)
