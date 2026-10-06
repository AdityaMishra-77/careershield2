import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/Brand";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy | CareerShield AI" },
    { name: "description", content: "How CareerShield AI uses account information, submitted evidence, resumes and reports." },
    { property: "og:title", content: "Privacy Policy | CareerShield AI" },
    { property: "og:description", content: "How CareerShield AI uses account information, submitted evidence, resumes and reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Privacy,
});

function Privacy() {
  return <div className="visual-cleanup min-h-screen">
    <header className="mx-auto max-w-6xl px-5 py-5"><Brand /></header>
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-sm leading-7">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: October 6, 2026</p>
      <section><h2 className="text-lg font-semibold">Information you provide</h2><p>CareerShield AI uses account information, including your email and, when provided by Google, your name and profile image. Job links, screenshots, recruiter messages, offer letters, resume information and career coach messages you submit are processed to provide the requested service.</p></section>
      <section><h2 className="text-lg font-semibold">Analysis and verification</h2><p>Submitted evidence and resumes are sent to AI processing services through Lovable AI to generate reports. Career coach requests include the conversation and report context. Web verification may send extracted company names, recruiter names, email addresses or domains to public search services and request public websites to check claims.</p></section>
      <section><h2 className="text-lg font-semibold">Saved information</h2><p>Your account's reports, extracted evidence history, submitted job text, resume text and learning progress are stored using Lovable Cloud. Access to saved reports is restricted to the authenticated owner. Sign-in session information is stored in your browser to keep you signed in. Google authentication is also governed by Google's privacy policy.</p></section>
      <section><h2 className="text-lg font-semibold">Your choices</h2><p>Your resume is optional. Avoid submitting unnecessary identity documents, bank details or other sensitive information. You can remove selected screenshots before analysis, delete saved reports from the dashboard, and log out through your profile menu. Logging out ends your session but does not delete saved reports.</p></section>
      <section><h2 className="text-lg font-semibold">Third-party services</h2><p>Authentication, hosting, storage, AI processing, search providers and linked websites process information under their own policies. Public web verification can be incomplete or unavailable. Do not submit information you do not have permission to share.</p></section>
      <section><h2 className="text-lg font-semibold">Policy updates</h2><p>Updates to this policy will be published here. The date above identifies the current version.</p></section>
      <Link to="/" className="inline-block underline">Return to CareerShield AI</Link>
    </main>
    <LegalFooter />
  </div>;
}