import { useState } from "react";
import { ArrowRight, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSelect } from "@/components/ui/mobile-select";

const BUSINESS_TYPES = [
  { value: "spaza", label: "Spaza shop" },
  { value: "tuck-shop", label: "Tuck shop" },
  { value: "grocery", label: "Grocery store" },
  { value: "butchery", label: "Butchery" },
  { value: "salon", label: "Salon or barber" },
  { value: "other", label: "Something else" },
];

const REQUIRED = {
  name: "Your shop's name",
  type: "What kind of shop it is",
  address: "Where the shop is",
  owner: "Your name",
  phone: "A phone number",
};

/**
 * Onboarding step 1: the business profile. The details land in the same
 * `shop_settings.business` blob the Settings screen and the POS receipt read,
 * so the owner never enters them twice.
 */
export default function BusinessProfileStep({ value, onSubmit, saving }) {
  const [form, setForm] = useState(value || {});
  const [error, setError] = useState("");

  const set = (key) => (event) => {
    const next = event?.target ? event.target.value : event;
    setForm((current) => ({ ...current, [key]: next }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const missing = Object.keys(REQUIRED).find((key) => !String(form[key] || "").trim());
    if (missing) {
      setError(REQUIRED[missing]);
      return;
    }
    setError("");
    onSubmit({
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      owner: form.owner.trim(),
      phone: form.phone.trim(),
      email: (form.email || "").trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="business-name">Shop name</Label>
        <Input
          id="business-name"
          value={form.name || ""}
          onChange={set("name")}
          placeholder="Kasi Mini Market"
          autoComplete="organization"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type of shop</Label>
        <MobileSelect
          value={form.type || ""}
          onValueChange={set("type")}
          options={BUSINESS_TYPES}
          placeholder="Choose your shop type"
          triggerClassName="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business-address">Location</Label>
        <Input
          id="business-address"
          value={form.address || ""}
          onChange={set("address")}
          placeholder="12 Main Road, Soweto"
          autoComplete="street-address"
          className="h-11"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="business-owner">Owner</Label>
          <Input
            id="business-owner"
            value={form.owner || ""}
            onChange={set("owner")}
            placeholder="Your full name"
            autoComplete="name"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-phone">Phone</Label>
          <Input
            id="business-phone"
            type="tel"
            value={form.phone || ""}
            onChange={set("phone")}
            placeholder="082 000 0000"
            autoComplete="tel"
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business-email">Email for the shop</Label>
        <Input
          id="business-email"
          type="email"
          value={form.email || ""}
          onChange={set("email")}
          placeholder="shop@example.co.za"
          autoComplete="email"
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          Printed on receipts. Defaults to the address you signed up with.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Please add: {error}.
        </p>
      )}

      <Button type="submit" className="h-12 w-full text-sm font-semibold" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Store className="mr-2 h-4 w-4" />
            Continue to plans
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
