import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UiIcon } from "@/components/UiIcon";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrustBadge } from "@/components/TrustBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - CareerShield AI" }, { name: "description", content: "Your saved job reports and learning progress." }, { property: "og:title", content: "Dashboard - CareerShield AI" }, { property: "og:description", content: "Your saved job reports and learning progress." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,title,company,result,progress,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("Delete this report and its uploaded data?")) return;
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["analyses"] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your saved jobs</h1>
          <p className="text-muted-foreground">Reports, skill gaps and roadmap progress.</p>
        </div>
        <Button asChild>
          <Link to="/analyze">
            <UiIcon name="plus" className="mr-1 h-4 w-4" /> New analysis
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-10 text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No reports yet. Analyze your first job to get started.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {data.map((a) => {
            const r = a.result as any;
            const steps = (r.roadmap ?? []).length;
            const done = Object.values((a.progress as Record<string, string>) ?? {}).filter((v) => v === "Completed").length;
            const gaps = (r.skills ?? []).filter((s: any) => s.match !== "strong").length;
            return (
              <div key={a.id} className="group relative rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50">
                <Link to="/report/$id" params={{ id: a.id }} className="absolute inset-0" aria-label={a.title} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">{a.company || "Unknown company"}</p>
                  </div>
                  <TrustBadge status={r.trust?.status} />
                </div>
                <div className="mt-4 flex gap-6 text-sm">
                  <span><b>{gaps}</b> <span className="text-muted-foreground">gaps</span></span>
                  <span><b>{done}/{steps}</b> <span className="text-muted-foreground">roadmap done</span></span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${steps ? (done / steps) * 100 : 0}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                  <button onClick={() => remove(a.id)} className="relative z-10 rounded p-1 hover:text-destructive" aria-label="Delete">
                    <UiIcon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
