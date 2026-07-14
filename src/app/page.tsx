import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const favorites = await db.listing.findMany({
    where: { feedback: { some: { reaction: "like" } } },
    orderBy: { matchScore: "desc" },
  });
  const newCount = await db.listing.count({ where: { feedback: { none: {} } } });

  return (
    <main>
      <h1>לוח בקרה</h1>
      <p className="page-subtitle">ההעדפות והמודעות השמורות שלך במקום אחד.</p>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2>הפרופיל שלך</h2>
          <Link href="/profile" className="dash-link">עריכה ←</Link>
        </div>
        <div className="dash-tiles">
          <div className="dash-tile"><span>אזורים</span><strong>{profile.locations.join(", ")}</strong></div>
          <div className="dash-tile"><span>תקציב</span><strong>₪{profile.budgetMax.toLocaleString()}</strong></div>
          <div className="dash-tile"><span>חדרים</span><strong>{profile.minRooms ? `${profile.minRooms}+` : "—"}</strong></div>
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2>שמורים · מועדפים</h2>
          <Link href="/listings" className="dash-link">{newCount} מודעות חדשות ←</Link>
        </div>
        {favorites.length === 0 ? (
          <div className="empty">עדיין אין מועדפים — עברו על המודעות וסמנו את מה שמעניין.</div>
        ) : (
          <div className="card-list">
            {favorites.map((l) => (
              <article className="listing" key={l.id}>
                <h3>{l.address}</h3>
                <p className="listing__meta">
                  ₪{l.price.toLocaleString()} · {l.rooms} חד&apos; · {l.sizeSqm} מ&quot;ר
                  {l.matchScore !== null ? ` · ${l.matchScore}/100` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <Link href="/compare" className="dash-cta">השוואת מועדפים ←</Link>
      </section>
    </main>
  );
}
