import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/Brand";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms of Service | CareerShield AI" },
    { name: "description", content: "Terms for using CareerShield AI job evidence analysis and career reports." },
    { property: "og:title", content: "Terms of Service | CareerShield AI" },
    { property: "og:description", content: "Terms for using CareerShield AI job evidence analysis and career reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Terms,
});

function Terms() {
  return <div className="visual-cleanup min-h-screen">
    <header className="mx-auto max-w-6xl px-5 py-5"><Brand /></header>
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-sm leading-7">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: October 6, 2026</p>
      <section><h2 className="text-lg font-semibold">Using CareerShield AI</h2><p>CareerShield AI provides job evidence analysis, skill comparisons, learning roadmaps, saved reports and a career coach. By using the service, you agree to use it lawfully and to submit only information you are entitled to share.</p></section>
      <section><h2 className="text-lg font-semibold">Your account and submissions</h2><p>Keep your account secure. Do not upload information obtained unlawfully, impersonate others, or attempt to access another person's reports. Remove unnecessary sensitive information from evidence and resumes before submitting them.</p></section>
      <section><h2 className="text-lg font-semibold">Analysis limitations</h2><p>AI-generated reports may contain errors or incomplete information. Verification results depend on the submitted evidence and available public sources. They are not guarantees of legitimacy, fraud, employment, or future events, and are not legal or financial advice. Independently confirm important claims before making decisions or sharing money or personal information.</p></section>
      <section><h2 className="text-lg font-semibold">Saved reports and external resources</h2><p>Reports and learning progress are saved to your account. You can delete a saved report from the dashboard. External websites and learning resources have their own terms and policies; CareerShield AI does not control their content or availability.</p></section>
      <section><h2 className="text-lg font-semibold">Privacy and changes</h2><p>Our <Link to="/privacy" className="underline">Privacy Policy</Link> describes how information is used. These terms may be updated as the service changes; updates will appear on this page.</p></section>
      <Link to="/" className="inline-block underline">Return to CareerShield AI</Link>
    </main>
    <LegalFooter />
  </div>;
}