"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData } from "@/lib/profile";

const SETTLEMENT_TYPES = ["עיר", "מושב", "יישוב קהילתי", "קיבוץ", "כפר"];

interface OnboardingFormProps {
  mode?: "create" | "edit";
  initial?: ProfileData | null;
}

export function OnboardingForm({ mode = "create", initial = null }: OnboardingFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const form = new FormData(e.currentTarget);
    const payload = {
      locations: String(form.get("locations")).split(",").map((s) => s.trim()).filter(Boolean),
      budgetMax: Number(form.get("budgetMax")),
      minRooms: form.get("minRooms") ? Number(form.get("minRooms")) : undefined,
      minSizeSqm: form.get("minSizeSqm") ? Number(form.get("minSizeSqm")) : undefined,
      mustHaveExtras: String(form.get("mustHaveExtras") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      settlementTypes: form.getAll("settlementType").map(String),
      goal: form.get("goal"),
      openToRenting: form.get("openToRenting") === "on",
      openToFixerUpper: form.get("openToFixerUpper") === "on",
      renovationBudget: form.get("renovationBudget") ? Number(form.get("renovationBudget")) : undefined,
      freeText: form.get("freeText") ? String(form.get("freeText")) : undefined,
      exampleUrls: String(form.get("exampleUrls") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("יש לבדוק את הטופס — משהו חסר או לא תקין.");
      return;
    }

    if (mode === "edit") {
      setSaved(true);
      router.refresh();
    } else {
      router.push("/");
    }
  }

  const csv = (a: string[] | undefined) => (a ?? []).join(", ");

  return (
    <form onSubmit={handleSubmit}>
      <label>אזורים (מופרדים בפסיקים)<input name="locations" required defaultValue={csv(initial?.locations)} /></label>
      <div className="field-group">
        <span className="field-group__label">סוג יישוב</span>
        <div className="checkbox-row">
          {SETTLEMENT_TYPES.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                name="settlementType"
                value={t}
                defaultChecked={initial?.settlementTypes?.includes(t) ?? false}
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      <label>תקציב מקסימלי (₪)<input name="budgetMax" type="number" required defaultValue={initial?.budgetMax ?? ""} /></label>
      <label>מינימום חדרים<input name="minRooms" type="number" step="0.5" defaultValue={initial?.minRooms ?? ""} /></label>
      <label>מינימום שטח (מ&quot;ר)<input name="minSizeSqm" type="number" defaultValue={initial?.minSizeSqm ?? ""} /></label>
      <label>דרישות חובה (מופרדות בפסיקים, למשל חניה, ממ&quot;ד, מרפסת)<input name="mustHaveExtras" defaultValue={csv(initial?.mustHaveExtras)} /></label>
      <label>
        מטרה
        <select name="goal" required defaultValue={initial?.goal ?? ""}>
          <option value="" disabled>בחר/י...</option>
          <option value="primary">מגורים</option>
          <option value="investment">השקעה</option>
        </select>
      </label>
      <label><input name="openToRenting" type="checkbox" defaultChecked={initial?.openToRenting ?? false} /> פתוח/ה לשכירות בשלב ראשון</label>
      <label><input name="openToFixerUpper" type="checkbox" defaultChecked={initial?.openToFixerUpper ?? false} /> פתוח/ה לדירה לשיפוץ</label>
      <label>תקציב שיפוץ (₪, אם רלוונטי)<input name="renovationBudget" type="number" defaultValue={initial?.renovationBudget ?? ""} /></label>
      <label>משהו נוסף? (טקסט חופשי)<textarea name="freeText" defaultValue={initial?.freeText ?? ""} /></label>
      <label>מודעות לדוגמה שכבר ראית (כתובות מופרדות בפסיקים)<textarea name="exampleUrls" defaultValue={csv(initial?.exampleUrls)} /></label>

      {error && <p role="alert">{error}</p>}
      {saved && <p className="form-saved">ההעדפות נשמרו.</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "שומר…" : mode === "edit" ? "עדכון העדפות" : "שמירת העדפות"}
      </button>
    </form>
  );
}
