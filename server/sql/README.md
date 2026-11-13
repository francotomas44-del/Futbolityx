# Esquema de base de datos (borrador)

`001_init.sql` es un borrador para PostgreSQL 14+ (sirve para Postgres propio,
Neon, Railway, Render o Supabase). **Todavía no está conectado al servidor.**

## Tablas

- `users`: cuenta, email verificado y nombre visible.
- `sessions`: sesiones activas. Se guarda el **hash** del token, nunca el token.
- `subscriptions`: plan, estado, período y referencia al proveedor de pago.
- `payment_events`: eventos de webhooks con idempotencia por
  `(provider, provider_event_id)`.
- `usage_events`: uso por usuario para límites diarios y auditoría.

## Reglas

1. El plan activo se resuelve en el servidor; nunca se confía en el cliente.
2. Un webhook se procesa una sola vez y se reconcilia con el proveedor.
3. `cancel_at_period_end = true` mantiene el acceso hasta `current_period_end`.
4. Los tokens de sesión se guardan hasheados (SHA-256 o HMAC con pepper).
5. Los datos personales requieren actualizar la política de privacidad antes de
   recolectarse.

## Próximo paso

Elegir proveedor de base de datos, agregar el driver (`pg`), un runner de
migraciones y las rutas de auth. Después, conectar el webhook de pagos.
