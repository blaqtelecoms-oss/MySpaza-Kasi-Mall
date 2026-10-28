// Application data + auth layer backed by Supabase.
//
// Entity names used by the screens ("Product", "Sale", …) map to snake_case
// Postgres tables, and each entity keeps the small method surface the app
// already calls: list, filter, get, create, update, delete and the bulk forms.
// Reads/writes go through PostgREST with the signed-in user's session, so row
// level security decides what each user can see.
import { supabase } from "@/api/supabase";
import { installOfflineLayer } from "@/lib/offlineLayer";

/** Entity name → Postgres table. */
const TABLES = {
  BankAccount: "bank_account",
  BulkBuy: "bulk_buy",
  CashUp: "cash_up",
  Customer: "customer",
  EmailEvent: "email_event",
  Expense: "expense",
  Product: "product",
  PurchaseOrder: "purchase_order",
  Sale: "sale",
  SavingsGroup: "savings_group",
  StockAdjustment: "stock_adjustment",
  StockfellAccount: "stockfell_account",
  Supplier: "supplier",
  Wholesaler: "wholesaler",
  WholesalerDiscount: "wholesaler_discount",
};

// The media fields the app writes point at this public bucket.
const MEDIA_BUCKET = "inventory-media";
const DEFAULT_LIMIT = 1000;

const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed/i;

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function unwrap({ data, error }) {
  if (error) {
    const message = error.message || "Request failed";
    // Preserve "network is unreachable" as a TypeError so the offline layer
    // still recognises it and falls back to its cache.
    const err = NETWORK_ERROR.test(message) ? new TypeError(message) : new Error(message);
    err.code = error.code;
    err.status = error.code === "PGRST301" ? 401 : undefined;
    throw err;
  }
  return data;
}

/** "-field" sorts newest-first (the app's convention), "field" ascending. */
function readSort(sort) {
  const raw = (typeof sort === "string" && sort.trim()) || "-created_date";
  const descending = raw.startsWith("-");
  return { column: descending ? raw.slice(1) : raw, ascending: !descending };
}

function applyFilters(query, criteria) {
  if (!criteria || typeof criteria !== "object") return query;
  let next = query;
  for (const [column, value] of Object.entries(criteria)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(value.$in)) next = next.in(column, value.$in);
      if (Array.isArray(value.$nin)) next = next.not(column, "in", `(${value.$nin.join(",")})`);
      if ("$ne" in value) next = next.neq(column, value.$ne);
      if ("$gt" in value) next = next.gt(column, value.$gt);
      if ("$gte" in value) next = next.gte(column, value.$gte);
      if ("$lt" in value) next = next.lt(column, value.$lt);
      if ("$lte" in value) next = next.lte(column, value.$lte);
      if ("$like" in value) next = next.ilike(column, value.$like);
    } else if (value === null) {
      next = next.is(column, null);
    } else {
      next = next.eq(column, value);
    }
  }
  return next;
}

/**
 * Some screens sort by a field the table does not have (e.g. a legacy
 * "outstanding_date"). Postgres rejects that, so fall back to newest-first
 * instead of failing the whole read.
 */
function isMissingColumn(error) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

async function ordered(build, criteria, sort, limit) {
  const attempt = (sortValue) => {
    const { column, ascending } = readSort(sortValue);
    return applyFilters(build(), criteria)
      .order(column, { ascending, nullsFirst: false })
      .limit(limit ?? DEFAULT_LIMIT);
  };

  const first = await attempt(sort);
  if (!isMissingColumn(first.error)) return unwrap(first);

  const fallback = await attempt("-created_date");
  if (!isMissingColumn(fallback.error)) return unwrap(fallback);

  return unwrap(applyFilters(build(), criteria).limit(limit ?? DEFAULT_LIMIT));
}

function table(entity) {
  const name = TABLES[entity];
  if (!name) throw new Error(`Unknown entity: ${entity}`);
  return name;
}

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function stamp(record) {
  const now = new Date().toISOString();
  const userId = await currentUserId();
  return {
    ...record,
    created_date: record.created_date || now,
    updated_date: now,
    // Ownership always comes from the session, never from the payload: row
    // level security only accepts rows owned by the signed-in user.
    created_by_id: userId || record.created_by_id,
  };
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
}

function makeEntity(entity) {
  const name = table(entity);

  return {
    table: name,

    list(sort, limit) {
      return ordered(() => supabase.from(name).select("*"), null, sort, limit);
    },

    filter(criteria, sort, limit) {
      return ordered(() => supabase.from(name).select("*"), criteria, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(name)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (isMissingColumn(error)) throw new Error(error.message);
      if (error) return unwrap({ data, error });
      return data ?? null;
    },

    async create(payload = {}) {
      const record = stripUndefined({
        ...payload,
        id: payload.id || newId(),
      });
      const row = await stamp(record);
      return unwrap(await supabase.from(name).insert(row).select().single());
    },

    async update(id, payload = {}) {
      const { id: _ignored, created_date: _created, ...changes } = payload;
      const row = { ...stripUndefined(changes), updated_date: new Date().toISOString() };
      return unwrap(
        await supabase.from(name).update(row).eq("id", id).select().single()
      );
    },

    async delete(id) {
      unwrap(await supabase.from(name).delete().eq("id", id));
      return { id };
    },

    async bulkCreate(payloads = []) {
      if (payloads.length === 0) return [];
      const userId = await currentUserId();
      const now = new Date().toISOString();
      const rows = payloads.map((payload) =>
        stripUndefined({
          ...payload,
          id: payload.id || newId(),
          created_date: payload.created_date || now,
          updated_date: now,
          created_by_id: userId || payload.created_by_id,
        })
      );
      return unwrap(await supabase.from(name).insert(rows).select());
    },

    async bulkUpdate(entries = []) {
      const updated = [];
      for (const entry of entries) {
        const { id, ...changes } = entry;
        if (!id) continue;
        updated.push(
          unwrap(
            await supabase
              .from(name)
              .update({ ...stripUndefined(changes), updated_date: new Date().toISOString() })
              .eq("id", id)
              .select()
              .single()
          )
        );
      }
      return updated;
    },

    async updateMany(criteria, changes = {}) {
      const patch = { ...(changes.$set || changes), updated_date: new Date().toISOString() };
      const query = applyFilters(supabase.from(name).update(patch), criteria);
      unwrap(await query);
      return { ok: true };
    },

    async deleteMany(criteria) {
      const query = applyFilters(supabase.from(name).delete(), criteria);
      unwrap(await query);
      return { ok: true };
    },
  };
}

const entityCache = new Map();

const entities = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (!TABLES[prop]) return undefined;
      if (!entityCache.has(prop)) entityCache.set(prop, makeEntity(prop));
      return entityCache.get(prop);
    },
    has(_target, prop) {
      return typeof prop === "string" && prop in TABLES;
    },
  }
);

/** `public.profiles` mirrors each auth user (name + role). */
async function ensureProfile(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error || data) return data;

  const row = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || null,
    role: "user",
  };
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert(row)
    .select()
    .maybeSingle();
  if (!insertError) return created;

  // Two screens can ask for the profile at the same time; the loser of that
  // race sees a duplicate-key error, so read the row that now exists.
  if (insertError.code === "23505") {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) return existing;
  }
  return row;
}

function authRedirect(path) {
  return `${window.location.origin}${path}`;
}

const auth = {
  async me() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      const err = new Error("Not authenticated");
      err.status = 401;
      throw err;
    }
    const profile = await ensureProfile(session.user);
    return {
      ...profile,
      id: session.user.id,
      email: session.user.email,
      full_name:
        profile?.full_name || session.user.user_metadata?.full_name || session.user.email,
      role: profile?.role || "user",
    };
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    await ensureProfile(data.user);
    return data.user;
  },

  async register({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (error) throw new Error(error.message);
    if (data.session) await ensureProfile(data.user);
    return data;
  },

  async verifyOtp({ email, otpCode, type = "signup" }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type,
    });
    if (error) throw new Error(error.message);
    await ensureProfile(data.user);
    return data;
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirect("/reset-password"),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  loginWithProvider(provider, returnTo = "/") {
    supabase.auth
      .signInWithOAuth({
        provider,
        options: { redirectTo: authRedirect(returnTo) },
      })
      .catch(() => {
        /* surfaced on the login screen by the browser redirect failing */
      });
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) window.location.href = "/login";
  },

  redirectToLogin() {
    window.location.href = "/login";
  },

  async getSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },
};

/** Optional AI coach backed by a Supabase Edge Function (`coach`). */
async function invokeCoachFunction(prompt) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ||
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          "",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ prompt }),
    }
  );
  if (!response.ok) throw new Error(`Coach is unavailable (${response.status})`);
  const body = await response.json().catch(() => ({}));
  return body.text || body.content || "";
}

const integrations = {
  Core: {
    async UploadPublicFile({ file }) {
      const extension = (file.name?.split(".").pop() || "bin").toLowerCase();
      const path = `${newId()}.${extension}`;
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      return { file_url: data.publicUrl };
    },

    async InvokeLLM({ prompt }) {
      return invokeCoachFunction(prompt);
    },
  },
};

export const api = { entities, auth, integrations };

// Transparent offline caching + write queueing over the entity layer.
installOfflineLayer(api);

export default api;
