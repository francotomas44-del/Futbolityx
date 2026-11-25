# Prueba cerrada de Futbolityx

Guía para abrir una ronda limitada de testers antes del lanzamiento de cobros.
La app pública sigue funcionando: el análisis local, los datos históricos y
"Hoy" no dependen de cuentas. La beta solo limita el acceso a **cuentas**.

## Qué se activó

- `BETA_MODE=closed` limita `/v1/auth/firebase` y las sesiones a los emails de
  `BETA_ALLOWED_EMAILS`. El email se toma del ID token ya verificado de Firebase,
  nunca del navegador. Un email fuera de la lista recibe
  `403 beta_invite_required`. El endpoint legacy de magic link mantiene la misma
  restricción.
- `BETA_TEST_PLAN` da ese plan (por defecto `pro`, opcional `elite`) a los
  invitados sin suscripción ni cobro. Si el tester tiene una suscripción paga
  real, esa tiene prioridad.
- `BETA_DISABLE_CHECKOUT=true` (por defecto) deshabilita
  `/v1/billing/checkout` con `403 beta_checkout_disabled` y muestra
  `billing: "not_available"` en `/v1/plans`.
- `/v1/plans` devuelve `beta` y `/v1/account` devuelve `beta.invited`, para que
  la interfaz muestre el cartel de "Prueba cerrada" y "Plan de prueba".
- Si se saca un email de `BETA_ALLOWED_EMAILS`, su sesión deja de ser válida en
  el próximo request. No se borran sus datos.

## Configuración mínima

En Vercel (Preview recomendado; Production si querés la misma restricción):

```env
NODE_ENV=production
APP_URL=https://tu-proyecto.vercel.app
API_PUBLIC_URL=https://tu-proyecto.vercel.app
CORS_ORIGINS=https://tu-proyecto.vercel.app,https://francotomas44-del.github.io
DATABASE_URL=postgresql://...
FIREBASE_PROJECT_ID=tu-proyecto-firebase
RESEND_API_KEY=re_...
EMAIL_FROM=Futbolityx <no-reply@tudominio.com>
AUTH_DEV_MODE=false

PRICING_STATUS=proposed
BETA_MODE=closed
BETA_ALLOWED_EMAILS=tester1@email.com,tester2@email.com
BETA_TEST_PLAN=pro
BETA_DISABLE_CHECKOUT=true
BETA_LABEL=Prueba cerrada
```

Además, completá `js/firebase-config.js` con el config web de Firebase (es
público) y habilitá **Google** y **Email/Contraseña** en Firebase Console →
Authentication → Sign-in method. El `projectId` de ese archivo debe coincidir con
`FIREBASE_PROJECT_ID` del backend. Las cuentas creadas con email deben verificar
el correo antes de poder iniciar sesión.

Si `BETA_ALLOWED_EMAILS` está vacío con `BETA_MODE=closed`, nadie puede entrar.
Eso es deliberado: cargá la lista antes de invitar.

Para probar checkout con Paddle sandbox, usar `BETA_DISABLE_CHECKOUT=false`,
`BETA_TEST_PLAN=free`, `PADDLE_ENVIRONMENT=sandbox` y price IDs de sandbox. Para
Mercado Pago usar credenciales y planes de prueba (`TEST-...`).

## Paso a paso

1. Crear la base PostgreSQL y ejecutar `server/sql/001_init.sql`.
2. Crear el proyecto Firebase, habilitar Google y Email/Contraseña y completar
   `js/firebase-config.js` + `FIREBASE_PROJECT_ID`.
3. Verificar Resend y el dominio de `EMAIL_FROM` (para avisos transaccionales).
4. Cargar las variables de arriba y redeployar.
5. Probar con un email invitado:
   - Abrir la app → **Ingresar** → **Continuar con Google** o email/contraseña.
   - El ID token se canjea en `/api/auth/firebase` y se crea la cookie de sesión.
   - **Mi cuenta** debe mostrar `Pro · plan de prueba` (o `Elite`), uso
     ilimitado y cartel de prueba cerrada.
   - Probar **Hoy**, análisis, evaluación, rendimiento, informe, backtest y
     exportación. Deben estar habilitados según el plan.
6. Probar con un email no invitado: debe aparecer el aviso de acceso limitado y
   no debe crearse usuario.
7. Revisar `/api/plans`: `beta.enabled=true`, `beta.checkoutDisabled=true`,
   `billing="not_available"`.
8. Pedir feedback por email a `futbolityx@gmail.com` con:
   - qué pantalla usaba,
   - qué esperaba ver,
   - qué pasó,
   - navegador/dispositivo,
   - captura si aplica.

## Checklist de QA antes de invitar

- [ ] `cd server; npm test` pasa (incluye los tests de beta).
- [ ] `GET /api/health` responde `ok: true`.
- [ ] `GET /api/plans` expone `beta` con los valores esperados.
- [ ] Login de Firebase con email invitado crea cookie `HttpOnly`, `Secure`,
      `SameSite=Lax` en `/api/auth/firebase`.
- [ ] Login con email no invitado devuelve `beta_invite_required`.
- [ ] El ID token con `email_verified=false` devuelve `firebase_email_unverified`.
- [ ] Cuenta invitada muestra plan de prueba y entitlements correctos.
- [ ] Límite diario del plan Free no se aplica al plan de prueba.
- [ ] Checkout devuelve `beta_checkout_disabled`.
- [ ] "Hoy" muestra partidos reales y agrupa los sin horario aparte.
- [ ] El filtro de competiciones incluye CONMEBOL Sudamericana y su final en vivo.
- [ ] Backtest de smoke: Sudamericana, 73 partidos evaluados sin errores.
- [ ] 0 errores en consola del navegador en los 10 flux principales.
- [ ] Los documentos legales v2.1 se abren desde el pie y desde la cuenta.
- [ ] La app sin backend (GitHub Pages) sigue funcionando para usuarios no invitados.

## Salir de la beta

Cuando se aprueben precios y proveedores:

1. Quitar `BETA_MODE` o poner `BETA_MODE=off`.
2. Confirmar que los testers invitados vuelven a Free (o a su suscripción real).
3. Dejar `PRICING_STATUS=approved` y cargar credenciales live.
4. Seguir la checklist de ["Pasar a producción"](deploy-vercel.md#8-pasar-a-producción).

Para volver atrás, reaplicar las variables de beta y redeployar. No borrar
`users`, `sessions`, `subscriptions` ni `payment_events`.

Preparado el 24 de noviembre de 2026; actualizado para Firebase Auth el
25 de noviembre de 2026.
