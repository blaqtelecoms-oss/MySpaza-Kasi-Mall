import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useSubscription } from "@/lib/SubscriptionContext";
import { useToast } from "@/components/ui/use-toast";
import BusinessProfileStep from "@/components/onboarding/BusinessProfileStep";
import PlanStep from "@/components/onboarding/PlanStep";

const STEPS = [
  { key: 1, label: "Business" },
  { key: 2, label: "Plan" },
];

/**
 * First-run setup for a new account: the business profile, then a plan (Free,
 * Premium or Ultra). The plan step is last and mandatory — there is no skip.
 * Premium and Ultra open the app's existing Yoco checkout; the flow finishes
 * itself once that payment is confirmed and the shop's plan changes.
 */
export default function Onboarding() {
  const { shop, user, completeOnboarding } = useAuth();
  const { plan, confirmingPayment, openCheckout } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(() => ({
    name: "",
    type: "",
    address: "",
    owner: "",
    phone: "",
    email: "",
    ...(shop?.business || {}),
    owner: shop?.business?.owner || user?.full_name || "",
    email: shop?.business?.email || user?.email || "",
  }));
  const [choice, setChoice] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setFinishing(true);
    try {
      await completeOnboarding();
      navigate("/", { replace: true });
    } catch (err) {
      finished.current = false;
      setFinishing(false);
      toast({ title: "Could not finish setup", description: err.message, variant: "destructive" });
    }
  }, [completeOnboarding, navigate, toast]);

  // A paid plan only switches on after Yoco confirms it, which happens on the
  // page we return to; when the shop's plan is no longer Free the last step is
  // done, so the flow completes by itself.
  useEffect(() => {
    if (plan !== "free") finish();
  }, [plan, finish]);

  const handleProfile = async (values) => {
    setSavingProfile(true);
    try {
      await api.shop.saveBusinessProfile(values);
      setProfile(values);
      setStep(2);
    } catch (err) {
      toast({ title: "Could not save your business details", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePlan = () => {
    if (!choice) return;
    if (choice === "free") {
      finish();
      return;
    }
    openCheckout(choice);
  };

  if (!shop || !shop.isOwner || shop.onboardedAt) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-10">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <img src="/brand/logo.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Welcome to My Spaza</p>
            <p className="text-xs text-slate-500">
              {step === 1 ? "Tell us about your shop" : "Choose the plan you want to start on"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">
        <ol className="mb-5 flex items-center gap-2">
          {STEPS.map((item) => {
            const active = step === item.key;
            const done = step > item.key;
            return (
              <li key={item.key} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done || active ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {item.key}
                </span>
                <span className={`text-xs font-medium ${active ? "text-slate-900" : "text-slate-500"}`}>
                  {item.label}
                </span>
                {item.key !== STEPS.length && <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {step === 1 ? (
            <BusinessProfileStep
              key="profile"
              value={profile}
              onSubmit={handleProfile}
              saving={savingProfile}
            />
          ) : (
            <PlanStep
              key="plan"
              value={choice}
              onChange={setChoice}
              onContinue={handlePlan}
              saving={finishing}
              confirmingPayment={confirmingPayment}
            />
          )}
        </section>

        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={finishing}
            className="mt-4 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Back to business details
          </button>
        )}
      </main>
    </div>
  );
}
