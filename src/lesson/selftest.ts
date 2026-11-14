// One-click check of the explanation service: sends a small built-in step (no preset involved) and
// reports, in plain words, how far the request got. Used to diagnose a deployment.
import { guideHeaders } from "../guide/me.js";
import type { Card } from "./cards";
import type { LessonRequest, LessonResponse } from "./contract";
import { validateLesson } from "./validator";

export interface SelfTestReport {
  ok: boolean;
  /** One sentence the owner can act on. */
  headline: string;
  /** Step-by-step findings, safe to paste into a chat (never contains a key or password). */
  details: string[];
  /** The explanation that came back, when one passed. */
  sample?: { do: string; why: string; listen_for: string };
}

const STEP_ID = "selftest:filter";

export function selfTestRequest(cards: Card[]): LessonRequest | undefined {
  const card = cards.find((c) => c.id === "lowpass-cutoff-resonance") ?? cards[0];
  if (!card) return undefined;
  const lines = ["Switch Filter 1 on.", "Set Filter 1 Filter type to MG Low 24.", "Set Filter 1 Resonance to 30%."];
  return {
    difficulty: "beginner",
    steps: [{
      id: STEP_ID, stage: "filter", title: "Filter 1: switch on and set", goal: "Shape the tone with Filter 1", lines, notes: [],
      facts: [
        { id: "VoiceFilter0:kParamEnable", label: "Filter 1 Power", value: "On" },
        { id: "VoiceFilter0:kParamType", label: "Filter 1 Filter type", value: "MG Low 24" },
        { id: "VoiceFilter0:kParamReso", label: "Filter 1 Resonance", value: "30%" },
      ],
      cards: [{ id: card.id, title: card.title, body: card.body }],
    }],
    patchText: ["Filter 1: switch on and set", ...lines].join("\n"),
    patchTags: ["VoiceFilter", "kParamEnable", "kParamType", "kParamReso", "VoiceFilter.kParamReso"],
  };
}

export async function runSelfTest(cards: Card[], fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<SelfTestReport> {
  const req = selfTestRequest(cards);
  if (!req) return { ok: false, headline: "No knowledge cards are bundled, so there is nothing to explain from.", details: [] };
  const details: string[] = [];
  const started = now();
  let res: Response;
  try {
    res = await fetchImpl("/api/lesson", { method: "POST", headers: guideHeaders(), body: JSON.stringify(req) });
  } catch {
    return { ok: false, headline: "The request never reached the server.", details: ["Network error calling /api/lesson. Check your connection, or that the site is deployed with its api folder."] };
  }
  const seconds = ((now() - started) / 1000).toFixed(1);
  details.push(`Server answered with status ${res.status} after ${seconds} s.`);
  const body = (await res.json().catch(() => undefined)) as (LessonResponse & { error?: string; message?: string }) | undefined;

  if (!res.ok) {
    const why: Record<string, string> = {
      "not-configured": "The server has no working ANTHROPIC_API_KEY. Add it in the host's environment variables and redeploy.",
      locked: "The server has no APP_PASSWORD set, so it is refusing everyone.",
      unauthorized: "The server did not accept the site password for this request.",
      "rate-limited": "The Claude API is rate-limiting this key. Wait a minute and try again.",
      upstream: "The server reached the Claude API but the call failed.",
    };
    if (body?.message) details.push(`Server said: ${body.message}`);
    return { ok: false, headline: why[body?.error ?? ""] ?? `The server returned an error (${res.status}) before any explanation was written.`, details };
  }

  const result = body?.results?.[STEP_ID];
  if (!result) return { ok: false, headline: "The server replied, but without a result for the test step.", details };
  details.push(`The narrator was asked ${result.attempts} time(s).`);
  if (!result.ok) {
    details.push(...result.problems.map((p) => `Reason: ${p}`));
    const modelFailed = result.problems.some((p) => !/^"|param_refs|step_id/.test(p));
    return {
      ok: false, details,
      headline: modelFailed
        ? "The server could not get a usable reply from the Claude API. The reason is listed below (often a wrong or unfunded API key)."
        : "The Claude API works, but every attempt was rejected by the validator. The reasons are listed below.",
    };
  }
  const problems = validateLesson(req.steps[0]!, result.lesson, { text: req.patchText, tags: new Set(req.patchTags) });
  if (problems.length) {
    return { ok: false, headline: "The server accepted an explanation that this browser's validator rejects. The two copies of the validator disagree.", details: [...details, ...problems.map((p) => `Reason: ${p}`)] };
  }
  details.push("The explanation passed the validator on the server and again in this browser.");
  return {
    ok: true, details,
    headline: `Working: an explanation came back and passed validation${result.attempts > 1 ? ` on attempt ${result.attempts}` : " first time"}.`,
    sample: { do: result.lesson.do, why: result.lesson.why, listen_for: result.lesson.listen_for },
  };
}
