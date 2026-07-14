import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { CompareClient } from "./CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return <CompareClient />;
}
