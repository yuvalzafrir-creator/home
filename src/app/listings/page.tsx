import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { ListingsClient } from "./ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  return <ListingsClient />;
}
