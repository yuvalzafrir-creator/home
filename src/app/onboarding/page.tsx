import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile) redirect("/");

  return (
    <main>
      <h1>ספרו לנו מה אתם מחפשים</h1>
      <p className="page-subtitle">
        נשתמש בזה כדי לדרג כל מודעה חדשה כך שההתאמות הטובות ביותר יעלו למעלה.
      </p>
      <OnboardingForm mode="create" />
    </main>
  );
}
