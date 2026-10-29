import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";

const KIND_LABELS = {
  stokvel: "stokvel",
  savings_group: "savings group",
  bulk_buy: "bulk buy",
};

/**
 * `/invite/group/:token` — the link from a group invitation email.
 *
 * The group name and shop are read through a database function that only
 * answers for a valid token, so it is safe to show this screen signed out. The
 * invitation is accepted by the signed-in account, and the database checks the
 * address matches before the member joins the group.
 */
export default function AcceptGroupInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, user, refreshShop } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.groups.invitePreview(token);
        if (!cancelled) setPreview(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open this invitation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const invalidReason = {
    invalid: "This invitation link is not valid.",
    accepted: "This invitation has already been accepted.",
    expired: "This invitation has expired. Ask the owner to invite you again.",
  };

  const handleAccept = async () => {
    setError("");
    setAccepting(true);
    try {
      await api.groups.acceptInvite(token);
      await refreshShop();
      navigate("/myspaza-card", { replace: true });
    } catch (err) {
      setError(err.message || "Could not accept this invitation.");
    } finally {
      setAccepting(false);
    }
  };

  const nextPath = `/invite/group/${token}`;
  const wrongAccount =
    isAuthenticated && preview?.email && user?.email &&
    preview.email.toLowerCase() !== user.email.toLowerCase();
  const label = KIND_LABELS[preview?.group_kind] || "group";

  const footer = (
    <Link to="/login" className="font-medium text-slate-900 underline underline-offset-4 hover:text-teal-700">
      Back to sign in
    </Link>
  );

  if (loading || isLoadingAuth) {
    return (
      <AuthLayout title="Opening your invitation" subtitle="One moment while we check the link." footer={footer}>
        <div className="flex items-center justify-center py-10 text-slate-500">
          <Loader2 className="animate-spin" size={22} />
        </div>
      </AuthLayout>
    );
  }

  if (!preview?.valid) {
    return (
      <AuthLayout title="Invitation unavailable" subtitle="This link cannot be used." footer={footer}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {invalidReason[preview?.reason] || error || "This invitation link is not valid."}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${preview.group_name}`}
      subtitle={`${preview.email} was invited to this ${label}.`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users size={16} className="text-teal-700" /> {preview.group_name}
          </div>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {label} · {preview.shop_name}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Your name and email are added to the member list once you accept.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {wrongAccount && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            You are signed in as {user.email}. This invitation is for {preview.email} — sign out and sign in with that address.
          </div>
        )}

        {isAuthenticated ? (
          <Button
            onClick={handleAccept}
            disabled={accepting || wrongAccount}
            className="h-11 w-full rounded-lg bg-teal-700 text-white hover:bg-teal-800"
          >
            {accepting ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} className="mr-2" />}
            {accepting ? "Joining…" : "Accept invitation"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button asChild className="h-11 w-full rounded-lg bg-teal-700 text-white hover:bg-teal-800">
              <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in to accept</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full rounded-lg border-slate-300">
              <Link to={`/register?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(preview.email)}`}>
                Create an account
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
