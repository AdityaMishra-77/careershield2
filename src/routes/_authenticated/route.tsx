import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);

  if (loading || !session)
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Brand />
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/dashboard" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>
              Dashboard
            </Link>
            <Link to="/analyze" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground bg-secondary" }}>
              Analyze
            </Link>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
