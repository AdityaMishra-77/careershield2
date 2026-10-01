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
- Use "" for unknown string fields. Only include offer_terms if the input looks like an offer letter.`;

export const analyzeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().max(2000).optional(),
        text: z.string().max(30000).optional(),
        image: z.string().max(8_000_000).optional(),
        resume: z.string().max(30000).optional(),
        resumeImage: z.string().max(8_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.url && !data.text && !data.image) throw new Error("Provide a job URL, text or screenshot.");

    const parts: Array<Record<string, unknown>> = [];
    let jobInput = "";
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
    if (data.image) {
      jobInput += jobInput ? "\n[+ screenshot]" : "[screenshot]";
      parts.push({ type: "text", text: "JOB SCREENSHOT (read text via OCR):" });
      parts.push({ type: "image_url", image_url: { url: data.image } });
    }
    if (data.resume) parts.push({ type: "text", text: `CANDIDATE RESUME:\n${data.resume}` });
    if (data.resumeImage) {
      parts.push({ type: "text", text: "CANDIDATE RESUME (image):" });
      parts.push({ type: "image_url", image_url: { url: data.resumeImage } });
    }
    if (!data.resume && !data.resumeImage) parts.push({ type: "text", text: "No resume provided." });

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
