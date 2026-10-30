import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useNextPath } from "@/lib/redirect";
import { useAuth } from "@/lib/AuthContext";

const fieldClass =
  "h-11 rounded-lg border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-teal-600 focus-visible:ring-teal-600/20";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  // The route guards read their state from AuthContext, so the new session has
  // to be loaded into context before navigating away — otherwise the first
  // attempt hits a guard that still sees a signed-out user and bounces back.
  const { checkUserAuth } = useAuth();
  // Invitation links send people here with ?next=/invite/<token>.
  const nextPath = useNextPath();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      await checkUserAuth();
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await api.auth.loginWithProvider("google", nextPath);
    } catch (err) {
      setError(err.message || "Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where your shop left off."
      footer={
        <>
          New to My Spaza?{" "}
          <Link to="/register" className="font-medium text-slate-900 underline underline-offset-4 hover:text-teal-700">
            Create an account
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="mb-6 h-11 w-full rounded-lg border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <GoogleIcon className="w-5 h-5 mr-2" />
            Continue with Google
          </>
        )}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            or
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-slate-700">
            Email
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px] font-medium text-slate-700">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
        </div>
        <Button
          type="submit"
          className="h-11 w-full rounded-lg bg-slate-900 font-medium text-white shadow-none hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
