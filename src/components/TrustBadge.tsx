import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  Verified: "bg-success/15 text-success border-success/30",
  "Partially Verified": "bg-info/15 text-info border-info/30",
  "Unable to Verify": "bg-warning/15 text-warning border-warning/30",
  "Risk Indicators Detected": "bg-destructive/15 text-destructive border-destructive/30",
};

export function TrustBadge({ status, className }: { status?: string; className?: string }) {
  if (!status) return null;
  return (
    <span className={cn("whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[status] ?? styles["Unable to Verify"], className)}>
      {status}
    </span>
  );
}
