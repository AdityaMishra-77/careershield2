import type { SVGProps } from "react";

type IconName = "shield" | "document" | "target" | "roadmap" | "message" | "arrow" | "back" | "link" | "image" | "upload" | "close" | "plus" | "trash" | "download" | "external" | "project" | "neutral" | "caution" | "risk" | "positive" | "loading";
const paths: Record<IconName, React.ReactNode> = {
  shield: <><path d="M4 3h16v11l-8 7-8-7Z" /><path d="M8 8h8v6H8Z" /></>,
  document: <><path d="M5 2h10l4 4v16H5Z M15 2v5h4" /><path d="M8 11h8M8 15h8M8 19h5" /></>,
  target: <><rect x="3" y="3" width="18" height="18" /><rect x="7" y="7" width="10" height="10" /><path d="M10 12h4M12 10v4" /></>,
  roadmap: <><path d="M5 3v18M5 5h14v5H5M5 15h10v5H5" /><path d="M19 3v9M15 13v9" /></>,
  message: <path d="M3 3h18v14H9l-6 5Z M7 8h10M7 12h7" />,
  arrow: <path d="M3 12h17M13 5l7 7-7 7" />,
  back: <path d="M21 12H4M11 5l-7 7 7 7" />,
  link: <path d="m9 7 4-4h7v7l-4 4M15 17l-4 4H4v-7l4-4M8 16l8-8" />,
  image: <><rect x="3" y="3" width="18" height="18" /><path d="m3 17 6-7 5 6 3-4 4 5M16 7h2" /></>,
  upload: <path d="M3 15v6h18v-6M12 17V3M6 9l6-6 6 6" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
  plus: <path d="M3 12h18M12 3v18" />,
  trash: <path d="M3 5h18M8 5V2h8v3M5 5l1 17h12l1-17M10 9v9M14 9v9" />,
  download: <path d="M3 17v5h18v-5M12 2v14M6 10l6 6 6-6" />,
  external: <path d="M13 3h8v8M21 3l-12 12M9 3H3v18h18v-6" />,
  project: <path d="M3 7h7V3h11v11H10V7M7 7v14H3V7M14 7h3v3h-3Z" />,
  neutral: <><rect x="3" y="3" width="18" height="18" /><path d="M7 12h10" /></>,
  caution: <><path d="M12 2 23 21H1Z M12 8v6" /><path d="M12 17v1" /></>,
  risk: <><rect x="3" y="3" width="18" height="18" /><path d="m8 8 8 8M8 16l8-8" /></>,
  positive: <><rect x="3" y="3" width="18" height="18" /><path d="M12 7v10M7 12h10" /></>,
  loading: <path d="M21 12a9 9 0 1 1-9-9" />,
};

export function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>{paths[name]}</svg>;
}