"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      locations: String(form.get("locations")).split(",").map((s) => s.trim()).filter(Boolean),
      budgetMax: Number(form.get("budgetMax")),
      minRooms: form.get("minRooms") ? Number(form.get("minRooms")) : undefined,
      minSizeSqm: form.get("minSizeSqm") ? Number(form.get("minSizeSqm")) : undefined,
      mustHaveExtras: String(form.get("mustHaveExtras") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      goal: form.get("goal"),
      openToRenting: form.get("openToRenting") === "on",
      openToFixerUpper: form.get("openToFixerUpper") === "on",
      renovationBudget: form.get("renovationBudget") ? Number(form.get("renovationBudget")) : undefined,
      freeText: String(form.get("freeText") ?? ""),
      exampleUrls: String(form.get("exampleUrls") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Please check the form — something was missing or invalid.");
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Locations (comma-separated)<input name="locations" required /></label>
      <label>Max budget (₪)<input name="budgetMax" type="number" required /></label>
      <label>Min rooms<input name="minRooms" type="number" step="0.5" /></label>
      <label>Min size (m²)<input name="minSizeSqm" type="number" /></label>
      <label>Must-have extras (comma-separated, e.g. parking, mamad, balcony)<input name="mustHaveExtras" /></label>
      <label>
        Goal
        <select name="goal" required defaultValue="">
          <option value="" disabled>Select...</option>
          <option value="primary">Primary residence</option>
          <option value="investment">Investment</option>
        </select>
      </label>
      <label><input name="openToRenting" type="checkbox" /> Open to renting first</label>
      <label><input name="openToFixerUpper" type="checkbox" /> Open to a fixer-upper</label>
      <label>Renovation budget (₪, if applicable)<input name="renovationBudget" type="number" /></label>
      <label>Anything else? (free text)<textarea name="freeText" /></label>
      <label>Example listings you've already seen (comma-separated URLs)<textarea name="exampleUrls" /></label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
