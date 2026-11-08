# Política de Privacidad

**Futbolityx** · Versión 1.0 · Última actualización: 5 de noviembre de 2026

> Este documento explica qué información existe cuando usás Futbolityx, dónde se
> guarda y qué derechos tenés. Forma parte del conjunto de documentos legales; ver
> el [índice](README.md).

## 1. Principios generales

Futbolityx se diseñó para funcionar **sin cuentas, sin registro y sin backend
propio**. La mayor parte de la información se queda en el navegador del usuario.

Esta Política describe:

- qué datos **no** se recopilan;
- qué datos se guardan **localmente** en el dispositivo;
- qué datos técnicos pueden tratar **terceros** (alojamiento y fuentes públicas);
- cómo ejercer los derechos que reconoce la legislación aplicable.

El uso de la Plataforma implica la aceptación de esta Política. Si no estás de
acuerdo, no utilices la Plataforma.

## 2. Responsable del tratamiento

El responsable del tratamiento es **Franco Tomas Herrera Sanchez**, titular de
**Futbolityx**, con domicilio legal en **Urquiza 889** (República Argentina). El
detalle figura en el [Aviso Legal](aviso-legal.md).

- **Contacto:** futbolityx@gmail.com (asunto “Privacidad”).
- **País:** República Argentina.
- **Sitio:** https://francotomas44-del.github.io/Futbolityx/

## 3. Qué datos NO se recopilan

Futbolityx **no** recopila ni solicita:

- nombre, apellido, documento, CUIT ni fecha de nacimiento;
- correo electrónico ni teléfono;
- contraseñas ni credenciales (no existen cuentas);
- datos de pago, tarjetas ni información financiera;
- ubicación precisa ni datos de geolocalización;
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

La Plataforma guarda información **solo en tu navegador**, para que funcione y
recuerde tu estado entre visitas. Esa información no se transmite a Futbolityx.

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
caché incluye una versión (por ejemplo, `futbolityx-v53`).

**d) Archivos exportados.** El botón de copia de seguridad genera un archivo JSON en
tu dispositivo. Ese archivo lo controlás vos: si lo compartís, la información que
contiene deja de estar bajo el control de Futbolityx.

**Finalidad:** exclusivamente prestar las funcionalidades que pedís (cálculos,
predicciones, historial, preferencias y funcionamiento offline).

**Conservación:** hasta que borres los datos. Podés hacerlo con el botón **Borrar
todo** de la app o desde la configuración de tu navegador.

## 5. Datos técnicos tratados por terceros

Aunque Futbolityx no tenga backend, el uso de internet implica que otros
intervinientes vean datos técnicos mínimos:

**a) Alojamiento.** El sitio se publica mediante **GitHub Pages** (GitHub, Inc.).
GitHub puede registrar, conforme a su propia política de privacidad, datos técnicos
como dirección IP, fecha y hora de la solicitud, tipo de navegador y URL solicitada,
para servir el sitio y proteger su infraestructura. Futbolityx no accede a esos
registros ni los almacena.

**b) Fuentes públicas de datos.** Para mostrar partidos en vivo, alineaciones,
estadísticas, noticias y estado de los encuentros, el navegador realiza pedidos
directos a una **fuente pública de datos deportivos y de noticias**. Esa fuente
recibe tu dirección IP, el tipo de navegador y la URL consultada, y puede aplicar sus
propias políticas. La fuente está identificada en
[`docs/atribuciones.md`](../atribuciones.md).

**c) Enlaces externos.** Los botones “Buscar en Google News” abren una búsqueda en
Google. Esa consulta solo se realiza si hacés clic; a partir de ese momento se aplica
la política de privacidad de Google.

**d) Correo electrónico.** Si escribís al correo de contacto, tu proveedor y el
destinatario tratarán los datos que incluyas en el mensaje (por ejemplo, tu dirección
y el contenido). Se usan solo para responder la consulta.

Futbolityx no recibe copia de los registros de GitHub, de la fuente de datos ni de
Google.

## 6. Base legal

Cuando resulte aplicable, el tratamiento se apoya en:

- el **consentimiento** del usuario (por ejemplo, al escribir al correo de contacto);
- la **ejecución del servicio** solicitado (funciones que el navegador realiza
  localmente);
- el **interés legítimo** en la seguridad y el funcionamiento del sitio;
- el **cumplimiento de obligaciones legales** cuando corresponda.

La Ley 25.326 de Protección de Datos Personales y normas concordantes resultan
aplicables en la medida en que exista tratamiento de datos personales.

## 7. Finalidades

La información local se usa para:

- calcular probabilidades, estimaciones y simulaciones;
- guardar y recuperar predicciones y análisis;
- recordar preferencias (modo, país, cachés);
- permitir el funcionamiento sin conexión;
- mantener la integridad de la base importada.

No se usa para publicidad, perfilado comercial, venta a terceros ni decisiones
automatizadas con efectos jurídicos sobre el usuario.

## 8. Conservación

- **Datos locales:** hasta que los borres o el navegador los elimine.
- **Cachés:** se renuevan o se descartan según su vigencia técnica y la versión de la
  aplicación.
- **Correo de contacto:** el tiempo necesario para atender la consulta y cumplir
  obligaciones legales.

## 9. Destinatarios y transferencias internacionales

Futbolityx **no vende, alquila ni comercializa** datos personales.

No comparte datos con terceros, salvo:

- los proveedores técnicos mencionados (GitHub Pages, fuente pública de datos,
  Google solo si hacés clic en un enlace);
- autoridades competentes, cuando exista obligación legal o requerimiento válido;
- quien resulte necesario para proteger derechos, seguridad o integridad del sitio.

Esos proveedores pueden estar ubicados fuera de la Argentina. Al usar la Plataforma,
el usuario acepta que los datos técnicos se procesen conforme a las políticas de
esos terceros.

## 10. Seguridad

El sitio se sirve por **HTTPS**. La información del usuario permanece en su
dispositivo y no se transmite a Futbolityx.

Se adoptan medidas razonables de configuración y actualización, pero **ningún sistema
informático ni transmisión por internet puede garantizar seguridad absoluta**. El
usuario es responsable de la seguridad de su dispositivo, de su navegador y de las
copias de seguridad que exporte.

## 11. Derechos del usuario

Conforme a la legislación aplicable, el usuario puede solicitar:

- **acceso** a los datos personales que pudieran existir;
- **rectificación** de información inexacta;
- **actualización** de datos;
- **supresión** de datos;
- **confidencialidad**;
- **revocación** del consentimiento otorgado.

Como Futbolityx no recopila datos personales en servidores propios, en la práctica
la mayoría de estos derechos se ejercen directamente sobre el navegador (borrando
los datos locales) o sobre los terceros intervinientes.

Para presentar una solicitud, escribí a **futbolityx@gmail.com** con asunto
“Privacidad”, indicando qué derecho querés ejercer y los datos necesarios para
identificarte. Se responderá en un plazo razonable.

En Argentina, la autoridad de control es la **Agencia de Acceso a la Información
Pública (AAIP)**, ante la cual puede presentarse un reclamo cuando corresponda.

## 12. Menores de edad

La Plataforma no está dirigida a menores de edad y no recopila datos de menores de
forma consciente.

Si un menor utiliza la Plataforma, debe hacerlo con autorización de su representante
legal y nunca para fines de apuestas. Si creés que un menor nos envió datos
personales por correo, escribí al contacto para solicitar su eliminación.

## 13. Cambios en esta Política

Esta Política puede actualizarse para reflejar cambios técnicos, operativos o
normativos.

La versión vigente se publica en la Plataforma con su fecha de actualización. Los
cambios sustanciales se avisarán de forma razonable dentro del sitio.

## 14. Contacto

Consultas sobre privacidad o ejercicio de derechos:
**futbolityx@gmail.com** (asunto “Privacidad”).

## 15. Anexo: cómo borrar tus datos

**Desde la app:** botón **Borrar todo** (barra superior). Elimina equipos, partidos,
predicciones y configuraciones guardadas en este navegador.

**Desde el navegador:** Configuración → Privacidad y seguridad → Borrar datos de
navegación → Cookies y datos de sitios. También podés eliminar el sitio de la lista
de datos almacenados.

**Si instalaste la PWA:** desinstalala desde el navegador o el sistema. Eso quita el
acceso directo, pero conviene borrar además los datos del sitio.

**Copias exportadas:** los archivos JSON que hayas descargado quedan en tu
dispositivo. Borralos manualmente si ya no los necesitás.

## 16. Documentos relacionados

- [Términos y Condiciones de Uso](terminos-y-condiciones.md)
- [Política de Cookies](politica-de-cookies.md)
- [Descargo de Responsabilidad](descargo-de-responsabilidad.md)
- [Aviso Legal](aviso-legal.md)
- [Juego Responsable](juego-responsable.md)
- [Atribuciones y licencias de datos](../atribuciones.md)
