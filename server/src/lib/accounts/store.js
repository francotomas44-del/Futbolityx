import crypto from "node:crypto";
import pg from "pg";

var Pool = pg.Pool;

function asDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function planRank(plan) {
  if (plan === "elite") return 3;
  if (plan === "pro") return 2;
  return 1;
}

function subscriptionAccessRank(item, now) {
  var status = item.status;
  var end = item.current_period_end ? asDate(item.current_period_end) : null;
  var withinPeriod = end ? end > now : status !== "canceled";

  if (withinPeriod && (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "canceled"
  )) {
    return 0;
  }

  return 1;
}

/**
 * Store en memoria para desarrollo y tests. No usar en produccion: se pierde
 * todo al reiniciar y no se comparte entre instancias de Vercel.
 */
export class MemoryStore {
  constructor() {
    this.users = [];
    this.loginTokens = [];
    this.sessions = [];
    this.subscriptions = [];
    this.paymentEvents = [];
    this.usage = [];
  }

  async findOrCreateUser(email) {
    var normalized = String(email || "").trim().toLowerCase();
    var user = this.users.find(function (item) {
      return item.email.toLowerCase() === normalized;
    });

    if (!user) {
      var now = new Date();
      user = {
        id: crypto.randomUUID(),
        email: normalized,
        email_verified_at: null,
        display_name: null,
        created_at: now,
        updated_at: now
      };
      this.users.push(user);
    }

    return clone(user);
  }

  async findUserByEmail(email) {
    var normalized = String(email || "").trim().toLowerCase();
    return clone(this.users.find(function (item) {
      return item.email.toLowerCase() === normalized;
    }) || null);
  }

  async findUserById(id) {
    return clone(this.users.find(function (item) { return item.id === id; }) || null);
  }

  async markEmailVerified(userId) {
    var user = this.users.find(function (item) { return item.id === userId; });
    if (!user) return null;
    user.email_verified_at = new Date();
    user.updated_at = new Date();
    return clone(user);
  }

  async setDisplayName(userId, displayName) {
    var user = this.users.find(function (item) { return item.id === userId; });
    if (!user) return null;
    user.display_name = displayName || null;
    user.updated_at = new Date();
    return clone(user);
  }

  async createLoginToken(userId, tokenHash, expiresAt) {
    var row = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: asDate(expiresAt),
      used_at: null,
      created_at: new Date()
    };
    this.loginTokens.push(row);
    return clone(row);
  }

  async consumeLoginToken(tokenHash) {
    var now = new Date();
    var row = this.loginTokens.find(function (item) {
      return item.token_hash === tokenHash && !item.used_at && item.expires_at > now;
    });

    if (!row) return null;
    row.used_at = now;
    return row.user_id;
  }

  async createSession(userId, tokenHash, expiresAt, ip, userAgent) {
    var row = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: asDate(expiresAt),
      ip: ip || null,
      user_agent: userAgent || null,
      created_at: new Date()
    };
    this.sessions.push(row);
    return clone(row);
  }

  async findSession(tokenHash) {
    var now = new Date();
    var session = this.sessions.find(function (item) {
      return item.token_hash === tokenHash && item.expires_at > now;
    });

    if (!session) return null;

    var user = this.users.find(function (item) { return item.id === session.user_id; });
    if (!user) return null;

    return { session: clone(session), user: clone(user) };
  }

  async deleteSession(tokenHash) {
    this.sessions = this.sessions.filter(function (item) {
      return item.token_hash !== tokenHash;
    });
  }

  async findSubscriptionByProviderId(provider, providerSubscriptionId) {
    return clone(this.subscriptions.find(function (item) {
      return item.provider === provider &&
        item.provider_subscription_id === providerSubscriptionId;
    }) || null);
  }

  // Elige la suscripcion con mejor acceso: primero las vigentes, luego el
  // plan de mayor jerarquia y, por ultimo, la de vencimiento mas lejano.
  async findLatestSubscription(userId) {
    var now = new Date();
    var rows = this.subscriptions.filter(function (item) {
      return item.user_id === userId;
    });

    rows.sort(function (a, b) {
      var accessDiff = subscriptionAccessRank(a, now) - subscriptionAccessRank(b, now);
      if (accessDiff) return accessDiff;

      var planDiff = planRank(b.plan) - planRank(a.plan);
      if (planDiff) return planDiff;

      var aTime = asDate(a.current_period_end || a.created_at).getTime();
      var bTime = asDate(b.current_period_end || b.created_at).getTime();
      return bTime - aTime;
    });

    return clone(rows[0] || null);
  }

  async upsertSubscription(data) {
    var existing = this.subscriptions.find(function (item) {
      return item.provider === data.provider &&
        item.provider_subscription_id === data.provider_subscription_id;
    });

    var now = new Date();

    if (existing) {
      Object.assign(existing, data, { updated_at: now });
      return clone(existing);
    }

    var row = Object.assign({
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      cancel_at_period_end: false
    }, data);

    this.subscriptions.push(row);
    return clone(row);
  }

  async recordPaymentEvent(provider, providerEventId, eventType, payload) {
    var exists = this.paymentEvents.find(function (item) {
      return item.provider === provider && item.provider_event_id === providerEventId;
    });

    if (exists) {
      return { id: exists.id, duplicate: true, processed: !!exists.processed_at };
    }

    var row = {
      id: crypto.randomUUID(),
      provider: provider,
      provider_event_id: providerEventId,
      event_type: eventType,
      payload: payload,
      processed_at: null,
      created_at: new Date()
    };

    this.paymentEvents.push(row);
    return { id: row.id, duplicate: false, processed: false };
  }

  async markPaymentEventProcessed(id) {
    var row = this.paymentEvents.find(function (item) { return item.id === id; });
    if (row) row.processed_at = new Date();
  }

  async countUsage(userId, kind, since) {
    var from = asDate(since);
    return this.usage.filter(function (item) {
      return item.user_id === userId && item.kind === kind && asDate(item.created_at) >= from;
    }).length;
  }

  async recordUsage(userId, kind) {
    this.usage.push({
      id: this.usage.length + 1,
      user_id: userId,
      kind: kind,
      created_at: new Date()
    });
  }

  async close() {}
}

export class PostgresStore {
  constructor(connectionString) {
    var needsSsl = /sslmode=require|neon\.tech|supabase\.co|vercel-storage\.com|render\.com/.test(connectionString);
    this.pool = new Pool({
      connectionString: connectionString,
      max: Number(process.env.PG_POOL_MAX) || 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      ssl: needsSsl ? { rejectUnauthorized: false } : false
    });
  }

  async findOrCreateUser(email) {
    var normalized = String(email || "").trim().toLowerCase();
    var inserted = await this.pool.query(
      "insert into users (email) values ($1) on conflict do nothing returning *",
      [normalized]
    );

    if (inserted.rows[0]) return inserted.rows[0];

    var found = await this.pool.query(
      "select * from users where lower(email) = lower($1) limit 1",
      [normalized]
    );

    return found.rows[0] || null;
  }

  async findUserByEmail(email) {
    var result = await this.pool.query(
      "select * from users where lower(email) = lower($1) limit 1",
      [String(email || "").trim()]
    );
    return result.rows[0] || null;
  }

  async findUserById(id) {
    var result = await this.pool.query("select * from users where id = $1 limit 1", [id]);
    return result.rows[0] || null;
  }

  async markEmailVerified(userId) {
    var result = await this.pool.query(
      "update users set email_verified_at = now(), updated_at = now() where id = $1 returning *",
      [userId]
    );
    return result.rows[0] || null;
  }

  async setDisplayName(userId, displayName) {
    var result = await this.pool.query(
      "update users set display_name = $2, updated_at = now() where id = $1 returning *",
      [userId, displayName || null]
    );
    return result.rows[0] || null;
  }

  async createLoginToken(userId, tokenHash, expiresAt) {
    var result = await this.pool.query(
      "insert into login_tokens (user_id, token_hash, expires_at) values ($1, $2, $3) returning *",
      [userId, tokenHash, expiresAt]
    );
    return result.rows[0];
  }

  async consumeLoginToken(tokenHash) {
    var result = await this.pool.query(
      "update login_tokens set used_at = now() " +
      "where token_hash = $1 and used_at is null and expires_at > now() returning user_id",
      [tokenHash]
    );
    return result.rows[0] ? result.rows[0].user_id : null;
  }

  async createSession(userId, tokenHash, expiresAt, ip, userAgent) {
    var result = await this.pool.query(
      "insert into sessions (user_id, token_hash, expires_at, ip, user_agent) " +
      "values ($1, $2, $3, $4, $5) returning *",
      [userId, tokenHash, expiresAt, ip || null, userAgent || null]
    );
    return result.rows[0];
  }

  async findSession(tokenHash) {
    var sessionResult = await this.pool.query(
      "select * from sessions where token_hash = $1 and expires_at > now() limit 1",
      [tokenHash]
    );

    if (!sessionResult.rows[0]) return null;

    var userResult = await this.pool.query(
      "select * from users where id = $1 limit 1",
      [sessionResult.rows[0].user_id]
    );

    if (!userResult.rows[0]) return null;

    return { session: sessionResult.rows[0], user: userResult.rows[0] };
  }

  async deleteSession(tokenHash) {
    await this.pool.query("delete from sessions where token_hash = $1", [tokenHash]);
  }

  async findSubscriptionByProviderId(provider, providerSubscriptionId) {
    var result = await this.pool.query(
      "select * from subscriptions where provider = $1 and provider_subscription_id = $2 limit 1",
      [provider, providerSubscriptionId]
    );
    return result.rows[0] || null;
  }

  // Mismo criterio que MemoryStore: vigentes primero, luego mayor plan y
  // vencimiento mas lejano.
  async findLatestSubscription(userId) {
    var result = await this.pool.query(
      "select * from subscriptions where user_id = $1 " +
      "order by " +
      "case when status in ('active', 'trialing', 'past_due', 'canceled') " +
      "and (current_period_end > now() or (current_period_end is null and status <> 'canceled')) " +
      "then 0 else 1 end asc, " +
      "case plan when 'elite' then 3 when 'pro' then 2 else 1 end desc, " +
      "coalesce(current_period_end, created_at) desc, created_at desc limit 1",
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsertSubscription(data) {
    var result = await this.pool.query(
      "insert into subscriptions (user_id, plan, status, provider, provider_subscription_id, " +
      "provider_customer_id, current_period_start, current_period_end, cancel_at_period_end) " +
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9) " +
      "on conflict (provider, provider_subscription_id) do update set " +
      "plan = excluded.plan, status = excluded.status, " +
      "provider_customer_id = excluded.provider_customer_id, " +
      "current_period_start = excluded.current_period_start, " +
      "current_period_end = excluded.current_period_end, " +
      "cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now() " +
      "returning *",
      [
        data.user_id,
        data.plan,
        data.status,
        data.provider,
        data.provider_subscription_id || null,
        data.provider_customer_id || null,
        data.current_period_start || null,
        data.current_period_end || null,
        !!data.cancel_at_period_end
      ]
    );
    return result.rows[0];
  }

  async recordPaymentEvent(provider, providerEventId, eventType, payload) {
    var result = await this.pool.query(
      "insert into payment_events (provider, provider_event_id, event_type, payload) " +
      "values ($1, $2, $3, $4::jsonb) " +
      "on conflict (provider, provider_event_id) do nothing returning id",
      [provider, providerEventId, eventType, JSON.stringify(payload)]
    );

    if (result.rows[0]) {
      return { id: result.rows[0].id, duplicate: false, processed: false };
    }

    var existing = await this.pool.query(
      "select id, processed_at from payment_events where provider = $1 and provider_event_id = $2 limit 1",
      [provider, providerEventId]
    );

    return {
      id: existing.rows[0] ? existing.rows[0].id : null,
      duplicate: true,
      processed: !!(existing.rows[0] && existing.rows[0].processed_at)
    };
  }

  async markPaymentEventProcessed(id) {
    await this.pool.query(
      "update payment_events set processed_at = now() where id = $1",
      [id]
    );
  }

  async countUsage(userId, kind, since) {
    var result = await this.pool.query(
      "select count(*)::int as count from usage_events " +
      "where user_id = $1 and kind = $2 and created_at >= $3",
      [userId, kind, since]
    );
    return result.rows[0] ? result.rows[0].count : 0;
  }

  async recordUsage(userId, kind) {
    await this.pool.query(
      "insert into usage_events (user_id, kind) values ($1, $2)",
      [userId, kind]
    );
  }

  async close() {
    await this.pool.end();
  }
}

var store = null;

export function getStore() {
  if (store) return store;

  var databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    store = new PostgresStore(databaseUrl);
    return store;
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new Error("DATABASE_URL es obligatoria en produccion.");
  }

  store = new MemoryStore();
  return store;
}

export function setStore(value) {
  store = value;
}
