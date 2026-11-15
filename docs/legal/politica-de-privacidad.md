# Política de Privacidad

**Futbolityx** · Versión 2.0 · Última actualización: 14 de noviembre de 2026

> Este documento explica qué información existe cuando usás Futbolityx, dónde se
> guarda, quién la trata y qué derechos tenés. Forma parte del conjunto de
> documentos legales; ver el [índice](README.md).

## 1. Principios generales

Futbolityx puede usarse **sin cuenta** y guarda la mayor parte de la información
en el navegador. Para contratar planes pagos, acceder a funciones en vivo o
gestionar una suscripción se necesita una cuenta creada con un email.

Esta Política describe:

- qué datos se guardan **localmente** en el dispositivo;
- qué datos se tratan en **servidores propios** cuando usás una cuenta o el
  backend;
- qué datos tratan los **proveedores** (alojamiento, base de datos, email, pagos y
  fuentes públicas);
- con qué finalidades y bases legales;
- cuánto tiempo se conservan;
- cómo ejercer tus derechos.

El uso de la Plataforma implica la aceptación de esta Política. Si no estás de
acuerdo, no utilices la Plataforma.

## 2. Responsable del tratamiento

El responsable del tratamiento es **Franco Tomas Herrera Sanchez**, titular de
**Futbolityx**, CUIT **20-37341881-2**, con domicilio legal en **Urquiza 889**
(República Argentina). El detalle figura en el [Aviso Legal](aviso-legal.md).

- **Contacto:** futbolityx@gmail.com (asunto “Privacidad”).
- **País:** República Argentina.
- **Sitio principal:** el dominio de Vercel donde se publica la app.
- **Espejo:** https://francotomas44-del.github.io/Futbolityx/

## 3. Qué datos NO se recopilan

Futbolityx **no** recopila ni solicita:

- nombre, apellido, documento, CUIT ni fecha de nacimiento (salvo datos fiscales
  que el proveedor de pago solicite para emitir un comprobante);
- teléfono;
- contraseñas (el acceso es por enlace de un solo uso);
- números de tarjeta, códigos de seguridad ni credenciales bancarias;
- ubicación precisa ni geolocalización;
- contactos, agenda, cámara, micrófono ni archivos del dispositivo;
- identificadores publicitarios;
- datos biométricos;
- datos sensibles.

Tampoco utiliza:

- cookies de seguimiento propias;
- herramientas de analítica web (Google Analytics, píxeles publicitarios u otras);
- publicidad comportamental;
- fingerprinting;
- perfilado comercial de usuarios.

## 4. Datos almacenados en tu dispositivo

La Plataforma guarda información **en tu navegador** para funcionar y recordar tu
estado entre visitas.

**a) Almacenamiento local (localStorage).** Se usan claves con prefijos
`futbolityx:` y `futbolunaki:`, entre ellas:

- preferencias de interfaz (modo simple/avanzado, país para horarios);
- registro de archivos de la base ya importados;
- cachés de datos en vivo y de noticias;
- marca de “hay datos guardados”;
- respaldo liviano del estado.

**b) IndexedDB.** Base de datos local `futbolunaki`, almacén `kv`, donde se guarda
el historial grande: equipos, partidos, predicciones y configuraciones.

**c) Cache Storage (service worker).** Copia de los archivos de la aplicación y de
los datos descargados, para que abra rápido y funcione sin conexión. El nombre de la
caché incluye una versión (por ejemplo, `futbolityx-v58`). Las rutas de la API y
los webhooks **no** se cachean.

**d) Archivos exportados.** El botón de copia de seguridad genera un archivo JSON en
tu dispositivo. Ese archivo lo controlás vos: si lo compartís, la información que
contiene deja de estar bajo el control de Futbolityx.

**Finalidad:** prestar las funcionalidades que pedís (cálculos, predicciones,
historial, preferencias y funcionamiento offline).

**Conservación:** hasta que borres los datos. Podés hacerlo con el botón **Borrar
todo** de la app o desde la configuración de tu navegador.

## 5. Datos tratados en servidores propios

Cuando creás una cuenta, iniciás sesión o usás el backend, Futbolityx trata:

### 5.1 Datos de cuenta

- **Email** y un identificador interno de usuario.
- Fecha de creación, último acceso y estado de la cuenta.
- Plan actual (Free, Pro o Elite) y funciones habilitadas.
- Preferencias necesarias para la cuenta.

### 5.2 Acceso y seguridad

- **Tokens de magic link** (guardados como hash, con vencimiento de 15 minutos y
  un solo uso).
- **Sesiones** (identificador de sesión guardado como hash, con vencimiento de 30
  días, cookie `HttpOnly` y `SameSite=Lax`).
- Fecha y hora de creación, uso y cierre de sesión.
- Dirección IP y datos técnicos del pedido (navegador, origen) para seguridad,
  rate limiting y prevención de abuso.
- Registros de errores y eventos técnicos.

### 5.3 Uso del servicio

- Cantidad de análisis realizados en las últimas 24 horas.
- Funciones utilizadas (por ejemplo, datos en vivo) y plan aplicado.
- Eventos de uso necesarios para cuotas, límites y soporte.

No se guarda el contenido completo de tus análisis en el servidor: el backend
recibe los partidos necesarios para calcular el resultado y devuelve la respuesta.
Los datos locales de la app siguen en tu navegador.

### 5.4 Suscripciones y pagos

- Plan, intervalo (mensual/anual), estado de la suscripción y período facturado.
- Identificadores del cliente y de la suscripción en el proveedor de pago.
- Importe, moneda, estado y referencia de la operación.
- Eventos de webhook necesarios para activar, renovar o cancelar el plan.
- Email asociado a la cuenta y, si el proveedor lo exige, datos fiscales.

**No se almacenan números de tarjeta, códigos de seguridad ni credenciales
bancarias.** Esos datos los procesa directamente **Mercado Pago** o **Paddle**.

### 5.5 Email

- Dirección de destino, asunto, fecha de envío y estado de entrega del magic link
  o de comunicaciones transaccionales.
- El contenido de los emails transaccionales (por ejemplo, el enlace de acceso).

## 6. Datos técnicos tratados por terceros

El uso de internet implica que otros intervinientes vean datos técnicos mínimos:

**a) Alojamiento y funciones.** El sitio y el backend se publican mediante
**Vercel** (Vercel Inc.). Vercel puede registrar dirección IP, fecha y hora,
navegador, URL solicitada y registros de ejecución para servir el sitio, ejecutar
las funciones y proteger su infraestructura.

**b) Base de datos.** Las cuentas, sesiones, suscripciones y eventos se guardan en
un servicio PostgreSQL gestionado (por ejemplo, **Neon**, **Vercel Postgres** o
**Supabase**). El proveedor trata los datos por cuenta y orden de Futbolityx.

**c) Email transaccional.** Los magic links y avisos se envían con **Resend**. Resend
recibe la dirección de destino y el contenido del mensaje para entregarlo.

**d) Pagos.** **Mercado Pago** procesa pagos en ARS y **Paddle** procesa pagos en
USD. Ambos reciben los datos necesarios para cobrar, emitir comprobantes y gestionar
la suscripción, conforme a sus propias políticas. Paddle puede actuar como
comerciante registrado (merchant of record) para las ventas internacionales.

**e) Fuentes públicas de datos.** Para mostrar partidos en vivo, alineaciones,
estadísticas, noticias y estado de los encuentros, el backend o el navegador
consultan una **fuente pública de datos deportivos y de noticias** (ESPN). Esa
fuente recibe la dirección IP del servidor o del navegador, el tipo de cliente y la
URL consultada, y aplica sus propias políticas. La fuente está identificada en
[`docs/atribuciones.md`](../atribuciones.md).

**f) Enlaces externos.** Los botones “Buscar en Google News” abren una búsqueda en
Google. Esa consulta solo se realiza si hacés clic; a partir de ese momento se aplica
la política de privacidad de Google.

**g) Correo de contacto.** Si escribís al correo de contacto, tu proveedor y el
destinatario tratarán los datos que incluyas en el mensaje. Se usan solo para
responder la consulta.

Futbolityx no recibe copia de los registros internos de Vercel, del proveedor de
base de datos, de Resend, de los proveedores de pago, de ESPN ni de Google, salvo
los datos que esos servicios devuelvan por API para prestar el servicio.

## 7. Base legal

Cuando resulte aplicable, el tratamiento se apoya en:

- la **ejecución del contrato o del servicio** solicitado (cuenta, análisis,
  suscripción, soporte);
- el **consentimiento** del usuario (por ejemplo, al crear la cuenta, recibir el
  magic link o escribir al correo de contacto);
- el **interés legítimo** en la seguridad, la prevención de abuso, la integridad
  del servicio y la defensa de derechos;
- el **cumplimiento de obligaciones legales** (facturación, contabilidad,
  requerimientos de autoridades).

La Ley 25.326 de Protección de Datos Personales y normas concordantes resultan
aplicables en la medida en que exista tratamiento de datos personales.

## 8. Finalidades

Los datos se usan para:

- crear y autenticar la cuenta por magic link;
- mantener la sesión y permitir el cierre de sesión;
- resolver el plan, las funciones habilitadas y las cuotas;
- procesar pagos, activar, renovar y cancelar suscripciones;
- enviar emails transaccionales (acceso, recibos, avisos del servicio);
- prevenir fraude, abuso, uso compartido de cuentas y ataques;
- aplicar rate limiting y proteger la infraestructura;
- brindar soporte y responder consultas;
- cumplir obligaciones legales y defender derechos;
- elaborar métricas agregadas y técnicas para mejorar el servicio.

No se usa para publicidad, perfilado comercial, venta a terceros ni decisiones
automatizadas con efectos jurídicos sobre el usuario.

## 9. Conservación

- **Datos locales:** hasta que los borres o el navegador los elimine.
- **Cachés:** se renuevan o se descartan según su vigencia técnica y la versión de la
  aplicación.
- **Magic links:** 15 minutos o hasta su uso.
- **Sesiones:** 30 días desde su creación, salvo cierre de sesión o revocación.
- **Cuenta y uso:** mientras la cuenta esté activa y durante el plazo necesario para
  soporte, seguridad y obligaciones legales.
- **Suscripciones y pagos:** durante la relación contractual y hasta el plazo legal
  aplicable (incluido el plazo de conservación contable e impositiva, que puede
  extenderse hasta 10 años).
- **Eventos de webhook:** el tiempo necesario para conciliar pagos, prevenir fraude
  y cumplir obligaciones legales.
- **Correo de contacto:** el tiempo necesario para atender la consulta y cumplir
  obligaciones legales.

Cuando los datos ya no sean necesarios, se eliminarán o se anonimizarán de forma
razonable.

## 10. Destinatarios y transferencias internacionales

Futbolityx **no vende, alquila ni comercializa** datos personales.

Comparte datos con:

- los proveedores técnicos mencionados (Vercel, base de datos, Resend, Mercado Pago,
  Paddle, ESPN, Google solo si hacés clic en un enlace);
- autoridades competentes, cuando exista obligación legal o requerimiento válido;
- quien resulte necesario para proteger derechos, seguridad o integridad del sitio;
- un sucesor del proyecto, en caso de cesión, con aviso en el sitio.

Esos proveedores pueden estar ubicados fuera de la Argentina. Al usar la Plataforma,
el usuario acepta que los datos se procesen conforme a las políticas de esos
terceros y, cuando corresponda, a las garantías contractuales aplicables.

## 11. Seguridad

Se adoptan medidas razonables, entre ellas:

- HTTPS en el sitio y en el backend;
- cookies de sesión `HttpOnly`, `SameSite=Lax` y `Secure` en producción;
- tokens de magic link y de sesión guardados como hash;
- API keys guardadas como hash y comparadas de forma timing-safe;
- rate limiting, CORS restringido y allowlist opcional de IP para integraciones;
- separación de funciones y acceso mínimo a la base de datos;
- verificación de firma en los webhooks de pago;
- no almacenamiento de datos de tarjeta.

Ningún sistema informático ni transmisión por internet puede garantizar seguridad
absoluta. El usuario es responsable de la seguridad de su dispositivo, de su email,
de su navegador y de las copias de seguridad que exporte.

## 12. Derechos del usuario

Conforme a la legislación aplicable, el usuario puede solicitar:

- **acceso** a los datos personales que existan;
- **rectificación** de información inexacta;
- **actualización** de datos;
- **supresión** de datos;
- **confidencialidad**;
- **revocación** del consentimiento otorgado;
- **oposición** a determinados tratamientos, cuando corresponda.

Para presentar una solicitud, escribí a **futbolityx@gmail.com** con asunto
“Privacidad”, indicando qué derecho querés ejercer y los datos necesarios para
identificarte. Se responderá en un plazo razonable y dentro de los plazos legales.

También podés eliminar tus datos locales desde la app o el navegador, y solicitar
la eliminación de tu cuenta por email. La eliminación de la cuenta no borra
automáticamente los registros que la ley obligue a conservar (por ejemplo,
facturación) ni los datos locales del navegador.

En Argentina, la autoridad de control es la **Agencia de Acceso a la Información
Pública (AAIP)**, ante la cual puede presentarse un reclamo cuando corresponda.

## 13. Menores de edad

La Plataforma no está dirigida a menores de edad y no recopila datos de menores de
forma consciente.

Si un menor utiliza la Plataforma, debe hacerlo con autorización de su representante
legal y nunca para fines de apuestas. Los planes pagos requieren capacidad legal
para contratar. Si creés que un menor nos envió datos personales, escribí al
contacto para solicitar su eliminación.

## 14. Cambios en esta Política

Esta Política puede actualizarse para reflejar cambios técnicos, operativos o
normativos.

La versión vigente se publica en la Plataforma con su fecha de actualización. Los
cambios sustanciales se avisarán de forma razonable dentro del sitio o por email a
las cuentas registradas.

## 15. Contacto

Consultas sobre privacidad o ejercicio de derechos:
**futbolityx@gmail.com** (asunto “Privacidad”).

## 16. Anexo: cómo borrar tus datos

**Desde la app:** botón **Borrar todo** (barra superior). Elimina equipos, partidos,
predicciones y configuraciones guardadas en este navegador.

**Desde el navegador:** Configuración → Privacidad y seguridad → Borrar datos de
navegación → Cookies y datos de sitios. También podés eliminar el sitio de la lista
de datos almacenados.

**Cuenta:** escribí a **futbolityx@gmail.com** con asunto “Privacidad” para solicitar
la eliminación de la cuenta y de los datos asociados. Se conservarán los registros
exigidos por la ley.

**Si instalaste la PWA:** desinstalala desde el navegador o el sistema. Eso quita el
acceso directo, pero conviene borrar además los datos del sitio.

**Copias exportadas:** los archivos JSON que hayas descargado quedan en tu
dispositivo. Borralos manualmente si ya no los necesitás.

## 17. Documentos relacionados

- [Términos y Condiciones de Uso](terminos-y-condiciones.md)
- [Pagos, Suscripciones y Reembolsos](pagos-suscripciones-reembolsos.md)
- [Política de Cookies](politica-de-cookies.md)
- [Descargo de Responsabilidad](descargo-de-responsabilidad.md)
- [Aviso Legal](aviso-legal.md)
- [Juego Responsable](juego-responsable.md)
- [Atribuciones y licencias de datos](../atribuciones.md)
