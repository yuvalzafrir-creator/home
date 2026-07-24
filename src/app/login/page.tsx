import { redirect } from "next/navigation";
import { getSessionHouseholdId } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (getSessionHouseholdId()) redirect("/");
  return <AuthForm />;
}
