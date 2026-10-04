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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);
}

async function fetchUrl(url: string) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (CareerShield verification bot)" },
      redirect: "follow",
    });
    const finalUrl = r.url;
    const text = stripHtml(await r.text());
    return { ok: r.ok, status: r.status, finalUrl, text };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, text: "", error: String(e) };
  }
}

const reportSchema = {
  type: "object",
  properties: {
    job: {
      type: "object",
      properties: {
        company: { type: "string" },
        title: { type: "string" },
        location: { type: "string" },
        experience: { type: "string" },
        salary: { type: "string" },
        employment_type: { type: "string" },
        recruiter: { type: "string" },
        contact_email: { type: "string" },
        application_url: { type: "string" },
        job_id: { type: "string" },
        responsibilities: { type: "array", items: { type: "string" } },
      },
      required: ["company", "title"],
    },
    trust: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["Verified", "Partially Verified", "Unable to Verify", "Risk Indicators Detected"],
        },
        summary: { type: "string" },
        evidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signal: { type: "string" },
              category: { type: "string", enum: ["company", "recruiter", "job", "communication", "offer"] },
              level: { type: "string", enum: ["positive", "neutral", "caution", "risk"] },
              detail: { type: "string" },
            },
            required: ["signal", "category", "level", "detail"],
          },
        },
        verification_steps: { type: "array", items: { type: "string" } },
      },
      required: ["status", "summary", "evidence", "verification_steps"],
    },
    offer_terms: {
      type: "array",
      description: "Only if the input is an offer letter: extracted clauses (salary, bond, probation, notice...)",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          value: { type: "string" },
          flag: { type: "boolean" },
          note: { type: "string" },
        },
        required: ["term", "value", "flag"],
      },
    },
    candidate: {
      type: "object",
      properties: {
        education: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        projects: { type: "array", items: { type: "string" } },
        experience: { type: "string" },
      },
      required: ["skills"],
    },
    skills: {
      type: "array",
      description: "Every required and preferred job skill, matched against the candidate",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string", description: "e.g. Language, Framework, Database, Cloud, Tools, Concepts, Soft skill" },
          required: { type: "boolean" },
          match: { type: "string", enum: ["strong", "partial", "gap"] },
          priority: { type: "string", enum: ["Critical", "High", "Medium", "Preferred", "None"] },
          reason: { type: "string" },
        },
        required: ["name", "category", "required", "match", "priority", "reason"],
      },
    },
    roadmap: {
      type: "array",
      description: "Prerequisite-ordered learning steps covering the gaps",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          duration: { type: "string" },
          why: { type: "string" },
          resources: {
            type: "array",
            description: "Only well-known, stable URLs (official docs, freeCodeCamp, MDN, roadmap.sh, YouTube channels, Coursera)",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                type: { type: "string" },
              },
              required: ["title", "url", "type"],
            },
          },
          project: { type: "string", description: "A demonstrable mini-project" },
          practice: { type: "array", items: { type: "string" } },
        },
        required: ["skill", "duration", "why", "resources", "project"],
      },
    },
    next_actions: { type: "array", items: { type: "string" } },
    payment_status: {
      type: "object",
      description: "Payment request state across the complete case evidence timeline",
      properties: {
        state: { type: "string", enum: ["Payment Request Detected", "Deferred Payment Request Detected", "No Payment Request Detected In Submitted Evidence"] },
        detail: { type: "string" },
        sources: { type: "array", items: { type: "integer" } },
      },
      required: ["state", "detail", "sources"],
    },
    case_evidence: {
      type: "array",
      description: "One entry per piece of evidence in this case (previous + new), numbered as given",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          kind: { type: "string", description: "e.g. Email, Job Post, Recruiter Profile, WhatsApp, Payment Request, Offer Letter, Website, Text" },
          extracted_text: { type: "string", description: "Faithful OCR/extracted text of this evidence (max ~1500 chars)" },
        },
        required: ["number", "kind", "extracted_text"],
      },
    },
    entities: {
      type: "array",
      description: "Entities combined across ALL evidence, each with its source evidence numbers",
      items: {
        type: "object",
        properties: {
          field: { type: "string", description: "e.g. Company name, Recruiter name, Recruiter email, Sender domain, Job title, Salary/stipend, Application URL, Website, Phone, University, Payment amount, Payment reason, Registration fee, Training fee, Security deposit, Certificate fee, Processing fee, Interview fee, Other financial request, Personal info requested, Date, Deadline, Selection claim, Credit/certification claim, Referral code" },
          value: { type: "string" },
          sources: { type: "array", items: { type: "integer" } },
        },
        required: ["field", "value", "sources"],
      },
    },
    conflicts: {
      type: "array",
      description: "Fields where different evidence items give different values",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          message: { type: "string", description: 'e.g. "Conflicting university information detected."' },
          values: {
            type: "array",
            items: {
              type: "object",
              properties: { value: { type: "string" }, source: { type: "integer" } },
              required: ["value", "source"],
            },
          },
        },
        required: ["field", "message", "values"],
      },
    },
  },
  required: ["job", "trust", "candidate", "skills", "roadmap", "next_actions"],
};

const SYSTEM = `You are CareerShield AI, a career decision-support analyst for students and early-career job seekers.
Rules:
- Never declare a job simply "fake" or "genuine". Explain individual evidence signals.
- A job missing from a company website must NOT by itself mean fraud.
- Flag: payment/fee requests, urgency pressure, requests for Aadhaar/PAN/bank/OTP, free-mail recruiter addresses for big companies, domain mismatch, shortened/suspicious links, unrealistic salary, chat-only interviews, impersonation.
- If URL fetch data is given, use the final domain and page content as evidence.
- Normalize skill names (e.g. "ReactJS" → "React", "Postgres" → "PostgreSQL") and match semantically (e.g. Express experience partially covers REST APIs).
- Priority: required gaps that others depend on = Critical; other required gaps = High; partial = Medium; preferred gaps = Preferred; strong matches = None.
- Roadmap must be prerequisite-aware and cover only gaps/partials, focused on this job.
- If no resume is provided, leave candidate skills empty and mark all skills as gap.
- All evidence items belong to ONE case. Combine information across ALL of them (e.g. a company name in an email signature of Evidence #2 identifies the company for the whole case). Only say "Company name not identified in submitted evidence" if it appears in none.
- Never call the employer "Anonymous" because one image lacks a name. Search ALL evidence first; never guess or invent a company. If no evidence names it, set job.company to "" and state "Company name not identified in submitted evidence". If evidence items name different companies, add a conflict with message "Conflicting company information detected." and the evidence numbers. Always add a "Company name" entity with its source evidence.
- Payment timeline: order evidence by recruitment stage (application/initial outreach -> selection/progress -> later messages). If the earliest recruitment evidence has no payment request but later evidence does, set payment_status.state "Deferred Payment Request Detected" and add a trust.evidence item with signal "Deferred Payment Request", level "risk", category "offer", detail "A payment request was detected in later communication after the initial recruitment/application stage." citing evidence numbers. If a payment request exists otherwise, use "Payment Request Detected". If none, use "No Payment Request Detected In Submitted Evidence" with detail "No payment request was detected in the submitted evidence. CareerShield cannot determine whether a later payment request may occur." This does NOT mean the opportunity is legitimate. Never predict future scam events as fact.
- Fill case_evidence (one entry per evidence item, keeping the given numbers), entities (with source evidence numbers) and conflicts (never silently pick one of differing values).
- Use "" for unknown string fields. Only include offer_terms if the input looks like an offer letter.`;

export const analyzeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().max(2000).optional(),
        text: z.string().max(30000).optional(),
        image: z.string().max(8_000_000).optional(),
        images: z.array(z.string().max(8_000_000)).max(10).optional(),
        resume: z.string().max(30000).optional(),
        resumeImage: z.string().max(8_000_000).optional(),
        caseId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const images = [...(data.image ? [data.image] : []), ...(data.images ?? [])];
    if (!data.url && !data.text && images.length === 0) throw new Error("Provide a job URL, text or screenshot.");

    let prev: { result: any; job_input: string | null; resume_text: string | null } | null = null;
    if (data.caseId) {
      const { data: p, error: pe } = await context.supabase
        .from("analyses")
        .select("result, job_input, resume_text")
        .eq("id", data.caseId)
        .single();
      if (pe || !p) throw new Error("Case not found");
      prev = p as any;
    }
    const prevEvidence: Array<{ number: number; kind: string; extracted_text: string }> = prev?.result?.case_evidence ?? [];
    const offset = prevEvidence.length;

    const parts: Array<Record<string, unknown>> = [];
    let jobInput = "";
    if (prev) {
      parts.push({
        type: "text",
        text: `EXISTING CASE — PREVIOUS EVIDENCE (Evidence #1–#${offset}), already extracted:\n${prevEvidence
          .map((e) => `Evidence #${e.number} — ${e.kind}:\n${e.extracted_text}`)
          .join("\n\n") || prev.job_input || ""}\n\nNEW EVIDENCE below is numbered starting at #${offset + 1}. Re-analyze using ALL previous + new evidence as one case.`,
      });
    }
    if (data.url) {
      const f = await fetchUrl(data.url);
      jobInput += `URL: ${data.url}\n`;
      parts.push({
        type: "text",
        text: `JOB URL SUBMITTED: ${data.url}\nFetch status: ${f.status}\nFinal URL after redirects: ${f.finalUrl}\nPage text (may be empty if login-walled):\n${f.text || "(could not read page)"}`,
      });
    }
    if (data.text) {
      jobInput += data.text.slice(0, 2000);
      parts.push({ type: "text", text: `JOB DESCRIPTION / RECRUITER MESSAGE / OFFER LETTER TEXT:\n${data.text}` });
    }
    if (images.length === 1) {
      jobInput += jobInput ? "\n[+ screenshot]" : "[screenshot]";
      parts.push({ type: "text", text: `JOB SCREENSHOT — Evidence #${offset + 1} (read text via OCR):` });
      parts.push({ type: "image_url", image_url: { url: images[0] } });
    } else if (images.length > 1) {
      const tag = `[${images.length} screenshots]`;
      jobInput += jobInput ? `\n[+ ${images.length} screenshots]` : tag;
      parts.push({
        type: "text",
        text: `JOB EVIDENCE SCREENSHOTS — ${images.length} images that ALL belong to ONE SINGLE recruitment case (e.g. job post, recruiter profile, emails/chats, payment requests, application website). Read text from every image via OCR, then combine and cross-correlate the details (names, emails, domains, company, salary, links, requests) into one evidence set and produce ONE report. Note consistencies or contradictions between images as evidence signals, referencing the image number.`,
      });
      images.forEach((img, i) => {
        parts.push({ type: "text", text: `Image ${i + 1} of ${images.length} — Evidence #${offset + i + 1}:` });
        parts.push({ type: "image_url", image_url: { url: img } });
      });
    }
    const resumeText = data.resume || prev?.resume_text || undefined;
    if (resumeText) parts.push({ type: "text", text: `CANDIDATE RESUME:\n${resumeText}` });
    if (data.resumeImage) {
      parts.push({ type: "text", text: "CANDIDATE RESUME (image):" });
      parts.push({ type: "image_url", image_url: { url: data.resumeImage } });
    }
    if (!resumeText && !data.resumeImage) parts.push({ type: "text", text: "No resume provided." });

    const json = await callAI({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: parts },
      ],
      tools: [
        {
          type: "function",
          function: { name: "careershield_report", description: "Return the full CareerShield report", parameters: reportSchema },
        },
      ],
      tool_choice: { type: "function", function: { name: "careershield_report" } },
    });
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("The AI could not produce a report. Please try again with more detail.");
    const result = JSON.parse(args);
    result.case_id =
      prev?.result?.case_id ||
      "CS-" + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 6);

    if (prev && data.caseId) {
      const { error: ue } = await context.supabase
        .from("analyses")
        .update({
          title: result.job?.title || "Untitled job",
          company: result.job?.company || null,
          job_input: `${prev.job_input ?? ""}\n${jobInput}`.slice(0, 4000),
          resume_text: resumeText?.slice(0, 30000) ?? null,
          result,
        })
        .eq("id", data.caseId);
      if (ue) throw new Error(ue.message);
      return { id: data.caseId };
    }

    const { data: row, error } = await context.supabase
      .from("analyses")
      .insert({
        user_id: context.userId,
        title: result.job?.title || "Untitled job",
        company: result.job?.company || null,
        job_input: jobInput.slice(0, 4000),
        resume_text: data.resume?.slice(0, 30000) ?? null,
        result,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        analysisId: z.string().uuid(),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: a, error } = await context.supabase
      .from("analyses")
      .select("result, progress")
      .eq("id", data.analysisId)
      .single();
    if (error || !a) throw new Error("Report not found");
    const r = a.result as any;
    const ctx = JSON.stringify({
      job: r.job,
      trust: { status: r.trust?.status, summary: r.trust?.summary },
      candidate: r.candidate,
      skills: r.skills,
      roadmap: r.roadmap?.map((s: any) => ({ skill: s.skill, duration: s.duration, project: s.project })),
      progress: a.progress,
    });
    const json = await callAI({
      messages: [
        {
          role: "system",
          content: `You are the CareerShield AI Career Coach. Be practical, encouraging and concise (use short markdown lists). Ground every answer in this context about the candidate and target job:\n${ctx}`,
        },
        ...data.messages,
      ],
    });
    return { reply: (json?.choices?.[0]?.message?.content as string) || "Sorry, I couldn't answer that." };
  });
