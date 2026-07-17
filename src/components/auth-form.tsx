"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/states";

function messageFromPayload(payload: unknown) {
  if (
    typeof payload === "object" && payload !== null && "error" in payload &&
    typeof payload.error === "object" && payload.error !== null && "message" in payload.error &&
    typeof payload.error.message === "string"
  ) return payload.error.message;
  return "The request could not be completed. Please try again.";
}

export function AuthForm({ mode, demoEnabled }: { mode: "login" | "signup"; demoEnabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(messageFromPayload(payload));
      const redirectTo = typeof payload === "object" && payload !== null && "redirectTo" in payload && typeof payload.redirectTo === "string"
        ? payload.redirectTo
        : "/onboarding";
      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="field-group">
        <label htmlFor="email">Email address</label>
        <div className="field-with-icon"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="email" placeholder="hero@example.com" required /></div>
      </div>
      <div className="field-group">
        <div className="label-row"><label htmlFor="password">Password</label>{isLogin && <span>8+ characters</span>}</div>
        <div className="field-with-icon">
          <LockKeyhole size={17} />
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} placeholder="Your secret phrase" required />
          <button type="button" className="field-icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <Button type="submit" className="auth-submit" disabled={pending}>
        {pending ? <InlineLoader label={isLogin ? "Entering..." : "Creating your hero..."} /> : isLogin ? "Enter LifeQuest" : "Create your hero"}
      </Button>
      {demoEnabled && (
        <>
          <div className="form-divider"><span>or</span></div>
          <a className="button button-secondary auth-demo" href="/api/demo/start">Try the seeded demo</a>
        </>
      )}
      <p className="auth-switch">
        {isLogin ? "New to the realm?" : "Already have a hero?"}{" "}
        <Link href={isLogin ? "/signup" : "/login"}>{isLogin ? "Create an account" : "Sign in"}</Link>
      </p>
    </form>
  );
}
