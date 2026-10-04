import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, MinusCircle, Download, Send, Loader2, ExternalLink, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { coachChat } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrustBadge } from "@/components/TrustBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/report/$id")({
  head: () => ({ meta: [{ title: "Report — CareerShield AI" }, { name: "description", content: "Job trust evidence, skill gaps and learning roadmap." }] }),
  component: Report,
});

const levelIcon = {
  positive: <CheckCircle2 className="h-4 w-4 text-success" />,
  neutral: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
  caution: <AlertTriangle className="h-4 w-4 text-warning" />,
  risk: <XCircle className="h-4 w-4 text-destructive" />,
} as Record<string, React.ReactNode>;

const matchStyle: Record<string, string> = {
  strong: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  gap: "bg-destructive/15 text-destructive",
};
const prioOrder = ["Critical", "High", "Medium", "Preferred", "None"];
const STATUSES = ["Not Started", "In Progress", "Completed"] as const;

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-6 break-inside-avoid", className)}>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Report() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading report…</p>;
  if (!data) return <p>Report not found.</p>;
  const r = data.result as any;
  const progress = (data.progress ?? {}) as Record<string, string>;
  const skills = [...(r.skills ?? [])].sort((a: any, b: any) => prioOrder.indexOf(a.priority) - prioOrder.indexOf(b.priority));
  const categories: Record<string, { total: number; score: number }> = {};
  for (const s of skills) {
    const c = (categories[s.category] ??= { total: 0, score: 0 });
    c.total++;
    c.score += s.match === "strong" ? 1 : s.match === "partial" ? 0.5 : 0;
  }
  const roadmap = r.roadmap ?? [];

  async function setStatus(skill: string, status: string) {
    const next = { ...progress, [skill]: status };
    qc.setQueryData(["analysis", id], { ...data, progress: next });
    const { error } = await supabase.from("analyses").update({ progress: next }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["analyses"] });
  }

  const job = r.job ?? {};
  const facts = [
    ["Location", job.location], ["Experience", job.experience], ["Salary", job.salary], ["Type", job.employment_type],
    ["Recruiter", job.recruiter], ["Contact", job.contact_email], ["Job ID", job.job_id], ["Apply at", job.application_url],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download className="mr-1.5 h-4 w-4" /> Download report
        </Button>
      </div>

      <header className="rounded-2xl border border-border bg-hero bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary">{job.company || (r.case_evidence ? "Company name not identified in submitted evidence" : "Unknown company")}</p>
            <h1 className="text-3xl font-bold">{job.title || data.title}</h1>
          </div>
          <TrustBadge status={r.trust?.status} className="text-sm" />
        </div>
        {facts.length > 0 && (
          <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0"><dt className="text-muted-foreground">{k}:</dt><dd className="truncate">{v}</dd></div>
            ))}
          </dl>
        )}
      </header>

      {(r.case_evidence?.length > 0 || r.entities?.length > 0 || r.conflicts?.length > 0 || r.payment_status || r.timeline?.length > 0) && (
        <Card title={`Case ${r.case_id ?? ""} — combined evidence`}>
          {r.case_evidence?.length > 0 && (
            <ul className="mb-4 space-y-1 text-sm">
              {r.case_evidence.map((e: any) => <li key={e.number}><b>Evidence #{e.number}</b> — {e.kind}</li>)}
            </ul>
          )}
          {r.payment_status && (
            <p className="mb-4 flex gap-2 text-sm">
              {r.payment_status.state === "No Payment Request Detected In Submitted Evidence" ? <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <span><b>{r.payment_status.state}.</b> {r.payment_status.detail}
                {r.payment_status.amount && <> <b>Payment:</b> {r.payment_status.amount}.</>}
                {r.payment_status.reason && <> <b>Reason:</b> {r.payment_status.reason}.</>}
                {r.payment_status.sources?.length > 0 && <span className="text-xs text-muted-foreground"> · Source: {r.payment_status.sources.map((n: number) => `Evidence #${n}`).join(", ")}</span>}</span>
            </p>
          )}
          {r.timeline?.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold">Recruitment evidence timeline</h3>
              <ol className="space-y-3 border-l border-border pl-4">
                {r.timeline.map((t: any, i: number) => (
                  <li key={i} className="text-sm">
                    <p className="text-xs text-muted-foreground">{t.date || "Date not shown in evidence"} · {t.stage}</p>
                    <p>{t.event} <span className="text-xs text-muted-foreground">· Source: {(t.sources ?? []).map((n: number) => `Evidence #${n}`).join(", ")}</span></p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {r.conflicts?.length > 0 && (
            <ul className="mb-4 space-y-2">
              {r.conflicts.map((c: any, i: number) => (
                <li key={i} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span><b>{c.message}</b> {(c.values ?? []).map((v: any) => `${v.value} (Evidence #${v.source})`).join(" vs ")}</span></li>
              ))}
            </ul>
          )}
          {r.entities?.length > 0 && (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {r.entities.map((e: any, i: number) => (
                <div key={i} className="min-w-0"><dt className="text-muted-foreground">{e.field}</dt>
                  <dd>{e.value} <span className="text-xs text-muted-foreground">· Source: {(e.sources ?? []).map((n: number) => `Evidence #${n}`).join(", ")}</span></dd></div>
              ))}
            </dl>
          )}
          <Link to="/analyze" search={{ caseId: id }} className="no-print mt-4 inline-block text-sm text-primary hover:underline">+ Add more evidence to this case</Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Trust evidence">
          <p className="mb-4 text-sm text-muted-foreground">{r.trust?.summary}</p>
          <ul className="space-y-3">
            {(r.trust?.evidence ?? []).map((e: any, i: number) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5">{levelIcon[e.level]}</span>
                <div>
                  <p className="text-sm font-medium">{e.signal} <span className="ml-1 text-xs uppercase text-muted-foreground">{e.category}</span></p>
                  <p className="text-sm text-muted-foreground">{e.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {r.trust?.verification_steps?.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold">Verify it yourself</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {r.trust.verification_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}
        </Card>

        <Card title="Skill readiness by category">
          <div className="space-y-3">
            {Object.entries(categories).map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-sm"><span>{c}</span><span className="text-muted-foreground">{v.score}/{v.total}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(v.score / v.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {r.next_actions?.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold">Recommended next actions</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {r.next_actions.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </>
          )}
        </Card>
      </div>

      {r.offer_terms?.length > 0 && (
        <Card title="Offer letter terms">
          <div className="grid gap-2 sm:grid-cols-2">
            {r.offer_terms.map((t: any, i: number) => (
              <div key={i} className={cn("rounded-lg border p-3 text-sm", t.flag ? "border-warning/40 bg-warning/10" : "border-border")}>
                <p className="font-medium">{t.term}: <span className="font-normal">{t.value}</span></p>
                {t.note && <p className="mt-1 text-muted-foreground">{t.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Skill-gap analysis">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2 pr-3">Skill</th><th className="pb-2 pr-3">Match</th><th className="pb-2 pr-3">Priority</th><th className="pb-2">Why</th></tr>
            </thead>
            <tbody>
              {skills.map((s: any, i: number) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="py-2.5 pr-3 font-medium">{s.name}{!s.required && <span className="ml-1 text-xs text-muted-foreground">(preferred)</span>}</td>
                  <td className="py-2.5 pr-3"><span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", matchStyle[s.match])}>{s.match}</span></td>
                  <td className="py-2.5 pr-3">{s.priority === "None" ? "—" : s.priority}</td>
                  <td className="py-2.5 text-muted-foreground">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Your learning roadmap">
        {roadmap.length === 0 ? <p className="text-sm text-muted-foreground">No gaps found — you're a strong match!</p> : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {roadmap.map((s: any, i: number) => {
              const st = progress[s.skill] ?? "Not Started";
              return (
                <li key={i} className="relative">
                  <span className={cn("absolute -left-[33px] grid h-5 w-5 place-items-center rounded-full border text-[10px]", st === "Completed" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>{i + 1}</span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{s.skill} <span className="text-sm font-normal text-muted-foreground">· {s.duration}</span></h3>
                    <div className="no-print flex rounded-lg bg-muted p-0.5 text-xs">
                      {STATUSES.map((x) => (
                        <button key={x} onClick={() => setStatus(s.skill, x)} className={cn("rounded-md px-2 py-1", st === x ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{x}</button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.why}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(s.resources ?? []).map((res: any, j: number) => (
                      <a key={j} href={res.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary/60">
                        {res.title} <span className="text-muted-foreground">· {res.type}</span> <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                  {s.project && <p className="mt-2 flex gap-2 text-sm"><Hammer className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><b>Project:</b> {s.project}</span></p>}
                  {s.practice?.length > 0 && <ul className="mt-1 list-disc pl-11 text-sm text-muted-foreground">{s.practice.map((p: string, k: number) => <li key={k}>{p}</li>)}</ul>}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div id="coach" className="scroll-mt-20">
        <Coach analysisId={id} />
      </div>
    </div>
  );
}

function Coach({ analysisId }: { analysisId: string }) {
  const chat = useServerFn(coachChat);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = ["What should I learn in the next 30 days?", "Which project best proves my missing skills?", "Is this opportunity safe to apply to?"];

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await chat({ data: { analysisId, messages: next } });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "Coach unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="AI career coach" className="no-print">
      <div className="space-y-3">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>{m.content}</div>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Input placeholder="Ask about this job, your gaps, or your plan…" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" size="icon" disabled={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}
