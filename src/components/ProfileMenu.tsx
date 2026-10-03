import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, LogOut, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu({ user }: { user: User }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta["full_name"] || meta["name"] || user.email?.split("@")[0] || "Account";
  const email = user.email ?? "";
  const avatar = meta["avatar_url"] || meta["picture"];
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  async function openCoach() {
    const { data } = await supabase
      .from("analyses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await nav({ to: "/report/$id", params: { id: data.id }, hash: "coach" });
      setTimeout(() => document.getElementById("coach")?.scrollIntoView({ behavior: "smooth" }), 300);
    } else {
      toast.info("Run your first analysis to unlock the AI Career Coach.");
      nav({ to: "/analyze" });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Open profile menu" className="ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8">
            {avatar && <AvatarImage src={avatar} alt={name} referrerPolicy="no-referrer" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => nav({ to: "/dashboard" })}>
          <LayoutDashboard className="mr-2 h-4 w-4" />Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openCoach}>
          <MessageSquare className="mr-2 h-4 w-4" />AI Career Coach
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
