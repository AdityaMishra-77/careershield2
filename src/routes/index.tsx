import { createFileRoute, Link } from "@tanstack/react-router";
import { UiIcon } from "@/components/UiIcon";
import { LegalFooter } from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerShield AI - Verify jobs, find your skill gaps" },
      { name: "description", content: "Check the evidence behind any job offer, compare it with your resume and get a personal learning roadmap." },
      { property: "og:title", content: "CareerShield AI - Verify the Opportunity" },
      { property: "og:description", content: "Job trust analysis, skill-gap analysis and a personalised roadmap in one report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: "shield", title: "Job trust analysis", text: "Evidence-based signals on recruiter, domain, payments, urgency and more - never a blind 'fake' label." },
  { icon: "document", title: "Messages & offer letters", text: "Paste a WhatsApp, LinkedIn or email message, or an offer letter, and see unusual terms highlighted." },
  { icon: "target", title: "Skill-gap analysis", text: "Your resume vs the job, matched semantically and prioritised Critical → Preferred." },
  { icon: "roadmap", title: "Personal roadmap", text: "Prerequisite-aware learning steps with trusted resources and a mini-project per gap." },
  { icon: "message", title: "AI career coach", text: "Ask what to learn in 30 days or which project proves a skill - grounded in your report." },
] as const;

function Landing() {
  return (
    <div className="visual-cleanup min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <Button asChild variant="secondary" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-5">
        <section className="py-16 text-center md:py-28">
          <p className="mx-auto mb-5 w-fit rounded-full border border-border bg-card/60 px-4 py-1 text-xs uppercase tracking-widest text-primary">
            Career decision support
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Verify the opportunity. <span className="text-primary">Understand the gap.</span> Build the skills.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            Drop in a job link, screenshot, recruiter message or offer letter along with your resume. Get an evidence report and a learning plan in under a minute.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/analyze">
                Analyze a job <UiIcon name="arrow" className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
              <UiIcon name={f.icon} className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
