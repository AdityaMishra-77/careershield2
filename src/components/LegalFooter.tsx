import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="no-print mx-auto flex max-w-6xl flex-wrap justify-center gap-6 border-t border-border px-5 py-6 text-xs text-muted-foreground">
      <Link to="/terms" className="underline underline-offset-4">Terms of Service</Link>
      <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>
    </footer>
  );
}