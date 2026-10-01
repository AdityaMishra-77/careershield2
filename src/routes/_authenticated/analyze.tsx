import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Link2, FileText, Image as ImageIcon, Loader2, ShieldCheck, Upload } from "lucide-react";
import { analyzeJob } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/analyze")({
  head: () => ({ meta: [{ title: "Analyze a job — CareerShield AI" }, { name: "description", content: "Submit a job and your resume for analysis." }] }),
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
      {value ? <img src={value} alt="" className="max-h-48 rounded-md" /> : <Upload className="h-6 w-6" />}
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
  const run = useServerFn(analyzeJob);
  const [tab, setTab] = useState("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>();
  const [resume, setResume] = useState("");
  const [resumeImage, setResumeImage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const payload = {
      url: tab === "url" && url ? url : undefined,
      text: text || undefined,
      image: tab === "image" ? image : undefined,
      resume: resume || undefined,
      resumeImage,
    };
    if (!payload.url && !payload.text && !payload.image) { toast.error("Add a job link, text or screenshot first."); return; }
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

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">1. The opportunity</h2>
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="text"><FileText className="mr-1.5 h-4 w-4" />Text</TabsTrigger>
            <TabsTrigger value="url"><Link2 className="mr-1.5 h-4 w-4" />URL</TabsTrigger>
            <TabsTrigger value="image"><ImageIcon className="mr-1.5 h-4 w-4" />Screenshot</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-2">
            <Input placeholder="https://company.com/careers/job/123" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Some sites (like LinkedIn) hide content behind login — paste the description below too for best results.</p>
          </TabsContent>
          <TabsContent value="image">
            <ImagePick value={image} onChange={setImage} label="Upload a screenshot of the job or message" />
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
        {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing evidence & skills…</>) : (<><ShieldCheck className="mr-2 h-4 w-4" />Generate CareerShield report</>)}
      </Button>
    </div>
  );
}
