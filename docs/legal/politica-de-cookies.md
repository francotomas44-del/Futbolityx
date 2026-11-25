# Política de Cookies

**Futbolityx** · Versión 2.1 · Última actualización: 25 de noviembre de 2026

> Este documento explica qué cookies y tecnologías de almacenamiento usa
> Futbolityx y cómo gestionarlas. Forma parte del conjunto de documentos legales;
> ver el [índice](README.md).

## 1. Uso de cookies y tecnologías similares

Futbolityx usa **una cookie técnica de sesión** cuando el usuario inicia sesión con
su cuenta. No usa cookies de seguimiento, publicidad ni analítica.

Para funcionar, la aplicación también usa **tecnologías de almacenamiento del
navegador**:

- **localStorage** (almacenamiento local);
- **IndexedDB** (base de datos local);
- **Cache Storage** (caché del service worker);
- **service worker** (para funcionamiento offline).

Estas tecnologías permiten recordar preferencias, guardar el historial, mantener la
sesión y evitar descargas repetidas.

Al utilizar la Plataforma, el usuario acepta el uso de estas tecnologías conforme a
esta Política, salvo que las deshabilite o borre desde su navegador cuando ello sea
técnicamente posible.

## 2. ¿Qué son las cookies?

Las cookies son pequeños archivos de texto que un sitio web puede almacenar en el
dispositivo del usuario para recordar información relacionada con la navegación, las
preferencias o el funcionamiento del servicio.

Las cookies no ejecutan programas ni acceden por sí mismas al contenido del
dispositivo.

Las tecnologías similares incluyen el almacenamiento local del navegador, las bases
de datos locales, los identificadores de sesión y otros mecanismos técnicos
equivalentes.

## 3. Categorías utilizadas

### a) Tecnologías técnicas o esenciales

Son necesarias para el funcionamiento básico de la Plataforma y no pueden
deshabilitarse sin afectar el servicio. Se usan para:

- recordar preferencias básicas (modo simple/avanzado, país para horarios);
- guardar el historial de equipos, partidos y predicciones;
- registrar qué archivos de la base ya se importaron;
- mantener cachés de datos y noticias;
- permitir el funcionamiento sin conexión;
- conservar el estado de guardado;
- mantener la sesión de la cuenta.

### b) Cookie de sesión

- **Nombre:** `futbolityx_session` (configurable por entorno).
- **Tipo:** cookie técnica, `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- **Finalidad:** mantener la sesión iniciada después de autenticarse con Firebase
  (Google o email/contraseña) y permitir el acceso a la cuenta, el panel y el
  checkout.
- **Duración:** 30 días por defecto, o hasta cerrar sesión.

La cookie contiene un identificador de sesión. El servidor guarda su hash, no el
valor en texto plano. La cookie **no** se usa para publicidad, analítica ni
perfilado.

### c) Tecnologías analíticas o de rendimiento

Futbolityx **no utiliza** herramientas analíticas, píxeles, ni recopilación de
estadísticas de uso.

### d) Tecnologías publicitarias

Futbolityx **no utiliza** cookies publicitarias, de retargeting ni de perfilado.

## 4. Servicios tecnológicos de terceros

La Plataforma se apoya en:

- **Vercel** para el alojamiento del sitio y las funciones del backend;
- un servicio **PostgreSQL gestionado** para cuentas, sesiones y suscripciones;
- **Google/Firebase Auth** para la autenticación con Google y email/contraseña y
  el almacenamiento local de la sesión de Firebase en el dispositivo;
- **Resend** para el envío de emails transaccionales y, en cuentas heredadas, de
  magic links;
- **Mercado Pago** (ARS) y **Paddle** (USD) para los pagos y las suscripciones;
- una **fuente pública de datos deportivos y de noticias** (ESPN) para las funciones
  en vivo;
- **GitHub Pages** para el espejo estático y los datos históricos;
- **Google News**, solo cuando el usuario hace clic en un enlace de búsqueda.

Esos terceros pueden emplear sus propios mecanismos técnicos conforme a sus
respectivas políticas de privacidad y cookies. Futbolityx no controla ni configura
esas tecnologías.

Los proveedores de pago pueden usar cookies o tecnologías propias durante el
checkout. Esas cookies se rigen por la política del proveedor y no por esta
Política.

## 5. Duración

Las tecnologías utilizadas pueden ser:

- **de sesión:** se eliminan al cerrar el navegador (por ejemplo, ciertos estados en
  memoria) o al cerrar sesión;
- **persistentes:** permanecen hasta que el usuario las borra o hasta que el
  navegador las descarta por falta de espacio o por políticas propias.

La cookie de sesión dura 30 días por defecto. La duración concreta del
almacenamiento local depende de la finalidad técnica y de la configuración del
navegador.

## 6. Gestión y eliminación

El usuario puede:

- **cerrar sesión** desde el panel de cuenta;
- **borrar los datos desde la app:** botón **Borrar todo**;
- **borrar los datos del sitio desde el navegador:** Configuración → Privacidad y
  seguridad → Borrar datos de navegación → Cookies y datos de sitios;
- **bloquear el almacenamiento local** o usar el modo privado;
- **desinstalar la PWA** y, además, borrar los datos del sitio;
- **borrar las copias exportadas** (archivos JSON) manualmente.

## 7. Consecuencias de desactivar el almacenamiento o las cookies

Si se bloquea o se borra el almacenamiento local:

- la app puede volver a pedir la carga inicial de la base;
- se pierden predicciones, equipos, partidos y configuraciones guardadas;
- las cachés de datos y noticias se descargan de nuevo;
- el funcionamiento sin conexión puede dejar de estar disponible.

Si se bloquea la cookie de sesión:

- no se puede mantener la sesión iniciada;
- el panel de cuenta y el checkout pueden dejar de funcionar;
- el resto de la app sigue funcionando sin cuenta.

Futbolityx no puede recuperar datos locales que el usuario haya borrado. Los datos
de cuenta y suscripción se conservan en el backend conforme a la
[Política de Privacidad](politica-de-privacidad.md) y a los plazos legales.

## 8. Modificaciones de la Política

Esta Política puede actualizarse para reflejar cambios técnicos, operativos o
normativos.

La versión vigente se publica en la Plataforma con su fecha de actualización. Los
cambios sustanciales se avisarán de forma razonable dentro del sitio o por email a
las cuentas registradas.

## 9. Contacto

Consultas sobre esta Política: **futbolityx@gmail.com** (asunto “Cookies”).

## 10. Documentos relacionados

- [Términos y Condiciones de Uso](terminos-y-condiciones.md)
- [Pagos, Suscripciones y Reembolsos](pagos-suscripciones-reembolsos.md)
- [Política de Privacidad](politica-de-privacidad.md)
- [Descargo de Responsabilidad](descargo-de-responsabilidad.md)
- [Aviso Legal](aviso-legal.md)
