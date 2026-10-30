import { useState } from "react";
import { Copy, Crown, Package, RefreshCw, ShieldAlert, Store } from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const STORE_ALLOWANCE = 3;

const cleanEmail = (value) => value.trim().toLowerCase();

/**
 * Operator tool: hand one account the whole catalogue (every shop's products,
 * images and prices) and Ultra with no expiry, capped at three stores.
 *
 * Both actions are SECURITY DEFINER functions that re-check `is_admin()`, so a
 * non-operator reaching this URL gets the plain refusal from Postgres.
 */
export default function AdminProductCopy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const target = cleanEmail(email);

  const run = async (action, task) => {
    if (busy) return;
    setBusy(action);
    setNotice(null);
    try {
      const data = await task();
      await refresh();
      return data;
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
      toast({ title: "That did not work", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    if (!target) return;
    try {
      setSummary(await api.admin.summary(target));
    } catch (error) {
      setSummary(null);
      setNotice({ tone: "error", text: error.message });
    }
  };

  const handleCheck = async (event) => {
    event?.preventDefault();
    if (!target) {
      setNotice({ tone: "error", text: "Enter the account email first." });
      return;
    }
    await run("check", refresh);
  };

  const handleCopy = async () => {
    const result = await run("copy", () => api.admin.copyProducts(target));
    if (result) {
      setNotice({
        tone: result.failed ? "warn" : "ok",
        text:
          `${result.copied} product${result.copied === 1 ? "" : "s"} copied from ` +
          `${result.source_shops} shop${result.source_shops === 1 ? "" : "s"}` +
          `${result.failed ? `, ${result.failed} could not be copied` : ""}` +
          `${result.already_copied ? ` · ${result.already_copied} already in the account` : ""}.`,
        detail: result.errors?.length ? result.errors : null,
      });
    }
  };

  const handleGrant = async () => {
    const result = await run("grant", () => api.admin.grantUltra(target, STORE_ALLOWANCE));
    if (result) {
      setNotice({
        tone: "ok",
        text: `Ultra granted with no expiry, limited to ${result.max_shops} store${
          result.max_shops === 1 ? "" : "s"
        }.`,
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="flex items-start gap-3 p-6">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-semibold text-slate-900">Operator screen</p>
              <p className="text-sm text-slate-600">
                This catalogue tool is only available to an account with the admin role.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-teal-700" /> Copy a catalogue &amp; grant Ultra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCheck} className="space-y-2">
            <Label htmlFor="target-email">Account email</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="target-email"
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSummary(null);
                  setNotice(null);
                }}
              />
              <Button type="submit" variant="outline" disabled={!target || busy === "check"}>
                <RefreshCw className={`mr-2 h-4 w-4 ${busy === "check" ? "animate-spin" : ""}`} />
                Check account
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Products, images and prices are copied from every shop; the account&apos;s own
              catalogue is left untouched and running the copy again never duplicates a product.
            </p>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleCopy} disabled={!target || Boolean(busy)}>
              <Copy className="mr-2 h-4 w-4" />
              {busy === "copy" ? "Copying…" : "Copy all products"}
            </Button>
            <Button onClick={handleGrant} variant="secondary" disabled={!target || Boolean(busy)}>
              <Crown className="mr-2 h-4 w-4" />
              {busy === "grant" ? "Granting…" : `Grant Ultra · ${STORE_ALLOWANCE} stores`}
            </Button>
          </div>

          {notice && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                notice.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : notice.tone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-teal-200 bg-teal-50 text-teal-900"
              }`}
            >
              <p className="font-medium">{notice.text}</p>
              {notice.detail && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {notice.detail.map((row) => (
                    <li key={row.product_id}>
                      <span className="font-mono">{row.product_id}</span> — {row.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-teal-700" /> {summary.target}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                {summary.plan}
                {summary.plan === "ultra" && <Badge className="bg-teal-700 text-white">Ultra</Badge>}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Stores</p>
              <p className="mt-1 font-semibold text-slate-900">
                {summary.shop_count} of {summary.max_shops === null ? "unlimited" : summary.max_shops}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Products in other shops</p>
              <p className="mt-1 font-semibold text-slate-900">{summary.source_products}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Already copied here</p>
              <p className="mt-1 font-semibold text-slate-900">{summary.copied_already}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
