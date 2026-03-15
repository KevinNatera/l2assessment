import Groq from 'groq-sdk';

/**
 * LLM Helper — structured triage via Groq API
 *
 * Changes from original:
 *  - Single structured prompt returns ALL fields (category, urgency, confidence,
 *    routing, action, reasoning) in one JSON response instead of three separate
 *    systems with no shared context.
 *  - Urgency is determined by the LLM from full message context — not a
 *    keyword/punctuation/time-of-day rule scorer that produced inverted results
 *    (e.g. all-caps was penalized, weekend messages were de-prioritized).
 *  - Strict JSON output — no keyword-scanning of the model's own free-text
 *    reasoning to guess the category after the fact.
 *  - API failures throw a visible ApiError instead of silently returning mock data.
 *  - Confidence score (0–100) returned so the UI can flag uncertain results.
 *  - Streaming variant available for a more responsive UX.
 */

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a customer support triage AI for Relay AI, a SaaS customer operations platform.
Analyze the customer message and return ONLY a valid JSON object — no markdown fences, no explanation, no preamble.

JSON schema (all fields required):
{
  "category": one of ["Technical Issue", "Billing & Subscription", "Feature Request", "Account Management", "General Inquiry", "Positive Feedback", "Spam / Other"],
  "urgency": one of ["Critical", "High", "Medium", "Low"],
  "urgency_reason": "max 12 words explaining why this urgency level",
  "confidence": integer 0-100 representing how confident you are in this categorization,
  "route_to": one of ["Engineering On-Call", "Technical Support", "Billing Team", "Product Team", "Customer Success", "No Action Needed"],
  "routing_reason": "one sentence — why this team is the right owner",
  "recommended_action": "one concrete sentence the support agent should do next",
  "reasoning": "2-3 sentences covering tone, context signals, and priority rationale"
}

Urgency guide — base this on the MEANING of the message, not punctuation or length:
- Critical: system/service down, data loss, security breach, blocks all users
- High: significant feature broken, deadline pressure stated, multiple users affected
- Medium: single user issue with workaround, billing discrepancy, moderate blocker
- Low: question, feedback, feature request, compliment, non-blocking issue

Key rules:
- All-caps ("SERVER IS DOWN") signals distress — treat as Critical, not Low.
- A polite tone does not reduce urgency. "Please" and "thank you" are irrelevant to severity.
- A question mark does not reduce urgency.
- "Not urgent, but the server went down last week" is Low — respect explicit customer framing.
- Weekend or after-hours timing has no bearing on the customer's actual problem severity.`;

/**
 * Analyze a message — returns a fully structured triage result.
 * Throws ApiError on any failure so the UI can display it explicitly.
 *
 * @param {string} message
 * @returns {Promise<TriageResult>}
 */
export async function analyzeMessage(message) {
  if (!import.meta.env.VITE_GROQ_API_KEY) {
    throw new ApiError(
      'No API key configured. Add VITE_GROQ_API_KEY to your .env.local file.'
    );
  }

  let raw;
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    });
    raw = response.choices[0].message.content;
  } catch (err) {
    throw new ApiError(`Groq API error: ${err.message}`);
  }

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new ApiError(
      `Model returned unparseable response. Raw output: ${raw?.slice(0, 200)}`
    );
  }
}

/**
 * Streaming variant — calls onChunk(accumulatedText) as tokens arrive,
 * then resolves with the full parsed TriageResult once complete.
 *
 * @param {string} message
 * @param {(chunk: string) => void} onChunk
 * @returns {Promise<TriageResult>}
 */
export async function analyzeMessageStream(message, onChunk) {
  if (!import.meta.env.VITE_GROQ_API_KEY) {
    throw new ApiError(
      'No API key configured. Add VITE_GROQ_API_KEY to your .env.local file.'
    );
  }

  let fullText = '';
  try {
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullText += delta;
      if (onChunk) onChunk(fullText);
    }
  } catch (err) {
    throw new ApiError(`Groq API error: ${err.message}`);
  }

  try {
    const cleaned = fullText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new ApiError(
      `Stream produced unparseable response. Raw output: ${fullText?.slice(0, 200)}`
    );
  }
}

/** Typed error so the UI can distinguish API failures from code bugs */
export class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * @typedef {Object} TriageResult
 * @property {string} category
 * @property {"Critical"|"High"|"Medium"|"Low"} urgency
 * @property {string} urgency_reason
 * @property {number} confidence
 * @property {string} route_to
 * @property {string} routing_reason
 * @property {string} recommended_action
 * @property {string} reasoning
 */
