import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { AddListingForm } from "@/components/AddListingForm";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main>
      <h1>הוספת מודעה</h1>
      <p className="page-subtitle">
        הדביקו קישור למודעה ונמלא את הפרטים אוטומטית — אפשר גם למלא ידנית.
      </p>
      <AddListingForm />
    </main>
  );
}
