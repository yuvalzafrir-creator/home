import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { getSessionHouseholdId } from "@/lib/auth";
import { CompareClient } from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  if (!getSessionHouseholdId()) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return <CompareClient />;
}
