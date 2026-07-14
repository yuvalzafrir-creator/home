"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtractedFields } from "@/lib/extract-listing";

const EMPTY: ExtractedFields = {
  address: null, price: null, rooms: null, sizeSqm: null, floor: null,
  hasParking: false, hasBalcony: false, hasMamad: false, hasElevator: false, description: null,
};

export function AddListingForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<ExtractedFields>(EMPTY);
  const [filling, setFilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ExtractedFields>(key: K, value: ExtractedFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function autoFill() {
    if (!url) return;
    setFilling(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/listings/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        setFields({ ...EMPTY, ...data.fields });
        setNotice("מילאנו את מה שהצלחנו — בדקו והשלימו.");
      } else {
        setNotice("לא הצלחנו למלא אוטומטית — מלאו ידנית.");
      }
    } catch {
      setNotice("לא הצלחנו למלא אוטומטית — מלאו ידנית.");
    } finally {
      setFilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, ...fields }),
    });
    setSubmitting(false);
    if (res.status === 201) {
      const data = await res.json();
      router.push(`/listings/${data.listing.id}`);
      return;
    }
    if (res.status === 409) {
      setError("המודעה כבר קיימת.");
      return;
    }
    setError("יש לבדוק את הטופס — משהו חסר או לא תקין.");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        קישור למודעה
        <input
          name="url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.yad2.co.il/item/..."
        />
      </label>
      <button type="button" onClick={autoFill} disabled={filling || !url}>
        {filling ? "ממלא…" : "מלא אוטומטית"}
      </button>
      {notice && <p className="form-notice">{notice}</p>}

      <label>כתובת<input value={fields.address ?? ""} onChange={(e) => set("address", e.target.value || null)} required /></label>
      <label>מחיר (₪)<input type="number" value={fields.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>חדרים<input type="number" step="0.5" value={fields.rooms ?? ""} onChange={(e) => set("rooms", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>שטח (מ&quot;ר)<input type="number" value={fields.sizeSqm ?? ""} onChange={(e) => set("sizeSqm", e.target.value ? Number(e.target.value) : null)} required /></label>
      <label>קומה<input type="number" value={fields.floor ?? ""} onChange={(e) => set("floor", e.target.value ? Number(e.target.value) : null)} /></label>
      <label><input type="checkbox" checked={fields.hasParking} onChange={(e) => set("hasParking", e.target.checked)} /> חניה</label>
      <label><input type="checkbox" checked={fields.hasBalcony} onChange={(e) => set("hasBalcony", e.target.checked)} /> מרפסת</label>
      <label><input type="checkbox" checked={fields.hasMamad} onChange={(e) => set("hasMamad", e.target.checked)} /> ממ&quot;ד</label>
      <label><input type="checkbox" checked={fields.hasElevator} onChange={(e) => set("hasElevator", e.target.checked)} /> מעלית</label>
      <label>תיאור<textarea value={fields.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "מוסיף…" : "הוספת מודעה"}
      </button>
    </form>
  );
}
