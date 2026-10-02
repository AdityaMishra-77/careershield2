import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(body: Record<string, unknown>) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (res.status === 429) throw new Error("Too many requests right now — please try again in a minute.");
  if (res.status === 402) throw new Error("AI credits are exhausted. Please add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return res.json();
}

async function callTool(messages: unknown[], name: string, parameters: unknown) {
  const json = await callAI({
    messages,
    tools: [{ type: "function", function: { name, description: name, parameters } }],
    tool_choice: { type: "function", function: { name } },
  });
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("The AI could not produce a report. Please try again with more detail.");
  return JSON.parse(args);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchUrl(url: string, max = 15000) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (CareerShield verification bot)" },
      redirect: "follow",
    });
    const html = await r.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 200) ?? "";
    return { ok: r.ok, status: r.status, url, finalUrl: r.url, title, text: stripHtml(html).slice(0, max) };
  } catch (e) {
    return { ok: false, status: 0, url, finalUrl: url, title: "", text: "", error: String(e).slice(0, 200) };
  }
}

// ---------- Web research (Firecrawl when connected) ----------
type SearchHit = { query: string; url: string; title: string; description: string };

async function webSearch(query: string): Promise<SearchHit[]> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return [];
  const gateway = key.startsWith("lovc_");
  const lovable = process.env["LOVABLE_API_KEY"];
  const endpoint = gateway ? "https://connector-gateway.lovable.dev/firecrawl/v2/search" : "https://api.firecrawl.dev/v2/search";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gateway) {
    if (!lovable) return [];
    headers.Authorization = `Bearer ${lovable}`;
    headers["X-Connection-Api-Key"] = key;
  } else headers.Authorization = `Bearer ${key}`;
  try {
    const r = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ query, limit: 5 }) });
    if (!r.ok) {
      console.error(`Search failed [${r.status}]: ${(await r.text()).slice(0, 300)}`);
      return [];
    }
    const j: any = await r.json();
    const list: any[] = Array.isArray(j?.data) ? j.data : (j?.data?.web ?? []);
    return list
      .filter((x) => x?.url)
      .map((x) => ({ query, url: String(x.url), title: String(x.title ?? ""), description: String(x.description ?? "").slice(0, 400) }));
  } catch (e) {
    console.error("Search error", e);
    return [];
  }
}

const GENERIC_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|rediffmail|zoho|gmx|mail|yandex)\./i;
const SHORTENERS = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|rb\.gy|cutt\.ly|is\.gd|shorturl\.at|forms\.gle|tiny\.cc)$/i;

// ---------- Schemas ----------
const extractionSchema = {
  type: "object",
  properties: {
    evidence_items: {
      type: "array",
      description: "One entry per submitted evidence item, in the same order and numbering",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          type: { type: "string", description: "e.g. Email screenshot, Job posting, Application form, WhatsApp message, SMS, Recruiter message, Offer letter, Payment request, LinkedIn profile, Other" },
          date: { type: "string", description: "Date visible in this evidence, or ''" },
          summary: { type: "string" },
          transcript: { type: "string", description: "Faithful OCR transcript of the visible text (max ~1500 chars)" },
          payment_request: { type: "boolean" },
        },
        required: ["index", "type", "date", "summary", "transcript", "payment_request"],
      },
    },
    entities: {
      type: "array",
      description: "Every extracted entity with the evidence numbers it appears in. Include conflicting values as separate entries.",
      items: {
        type: "object",
        properties: {
          field: { type: "string", description: "Company, Recruiter name, Recruiter email, Sender domain, Job title, Salary/stipend, Application URL, Website, Phone, University/college, Payment amount, Payment reason, Personal info requested, Date, Deadline, Selection claim, Certification/credit claim, Referral code, Other" },
          value: { type: "string" },
          sources: { type: "array", items: { type: "integer" } },
          conflict: { type: "boolean" },
        },
        required: ["field", "value", "sources", "conflict"],
      },
    },
    company: { type: "string", description: "Resolved company name across ALL evidence, or ''" },
    recruiter: { type: "string" },
    job_title: { type: "string" },
    sender_emails: { type: "array", items: { type: "string" } },
    urls: { type: "array", items: { type: "string" }, description: "All links/domains visible in the evidence" },
  },
  required: ["evidence_items", "entities", "company", "recruiter", "job_title", "sender_emails", "urls"],
};

const statusEnum = ["VERIFIED", "PARTIALLY VERIFIED", "NOT VERIFIED", "UNABLE TO VERIFY", "MISMATCH", "INCONSISTENT", "DETECTED", "NOT DETECTED"];
const srcArr = { type: "array", items: { type: "object", properties: { url: { type: "string" }, title: { type: "string" } }, required: ["url", "title"] } };
const intArr = { type: "array", items: { type: "integer" } };

const reportSchema = {
  type: "object",
  properties: {
    job: {
      type: "object",
      properties: {
        company: { type: "string" }, title: { type: "string" }, location: { type: "string" }, experience: { type: "string" },
        salary: { type: "string" }, employment_type: { type: "string" }, recruiter: { type: "string" }, contact_email: { type: "string" },
        application_url: { type: "string" }, job_id: { type: "string" }, responsibilities: { type: "array", items: { type: "string" } },
      },
      required: ["company", "title"],
    },
    assessment: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["VERIFIED", "PARTIALLY VERIFIED", "NEEDS VERIFICATION", "HIGH RISK", "UNABLE TO VERIFY"] },
        explanation: { type: "string", description: "Why this status was assigned, citing evidence numbers and verification" },
      },
      required: ["status", "explanation"],
    },
    payment: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["PAYMENT REQUEST DETECTED", "DEFERRED PAYMENT REQUEST DETECTED", "NO PAYMENT REQUEST DETECTED IN SUBMITTED EVIDENCE"] },
        summary: { type: "string" },
        requests: { type: "array", items: { type: "object", properties: { amount: { type: "string" }, reason: { type: "string" }, method: { type: "string" }, evidence: { type: "integer" }, stage: { type: "string" } }, required: ["amount", "reason", "evidence"] } },
      },
      required: ["state", "summary", "requests"],
    },
    timeline: {
      type: "array",
      items: { type: "object", properties: { date: { type: "string" }, stage: { type: "string", description: "e.g. INITIAL OUTREACH, APPLICATION, SELECTION MESSAGE, PAYMENT REQUEST, ADDITIONAL PAYMENT REQUEST, OFFER, INTERVIEW, FOLLOW-UP" }, description: { type: "string" }, evidence: intArr, payment_detected: { type: "boolean" } }, required: ["date", "stage", "description", "evidence", "payment_detected"] },
    },
    cross_findings: { type: "array", items: { type: "object", properties: { finding: { type: "string" }, evidence: intArr }, required: ["finding", "evidence"] } },
    verification: {
      type: "array",
      description: "One per area: Company, Recruiter, Email domain, Opportunity, Application URL, Compensation, Digital footprint",
      items: { type: "object", properties: { area: { type: "string" }, status: { type: "string", enum: statusEnum }, finding: { type: "string" }, sources: srcArr }, required: ["area", "status", "finding", "sources"] },
    },
    risk_indicators: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, severity: { type: "string", enum: ["high", "medium", "low"] }, evidence: intArr, examples: { type: "array", items: { type: "string" } } }, required: ["name", "description", "severity", "evidence"] },
    },
    positive: { type: "array", items: { type: "object", properties: { finding: { type: "string" }, source: { type: "string" } }, required: ["finding", "source"] } },
    unknowns: { type: "array", items: { type: "string" } },
    matrix: { type: "array", items: { type: "object", properties: { finding: { type: "string" }, status: { type: "string" }, evidence: { type: "string" }, source: { type: "string" } }, required: ["finding", "status", "evidence", "source"] } },
    public_reports: { type: "array", items: { type: "object", properties: { classification: { type: "string", enum: ["Confirmed public report", "Unverified online claim", "User-generated claim", "Official warning"] }, finding: { type: "string" }, url: { type: "string" }, title: { type: "string" } }, required: ["classification", "finding", "url", "title"] } },
    offer_terms: { type: "array", items: { type: "object", properties: { term: { type: "string" }, value: { type: "string" }, flag: { type: "boolean" }, note: { type: "string" } }, required: ["term", "value", "flag"] } },
    candidate: { type: "object", properties: { education: { type: "string" }, skills: { type: "array", items: { type: "string" } }, projects: { type: "array", items: { type: "string" } }, experience: { type: "string" } }, required: ["skills"] },
    skills: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, required: { type: "boolean" }, match: { type: "string", enum: ["strong", "partial", "gap"] }, priority: { type: "string", enum: ["Critical", "High", "Medium", "Preferred", "None"] }, reason: { type: "string" } }, required: ["name", "category", "required", "match", "priority", "reason"] },
    },
    roadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" }, duration: { type: "string" }, why: { type: "string" },
          resources: { type: "array", description: "Only well-known stable URLs (official docs, MDN, freeCodeCamp, roadmap.sh)", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" }, type: { type: "string" } }, required: ["title", "url", "type"] } },
          project: { type: "string" }, practice: { type: "array", items: { type: "string" } },
        },
        required: ["skill", "duration", "why", "resources", "project"],
      },
    },
    next_actions: { type: "array", items: { type: "string" } },
  },
  required: ["job", "assessment", "payment", "timeline", "cross_findings", "verification", "risk_indicators", "positive", "unknowns", "matrix", "public_reports", "candidate", "skills", "roadmap", "next_actions"],
};

const EXTRACT_SYSTEM = `You are CareerShield's evidence reader. Read EVERY submitted evidence item (OCR images carefully) and reconcile entities across all of them.
- If a value is missing in one item but present in another, use it, citing the item number.
- Only report what is actually visible. Never invent values.
- Record conflicting values (e.g. two different universities) as separate entities with conflict=true.
- payment_request=true only if that item explicitly asks the candidate to pay money (fee, deposit, purchase, transfer, UPI etc.).`;

const REPORT_SYSTEM = `You are CareerShield AI, an evidence-based career verification analyst for students and early-career job seekers.
You receive: (1) extracted evidence & entities from ALL submitted evidence items, (2) automated domain checks, (3) WEB RESEARCH results (may be empty), (4) an optional resume.

STRICT RULES
- NEVER fabricate websites, URLs, companies, recruiters, profiles, postings, reviews, complaints, search results, profile creation dates, payment requests or verification results. Every "sources" URL MUST be copied exactly from the WEB RESEARCH or DOMAIN CHECKS sections. If none support a check, status = "UNABLE TO VERIFY" with sources [] and say "Unable to verify."
- If WEB RESEARCH is empty, state that independent web research was not available for that check.
- Use the company resolved across ALL evidence. Only say "Company name not identified in submitted evidence" if absent from every item. Never say "Anonymous employer".
- Payment state: PAYMENT REQUEST DETECTED if the first/only relevant communication asks for money; DEFERRED PAYMENT REQUEST DETECTED if earlier items have no payment request and a later item does (also add risk indicator "Deferred Payment Request": "A payment request was detected in later communication after the initial recruitment/application stage." severity high when payment is a condition of starting); otherwise NO PAYMENT REQUEST DETECTED IN SUBMITTED EVIDENCE and summary must say "No payment request was detected in the submitted evidence. CareerShield cannot determine whether a later payment request may occur." — this does NOT imply legitimacy.
- Timeline: only events from actual evidence, ordered chronologically (use dates if visible, else evidence order). Never predict future events.
- Risk indicators are NOT proof of fraud. Consider: Recently Created Recruiter Profile (only if a creation date is reliably visible; else note "Profile age: Unable to verify" in unknowns), Unverified Connection Claim (custom "500+ connections" text), Generic/unrelated/lookalike email domain, Keyword-Heavy / Generic Job Post, Repetitive Recruiting Activity, Unprofessional Communication (quote examples), Urgency / Pressure Language (quote), Early Sensitive Information Request (say what & when), Off-Platform Pressure, Application Domain Mismatch, URL shortener, Potential Fake-Check / Reimbursement Pattern, Potential Company Impersonation, Limited Public Digital Footprint, Conflicting information. Only include indicators with real supporting evidence; put quoted text in examples.
- A real company does not make the opportunity genuine. If company exists but exact opportunity not found: "Company exists, but the exact opportunity could not be independently verified." Do not call it a ghost job.
- Compensation not corroborated: "Compensation claim could not be independently verified."
- Language: never say "scam", "definitely fake", "compromised account", "pay-to-intern scam" unless directly evidenced. Prefer "Payment request detected", "Sender–organization association could not be independently verified", "Opportunity could not be independently verified", "High-risk indicator detected".
- Public reports: classify honestly; random comments are User-generated claims, not confirmed.
- Show positive evidence, risk indicators and unknowns — never only negatives.
- Final status: VERIFIED (company, sender and exact opportunity verified, no risk), PARTIALLY VERIFIED, NEEDS VERIFICATION, HIGH RISK (strong risk such as payment as condition + unverified sender), UNABLE TO VERIFY. Explain why.
- Matrix: rows like Company identity, Recruiter association, Email domain, Payment request, Exact job, Compensation, Conflicting info — with Evidence "#n" and source.
- Skills: normalize names, match semantically. Priority: required gaps others depend on = Critical; other required gaps = High; partial = Medium; preferred gaps = Preferred; strong = None. Roadmap covers only gaps/partials, prerequisite-ordered. If no resume, candidate skills empty and all skills gap. If no job skills are identifiable, return empty skills/roadmap.
- Use "" for unknown strings. offer_terms only if an offer letter is present.`;

// ---------- Evidence types ----------
const evidenceInput = z.object({
  kind: z.enum(["image", "text", "url"]),
  path: z.string().max(500).optional(),
  content: z.string().max(30000).optional(),
  label: z.string().max(200).optional(),
});
type Evidence = z.infer<typeof evidenceInput> & { added_at: string };

async function toDataUrl(supabase: any, path: string) {
  const { data, error } = await supabase.storage.from("evidence").download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${data.type || "image/jpeg"};base64,${buf.toString("base64")}`;
}

function hostOf(u: string) {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const analyzeCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        analysisId: z.string().uuid().optional(),
        evidence: z.array(evidenceInput).max(15),
        resume: z.string().max(30000).optional(),
        resumeImage: z.string().max(8_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (const e of data.evidence) {
      if (e.kind === "image" && (!e.path || !e.path.startsWith(`${userId}/`))) throw new Error("Invalid evidence file.");
      if (e.kind !== "image" && !e.content?.trim()) throw new Error("Evidence is empty.");
    }

    let existing: Evidence[] = [];
    let resumeText = data.resume;
    if (data.analysisId) {
      const { data: row, error } = await supabase.from("analyses").select("evidence, resume_text").eq("id", data.analysisId).single();
      if (error || !row) throw new Error("Case not found");
      existing = (row.evidence as Evidence[]) ?? [];
      resumeText = resumeText ?? row.resume_text ?? undefined;
    }
    const now = new Date().toISOString();
    const all: Evidence[] = [...existing, ...data.evidence.map((e) => ({ ...e, added_at: now }))];
    if (!all.length) throw new Error("Add at least one piece of evidence.");
    if (all.filter((e) => e.kind === "image").length > 12) throw new Error("A case can hold up to 12 images.");

    // ---- Stage 1: read all evidence together ----
    const parts: Array<Record<string, unknown>> = [];
    const domainChecks: Array<Record<string, unknown>> = [];
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      const head = `EVIDENCE #${i + 1} (${e.kind}${e.label ? `, ${e.label}` : ""}, submitted ${e.added_at.slice(0, 10)})`;
      if (e.kind === "image") {
        const url = await toDataUrl(supabase, e.path!);
        parts.push({ type: "text", text: url ? `${head}:` : `${head}: (image could not be loaded)` });
        if (url) parts.push({ type: "image_url", image_url: { url } });
      } else if (e.kind === "url") {
        const f = await fetchUrl(e.content!);
        domainChecks.push({ submitted_url: e.content, final_url: f.finalUrl, status: f.status, https: f.finalUrl.startsWith("https://"), title: f.title });
        parts.push({ type: "text", text: `${head}: JOB URL ${e.content}\nFinal URL: ${f.finalUrl} (status ${f.status})\nPage text:\n${f.text || "(could not read page)"}` });
      } else {
        parts.push({ type: "text", text: `${head}:\n${e.content}` });
      }
    }

    const ext = await callTool(
      [{ role: "system", content: EXTRACT_SYSTEM }, { role: "user", content: parts }],
      "extract_evidence",
      extractionSchema,
    );

    // ---- Stage 2: automated domain checks + web research ----
    const company = String(ext.company || "").trim();
    const title = String(ext.job_title || "").trim();
    const recruiter = String(ext.recruiter || "").trim();
    const emails: string[] = (ext.sender_emails ?? []).slice(0, 4);
    const emailDomains = [...new Set(emails.map((m) => m.split("@")[1]?.toLowerCase()).filter(Boolean))] as string[];
    for (const d of emailDomains) {
      const generic = GENERIC_MAIL.test(d);
      const entry: Record<string, unknown> = { email_domain: d, generic_provider: generic };
      if (!generic) {
        const f = await fetchUrl(`https://${d}`, 1500);
        Object.assign(entry, { homepage_status: f.status, homepage_final_url: f.finalUrl, homepage_title: f.title, homepage_excerpt: f.text });
      }
      domainChecks.push(entry);
    }
    const linkHosts = [...new Set((ext.urls ?? []).slice(0, 6).map(hostOf).filter(Boolean))] as string[];
    for (const h of linkHosts) {
      if (domainChecks.some((c) => c.email_domain === h)) continue;
      const shortener = SHORTENERS.test(h);
      const f = await fetchUrl(`https://${h}`, 800);
      domainChecks.push({ link_domain: h, url_shortener: shortener, status: f.status, final_url: f.finalUrl, https: f.finalUrl.startsWith("https://"), title: f.title });
    }

    const queries: string[] = [];
    if (company) {
      queries.push(`${company} official website careers`);
      queries.push(`${company} ${title || "internship"}`.trim());
      queries.push(`${company} scam OR fraud OR complaint`);
    }
    if (recruiter) queries.push(`${recruiter} ${company} linkedin`.trim());
    for (const d of emailDomains.filter((d) => !GENERIC_MAIL.test(d)).slice(0, 1)) queries.push(`"${d}" scam OR complaint`);
    const researchAvailable = !!process.env["FIRECRAWL_API_KEY"];
    const hits = researchAvailable ? (await Promise.all(queries.slice(0, 5).map(webSearch))).flat() : [];

    // ---- Stage 3: final report ----
    const reportParts: Array<Record<string, unknown>> = [
      { type: "text", text: `TODAY: ${now.slice(0, 10)}\nSUBMITTED EVIDENCE COUNT: ${all.length}\n\nEXTRACTED EVIDENCE & ENTITIES:\n${JSON.stringify(ext)}` },
      { type: "text", text: `DOMAIN CHECKS (automated fetches):\n${JSON.stringify(domainChecks)}` },
      {
        type: "text",
        text: researchAvailable
          ? `WEB RESEARCH (search results; only these URLs may be cited):\n${JSON.stringify(hits)}`
          : "WEB RESEARCH: Not available (web search is not connected). Mark checks that need web research as UNABLE TO VERIFY.",
      },
    ];
    if (resumeText) reportParts.push({ type: "text", text: `CANDIDATE RESUME:\n${resumeText}` });
    if (data.resumeImage) {
      reportParts.push({ type: "text", text: "CANDIDATE RESUME (image):" });
      reportParts.push({ type: "image_url", image_url: { url: data.resumeImage } });
    }
    if (!resumeText && !data.resumeImage) reportParts.push({ type: "text", text: "No resume provided." });

    const result = await callTool(
      [{ role: "system", content: REPORT_SYSTEM }, { role: "user", content: reportParts }],
      "careershield_report",
      reportSchema,
    );

    // Guard against fabricated sources: keep only URLs we actually saw.
    const allowed = new Set<string>([
      ...hits.map((h) => h.url),
      ...domainChecks.flatMap((c) => [c.final_url, c.homepage_final_url, c.submitted_url].filter(Boolean) as string[]),
    ]);
    const allowedHosts = new Set([...allowed].map(hostOf));
    const ok = (u: string) => allowed.has(u) || allowedHosts.has(hostOf(u));
    for (const v of result.verification ?? []) v.sources = (v.sources ?? []).filter((s: any) => s?.url && ok(s.url));
    result.public_reports = (result.public_reports ?? []).filter((p: any) => p?.url && ok(p.url));

    result.evidence_items = ext.evidence_items ?? [];
    result.entities = ext.entities ?? [];
    result.research = { available: researchAvailable, queries: researchAvailable ? queries.slice(0, 5) : [], domain_checks: domainChecks };
    result.evaluated_count = all.length;
    // Back-compat for older UI pieces
    result.trust = { status: result.assessment?.status, summary: result.assessment?.explanation, evidence: [], verification_steps: [] };

    const jobInput = all.map((e, i) => `#${i + 1} ${e.kind}${e.kind === "image" ? "" : `: ${String(e.content).slice(0, 300)}`}`).join("\n");
    const fields = {
      title: result.job?.title || "Untitled case",
      company: result.job?.company || null,
      job_input: jobInput.slice(0, 4000),
      resume_text: resumeText?.slice(0, 30000) ?? null,
      result,
      evidence: all as any,
      updated_at: now,
    };
    if (data.analysisId) {
      const { error } = await supabase.from("analyses").update(fields).eq("id", data.analysisId);
      if (error) throw new Error(error.message);
      return { id: data.analysisId, count: all.length };
    }
    const { data: row, error } = await supabase.from("analyses").insert({ ...fields, user_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, count: all.length };
  });

// ---------- AI Career Coach (history persisted per user, isolated by RLS) ----------
export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ analysisId: z.string().uuid().nullable().optional(), message: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const analysisId = data.analysisId ?? null;

    let hq = supabase.from("coach_messages").select("role, content").order("created_at", { ascending: true }).limit(30);
    hq = analysisId ? hq.eq("analysis_id", analysisId) : hq.is("analysis_id", null);
    const { data: history } = await hq;

    let ctx: string;
    if (analysisId) {
      const { data: a, error } = await supabase.from("analyses").select("result, progress, resume_text").eq("id", analysisId).single();
      if (error || !a) throw new Error("Report not found");
      const r = a.result as any;
      ctx = JSON.stringify({
        job: r.job,
        assessment: r.assessment ?? r.trust,
        payment: r.payment,
        risk_indicators: r.risk_indicators?.map((x: any) => x.name),
        candidate: r.candidate,
        skills: r.skills,
        roadmap: r.roadmap?.map((s: any) => ({ skill: s.skill, duration: s.duration, project: s.project })),
        progress: a.progress,
      });
    } else {
      const { data: rows } = await supabase
        .from("analyses")
        .select("title, company, result, progress, resume_text, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      const latestResume = rows?.find((x) => x.resume_text)?.resume_text?.slice(0, 4000) ?? "";
      ctx = JSON.stringify({
        resume: latestResume,
        saved_jobs: (rows ?? []).map((x) => {
          const r = x.result as any;
          return {
            title: x.title,
            company: x.company,
            status: r.assessment?.status ?? r.trust?.status,
            gaps: (r.skills ?? []).filter((s: any) => s.match !== "strong").map((s: any) => s.name),
            roadmap: (r.roadmap ?? []).map((s: any) => s.skill),
            progress: x.progress,
          };
        }),
      });
    }

    const messages = [
      {
        role: "system",
        content: `You are the CareerShield AI Career Coach. Be practical, encouraging and concise (short markdown lists). Ground answers ONLY in this user's own CareerShield data. Never call an opportunity a scam without evidence; describe risk indicators instead.\nCONTEXT:\n${ctx}`,
      },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ];
    const json = await callAI({ messages });
    const reply = (json?.choices?.[0]?.message?.content as string) || "Sorry, I couldn't answer that.";
    await supabase.from("coach_messages").insert([
      { user_id: userId, analysis_id: analysisId, role: "user", content: data.message },
      { user_id: userId, analysis_id: analysisId, role: "assistant", content: reply },
    ]);
    return { reply };
  });
