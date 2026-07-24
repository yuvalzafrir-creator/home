"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "משהו השתבש, נסו שוב.");
  }

  return (
    <main className="auth">
      <div className="auth__brand">
        <span className="brand__mark">⌂</span> HomeScout
      </div>
      <h1>{mode === "login" ? "התחברות" : "הרשמת משפחה"}</h1>
      <p className="page-subtitle">
        {mode === "login"
          ? "היכנסו עם שם המשפחה והסיסמה שלכם."
          : "בחרו שם משפחה וסיסמה — זה החשבון המשותף שלכם."}
      </p>
      <form onSubmit={submit}>
        <label>
          שם משפחה
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "…" : mode === "login" ? "כניסה" : "הרשמה"}
        </button>
      </form>
      <p className="auth__toggle">
        {mode === "login" ? "אין לכם עדיין חשבון?" : "כבר יש לכם חשבון?"}{" "}
        <button
          type="button"
          className="auth__link"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "הרשמת משפחה חדשה" : "התחברות"}
        </button>
      </p>
    </main>
  );
}
