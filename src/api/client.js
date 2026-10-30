// Application data + auth layer backed by Supabase.
//
// Entity names used by the screens ("Product", "Sale", …) map to snake_case
// Postgres tables, and each entity keeps the small method surface the app
// already calls: list, filter, get, create, update, delete and the bulk forms.
// Reads/writes go through PostgREST with the signed-in user's session, so row
// level security decides what each user can see.
import { supabase } from "@/api/supabase";
import { installOfflineLayer } from "@/lib/offlineLayer";
import { planStatus, resolvePlan, shopLimit } from "@/lib/plans";

/** Entity name → Postgres table. */
const TABLES = {
  BankAccount: "bank_account",
  BulkBuy: "bulk_buy",
  CashUp: "cash_up",
  Customer: "customer",
  EmailEvent: "email_event",
  Expense: "expense",
  GroupInvite: "group_invite",
  Product: "product",
  PurchaseOrder: "purchase_order",
  Sale: "sale",
  SavingsGroup: "savings_group",
  ShopInvite: "shop_invite",
  ShopMember: "shop_member",
  ShopSettings: "shop_settings",
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

// Tables whose rows belong to one shop. `created_by_id` is the shop id, so a
// read is always narrowed to the branch the account is working in — the owner
// may run several, and the database then lets them see all of them.
const SHOP_SCOPED = new Set([
  "bank_account", "bulk_buy", "cash_up", "customer", "expense", "product",
  "purchase_order", "sale", "savings_group", "shop_settings", "stock_adjustment",
  "stockfell_account", "supplier", "wholesaler", "wholesaler_discount",
]);

// A shop is the owner's account (or one of its branches): rows an employee
// writes belong to the shop they work in, not to the employee's own account.
// Cached per signed-in user so every write does not re-read the membership.
let shopIdCache = { userId: null, shopId: null };

const ACTIVE_SHOP_KEY = (userId) => `myspaza:active-shop:${userId}`;

function readActiveShop(userId) {
  try {
    return window.localStorage.getItem(ACTIVE_SHOP_KEY(userId));
  } catch {
    return null;
  }
}

function writeActiveShop(userId, shopId) {
  try {
    if (shopId) window.localStorage.setItem(ACTIVE_SHOP_KEY(userId), shopId);
    else window.localStorage.removeItem(ACTIVE_SHOP_KEY(userId));
  } catch {
    /* private mode or storage disabled: the in-memory cache still works */
  }
}

/** The shop whose data the signed-in user works in (a branch, or employer's). */
async function currentShopId() {
  const userId = await currentUserId();
  if (!userId) return null;
  if (shopIdCache.userId === userId) return shopIdCache.shopId;

  const { data } = await supabase
    .from("shop_member")
    .select("shop_id, status")
    .eq("member_id", userId)
    .maybeSingle();

  let shopId = data?.status === "active" ? data.shop_id : null;

  if (!shopId) {
    // An owner may run more than one shop; the branch they picked last wins.
    const stored = readActiveShop(userId);
    if (stored && stored !== userId) {
      const { data: branch } = await supabase
        .from("shop")
        .select("id, owner_id")
        .eq("id", stored)
        .maybeSingle();
      shopId = branch?.owner_id === userId ? branch.id : null;
    }
  }

  shopId = shopId || userId;
  shopIdCache = { userId, shopId };
  return shopId;
}

/** Forget the cached shop (after accepting an invitation, or signing out). */
export function resetShopCache() {
  shopIdCache = { userId: null, shopId: null };
}

async function stamp(record) {
  const now = new Date().toISOString();
  const shopId = await currentShopId();
  return {
    ...record,
    created_date: record.created_date || now,
    updated_date: now,
    // Ownership always comes from the session, never from the payload: row
    // level security only accepts rows owned by the signed-in user's shop.
    created_by_id: shopId || record.created_by_id,
  };
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
}

function makeEntity(entity) {
  const name = table(entity);
  const scoped = SHOP_SCOPED.has(name);

  // Reads and writes stay inside the branch the account is working in, even
  // though the owner's policies cover every branch they own.
  const shopCriteria = async () => {
    if (!scoped) return {};
    const shopId = await currentShopId();
    return shopId ? { created_by_id: shopId } : {};
  };

  return {
    table: name,

    async list(sort, limit) {
      return ordered(() => supabase.from(name).select("*"), await shopCriteria(), sort, limit);
    },

    async filter(criteria, sort, limit) {
      return ordered(
        () => supabase.from(name).select("*"),
        { ...(criteria || {}), ...(await shopCriteria()) },
        sort,
        limit
      );
    },

    async get(id) {
      const { data, error } = await supabase
        .from(name)
        .select("*")
        .eq("id", id)
        .match(await shopCriteria())
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
        await supabase.from(name).update(row).eq("id", id).match(await shopCriteria()).select().single()
      );
    },

    async delete(id) {
      unwrap(await supabase.from(name).delete().eq("id", id).match(await shopCriteria()));
      return { id };
    },

    async bulkCreate(payloads = []) {
      if (payloads.length === 0) return [];
      const shopId = await currentShopId();
      const now = new Date().toISOString();
      const rows = payloads.map((payload) =>
        stripUndefined({
          ...payload,
          id: payload.id || newId(),
          created_date: payload.created_date || now,
          updated_date: now,
          created_by_id: shopId || payload.created_by_id,
        })
      );
      return unwrap(await supabase.from(name).insert(rows).select());
    },

    async bulkUpdate(entries = []) {
      const updated = [];
      const scope = await shopCriteria();
      for (const entry of entries) {
        const { id, ...changes } = entry;
        if (!id) continue;
        updated.push(
          unwrap(
            await supabase
              .from(name)
              .update({ ...stripUndefined(changes), updated_date: new Date().toISOString() })
              .eq("id", id)
              .match(scope)
              .select()
              .single()
          )
        );
      }
      return updated;
    },

    async updateMany(criteria, changes = {}) {
      const patch = { ...(changes.$set || changes), updated_date: new Date().toISOString() };
      const query = applyFilters(supabase.from(name).update(patch), {
        ...(criteria || {}),
        ...(await shopCriteria()),
      });
      unwrap(await query);
      return { ok: true };
    },

    async deleteMany(criteria) {
      const query = applyFilters(supabase.from(name).delete(), {
        ...(criteria || {}),
        ...(await shopCriteria()),
      });
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
    /**
     * Upload a file to a public bucket and return its public URL.
     * `bucket` defaults to the product-media bucket; the shop logo passes
     * "shop-logos". Objects are stored under the signed-in user's folder,
     * which is what the storage policies scope writes to.
     */
    async UploadPublicFile({ file, bucket = MEDIA_BUCKET }) {
      const extension = (file.name?.split(".").pop() || "bin").toLowerCase();
      const userId = await currentUserId();
      if (!userId) throw new Error("You must be signed in to upload files.");
      const path = `${userId}/${newId()}.${extension}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { file_url: data.publicUrl };
    },

    async InvokeLLM({ prompt }) {
      return invokeCoachFunction(prompt);
    },
  },
};

/**
 * Shop membership: which shop the signed-in account works in, their role and
 * the modules they may use. Owners get every module; employees get exactly what
 * the owner granted (also enforced by row level security, not just this UI).
 */
const shop = {
  async context() {
    const userId = await currentUserId();
    if (!userId) return null;

    const { data: membership } = await supabase
      .from("shop_member")
      .select("*")
      .eq("member_id", userId)
      .maybeSingle();

    const active = membership?.status === "active" ? membership : null;

    // An owner runs a list of shops; the first visit creates the primary row
    // (named after the business details already saved).
    let shops = [];
    if (!active) {
      const { data, error } = await supabase.rpc("my_shops");
      if (!error && Array.isArray(data)) shops = data;
      if (!error && shops.length === 0) {
        const { data: created } = await supabase.rpc("ensure_shop");
        if (created) shops = [created];
      }
    }

    const shopId = active?.shop_id || (await currentShopId());
    const shopRow = shops.find((row) => row.id === shopId) || null;

    let shopName = shopRow?.name?.trim() || null;
    if (!shopName) {
      const { data: settings } = await supabase
        .from("shop_settings")
        .select("business")
        .eq("created_by_id", shopId)
        .maybeSingle();
      shopName = settings?.business?.name?.trim() || null;
    }

    if (!shopName) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", shopId)
        .maybeSingle();
      shopName = profile?.full_name || profile?.email || null;
    }

    // The plan belongs to the owner, so every branch resolves the same one.
    // `shop_billing` handles that lookup (and works for employees too).
    let billing = null;
    const { data: billingRow } = await supabase.rpc("shop_billing", { p_shop: shopId });
    billing = billingRow || null;

    if (!billing) {
      // An as-yet unmigrated project: fall back to the subscription row.
      const { data: subscription } = await supabase
        .from("shop_subscription")
        .select("plan,pending_plan,pending_plan_effective_at,current_period_end")
        .eq("shop_id", shopRow?.owner_id || shopId)
        .maybeSingle();
      billing = subscription
        ? {
            plan: resolvePlan(subscription),
            pending_plan: subscription.pending_plan,
            pending_plan_effective_at: subscription.pending_plan_effective_at,
            current_period_end: subscription.current_period_end,
          }
        : null;
    }

    const plan = billing?.plan || "free";
    // A shop may carry its own store allowance (operator-granted), which wins
    // over the plan's number — the same rule `public.shop_store_limit()` applies.
    const limit = billing?.max_shops ?? shopLimit(plan);

    return {
      shopId,
      shopName,
      shops: shops.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address || null,
        isPrimary: Boolean(row.is_primary),
      })),
      shopLimit: limit,
      canAddShop: !active && (limit === null || shops.length < limit),
      isOwner: !active,
      role: active?.role || "Owner",
      permissions: active?.permissions || {},
      memberId: active?.member_id || null,
      memberEmail: active?.member_email || null,
      plan,
      storedPlan: billing?.stored_plan || plan,
      pendingPlan: billing?.pending_plan || null,
      pendingPlanEffectiveAt: billing?.pending_plan_effective_at || null,
      periodStart: billing?.period_start || null,
      currentPeriodEnd: billing?.current_period_end || null,
      graceEndsAt: billing?.grace_ends_at || null,
      lastPaymentAt: billing?.last_payment_at || null,
      paymentStatus: billing?.payment_status || planStatus(billing),
    };
  },

  /** Owner: add a shop or branch, within the plan's limit (enforced in SQL). */
  async create({ name, address } = {}) {
    const { data, error } = await supabase.rpc("create_shop", {
      p_name: name,
      p_address: address || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Owner: rename a shop or branch. */
  async rename(shopId, name) {
    const { data, error } = await supabase.rpc("rename_shop", { p_id: shopId, p_name: name });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Work in another of the owner's shops. */
  async switchTo(shopId) {
    const userId = await currentUserId();
    if (!userId) throw new Error("Sign in to switch shops.");
    writeActiveShop(userId, shopId);
    shopIdCache = { userId, shopId };
    return shopId;
  },

  /**
   * Owner: schedule a move to Free. Paid plans are never switched on from the
   * browser — a Yoco payment has to be confirmed first (see `billing`). The
   * database decides the timing (public.set_shop_plan).
   */
  async setPlan(planKey) {
    const { data, error } = await supabase.rpc("set_shop_plan", { p_plan: planKey });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Ask the email service to create the invitation and send it with Resend. */
  async invite({ email, fullName, monthlySalary, role, permissions }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in to invite employees.");

    // The employee joins the branch the owner is working in.
    const shopId = await currentShopId();

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, fullName, monthlySalary, role, permissions, shopId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Invitation failed (${response.status})`);
    return body;
  },

  /** Shop, role and modules behind an invitation link (works signed out). */
  async invitePreview(token) {
    const { data, error } = await supabase.rpc("shop_invite_preview", { p_token: token });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Accept the invitation for the signed-in account. */
  async acceptInvite(token) {
    const { data, error } = await supabase.rpc("accept_shop_invite", { p_token: token });
    if (error) throw new Error(error.message);
    resetShopCache();
    return data;
  },

  /** Owner: change an employee's details, role or modules. */
  async updateMember(memberId, { role, permissions, full_name, monthly_salary }) {
    const { data, error } = await supabase
      .from("shop_member")
      .update({
        ...(full_name === undefined ? {} : { full_name }),
        ...(monthly_salary === undefined ? {} : { monthly_salary }),
        role,
        permissions,
        updated_date: new Date().toISOString(),
      })
      .eq("id", memberId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Owner: remove an employee's access. */
  async removeMember(memberId) {
    const { error } = await supabase.from("shop_member").delete().eq("id", memberId);
    if (error) throw new Error(error.message);
    return { id: memberId };
  },
};

/**
 * Paid subscriptions. The browser asks the API service for a Yoco hosted
 * checkout (the secret key stays on the server) and reads the payment row while
 * Yoco's signed webhook settles it. A plan is never activated from here.
 */
const billing = {
  /** Owner: open Yoco's hosted payment page for Premium or Ultra. */
  async startCheckout(planKey) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in to pay for a plan.");

    const shopId = await currentShopId();
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan: planKey, shopId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Payment could not start (${response.status})`);
    return body;
  },

  /** One payment attempt, polled after the owner returns from Yoco. */
  async payment(id) {
    if (!id) return null;
    const { data, error } = await supabase
      .from("subscription_payment")
      .select("id,plan,amount_cents,currency,status,paid_at,created_date,failure_reason")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },

  /**
   * Recent attempts for this shop owner. Row level security returns rows only
   * to the owner, so an employee simply sees an empty history.
   */
  async payments(limit = 6) {
    const { data, error } = await supabase
      .from("subscription_payment")
      .select("id,plan,amount_cents,currency,status,paid_at,created_date,failure_reason")
      .order("created_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },
};

/**
 * Community groups — the stokvel, savings groups and bulk buys on the MySpaza
 * Card. An invitation names one group in the branch the owner is working in;
 * the email service creates it and Resend delivers the link. Accepting is a
 * database function, so the invited address is checked before the member joins.
 */
const groups = {
  async invite({ email, groupKind, groupId }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sign in to invite people to your group.");

    const shopId = await currentShopId();
    const response = await fetch("/api/group-invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, groupKind, groupId, shopId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Invitation failed (${response.status})`);
    return body;
  },

  /** Group, shop and address behind an invitation link (works signed out). */
  async invitePreview(token) {
    const { data, error } = await supabase.rpc("group_invite_preview", { p_token: token });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Accept the invitation for the signed-in account. */
  async acceptInvite(token) {
    const { data, error } = await supabase.rpc("accept_group_invite", { p_token: token });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Owner: remove a group and its open invitations in one transaction, so no
   * invitation link keeps pointing at a deleted group.
   */
  async remove(groupKind, groupId) {
    const { data, error } = await supabase.rpc("delete_community_group", {
      p_kind: groupKind,
      p_id: groupId,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

/**
 * Operator-only tools (`profiles.role = 'admin'`): copy every shop's catalogue
 * into one account and grant a plan with a store allowance. The database
 * re-checks `public.is_admin()` inside each function, so hiding the screen is
 * convenience, not the access control.
 */
const admin = {
  /** Current plan, store allowance and catalogue counts for one account. */
  async summary(email) {
    const { data, error } = await supabase.rpc("admin_product_copy_summary", { p_email: email });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Copy every shop's products (images and prices included) into the account. */
  async copyProducts(email) {
    const { data, error } = await supabase.rpc("admin_copy_products", { p_email: email });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Grant Ultra with no expiry and a store allowance (3 by default). */
  async grantUltra(email, maxShops = 3) {
    const { data, error } = await supabase.rpc("admin_grant_ultra", {
      p_email: email,
      p_max_shops: maxShops,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

export const api = { entities, auth, integrations, shop, groups, billing, admin };

// Transparent offline caching + write queueing over the entity layer.
installOfflineLayer(api);

export default api;
