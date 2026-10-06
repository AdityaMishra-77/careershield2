import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UiIcon } from "@/components/UiIcon";
import { analyzeJob } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/analyze")({
  head: () => ({ meta: [{ title: "Analyze a job - CareerShield AI" }, { name: "description", content: "Submit a job and your resume for analysis." }, { property: "og:title", content: "Analyze a job - CareerShield AI" }, { property: "og:description", content: "Submit a job and your resume for analysis." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s) => z.object({ caseId: z.string().uuid().optional() }).parse(s),
  component: Analyze,
});

function readAsDataUrl(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function ImagePick({ value, onChange, label }: { value: string | undefined; onChange: (v?: string) => void; label: string }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground hover:border-primary/50">
      {value ? <img src={value} alt="" className="max-h-48 rounded-md" /> : <UiIcon name="upload" className="h-6 w-6" />}
      {value ? "Click to replace" : label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 5_000_000) { toast.error("Image must be under 5 MB"); return; }
          onChange(await readAsDataUrl(f));
        }}
      />
    </label>
  );
}

function Analyze() {
  const nav = useNavigate();
  const { caseId } = Route.useSearch();
  const run = useServerFn(analyzeJob);
  const [tab, setTab] = useState("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [resume, setResume] = useState("");
  const [resumeImage, setResumeImage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const payload = {
      url: tab === "url" && url ? url : undefined,
      text: text || undefined,
      images: tab === "image" && images.length ? images : undefined,
      resume: resume || undefined,
      resumeImage,
      caseId,
    };
    if (!payload.url && !payload.text && !payload.images) { toast.error("Add a job link, text or screenshot first."); return; }
    setBusy(true);
    try {
      const { id } = await run({ data: payload });
      nav({ to: "/report/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadResumeFile(f: File) {
    if (f.type.startsWith("image/")) return setResumeImage(await readAsDataUrl(f));
    if (f.type === "text/plain" || f.name.endsWith(".md")) return setResume(await f.text());
    toast.error("Upload a .txt or image of your resume, or paste the text.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Analyze an opportunity</h1>
      <p className="text-muted-foreground">Job posts, recruiter messages and offer letters all work.</p>
      {caseId && <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">Adding new evidence to an existing case - the report will be re-analyzed using all previous and new evidence.</p>}

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">1. The opportunity</h2>
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="text"><UiIcon name="document" className="mr-1.5 h-4 w-4" />Text</TabsTrigger>
            <TabsTrigger value="url"><UiIcon name="link" className="mr-1.5 h-4 w-4" />URL</TabsTrigger>
            <TabsTrigger value="image"><UiIcon name="image" className="mr-1.5 h-4 w-4" />Screenshot</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-2">
            <Input placeholder="https://company.com/careers/job/123" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Some sites (like LinkedIn) hide content behind login - paste the description below too for best results.</p>
          </TabsContent>
          <TabsContent value="image" className="space-y-3">
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((src, i) => (
                  <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-muted/40">
                    <img src={src} alt={`Evidence ${i + 1}`} className="h-32 w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 text-xs">Image {i + 1}</span>
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 hover:text-destructive"
                      onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    >
                      <UiIcon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < 10 && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground hover:border-primary/50">
                <UiIcon name="upload" className="h-6 w-6" />
                {images.length ? "Add more images to this case" : "Upload screenshots of the job, recruiter, emails, payment requests… (multiple allowed)"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    const ok = files.filter((f) => {
                      if (f.size > 5_000_000) { toast.error(`${f.name} is over 5 MB`); return false; }
                      return true;
                    });
                    const urls = await Promise.all(ok.map(readAsDataUrl));
                    setImages((p) => {
                      const next = [...p, ...urls];
                      if (next.length > 10) toast.error("Up to 10 images per case");
                      return next.slice(0, 10);
                    });
                  }}
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground">All images are analyzed together as one case.</p>
          </TabsContent>
        </Tabs>
        <Textarea
          className="mt-3 min-h-40"
          placeholder="Paste the job description, recruiter message (email / LinkedIn / WhatsApp / Telegram) or offer letter text…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2. Your resume <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
          <Label className="cursor-pointer text-sm text-primary hover:underline">
            Upload file
            <input type="file" accept="image/*,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && loadResumeFile(e.target.files[0])} />
          </Label>
        </div>
        <Textarea className="mt-3 min-h-40" placeholder="Paste your resume text…" value={resume} onChange={(e) => setResume(e.target.value)} />
        {resumeImage && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <img src={resumeImage} alt="" className="h-16 rounded" /> Resume image attached
            <button className="text-muted-foreground hover:text-destructive" onClick={() => setResumeImage(undefined)}>Remove</button>
          </div>
        )}
      </section>

      <Button size="lg" className="mt-6 w-full shadow-glow" disabled={busy} onClick={submit}>
        {busy ? (<><UiIcon name="loading" className="mr-2 h-4 w-4 animate-spin" />Analyzing evidence & skills…</>) : (<><UiIcon name="shield" className="mr-2 h-4 w-4" />Generate CareerShield report</>)}
      </Button>
    </div>
  );
}
