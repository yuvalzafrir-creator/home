import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main>
      <h1>Tell us what you&apos;re looking for</h1>
      <p className="page-subtitle">
        We&apos;ll use this to score every new listing so the best matches rise to the top.
      </p>
      <OnboardingForm />
    </main>
  );
}
