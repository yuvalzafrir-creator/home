import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getProfile } from "@/lib/profile";
import { getSessionHouseholdId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!getSessionHouseholdId()) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main>
      <h1>הפרופיל שלי</h1>
      <p className="page-subtitle">
        עדכנו את ההעדפות בכל עת — הדירוג של מודעות חדשות יתעדכן בהתאם.
      </p>
      <OnboardingForm mode="edit" initial={profile} />
    </main>
  );
}
