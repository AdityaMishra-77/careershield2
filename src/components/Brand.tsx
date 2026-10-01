import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
        <ShieldCheck className="h-5 w-5" />
      </span>
      CareerShield <span className="text-primary">AI</span>
    </Link>
  );
}
