// Ported verbatim from fuelplan-frontend/src/api/sanitize.ts
/** Prompt-injection phrases stripped from free-text survey fields before they reach the Claude prompt. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|above|prior|earlier)/gi,
  /disregard\s+(all\s+)?(previous|above|prior|earlier)/gi,
  /you\s+are\s+now/gi,
  /act\s+as\s+(a\s+)?(?!meal|nutritionist|chef)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /system\s*prompt/gi,
  /reveal\s+(your|the)\s+(system|prompt|instructions?|key|code)/gi,
  /print\s+(your|the)\s+(system|prompt|instructions?)/gi,
  /what\s+(are|is)\s+your\s+instructions?/gi,
  /return\s+(your|the)\s+(system|prompt|api)/gi,
  /\bjailbreak\b/gi,
  /\bdan\b.*\bmode\b/gi,
  /activation\s*code/gi,
  /api\s*key/gi,
]

/**
 * Sanitizes a free-text survey field (diet prefs, disliked foods, cuisines)
 * before it's interpolated into the Claude prompt: truncates to 200 chars,
 * strips known prompt-injection phrases, then strips any character outside
 * a food-data-safe allowlist (letters/numbers/spaces/commas/hyphens/
 * slashes/parens/&/apostrophes).
 */
export function sanitizeInput(str: string | null | undefined): string {
  if (!str) return ''
  let s = str.slice(0, 200)
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[removed]')
  }
  s = s.replace(/[^\w\s,\-/().&']/g, '')
  return s.trim()
}

/**
 * Sanitizes a pasted recipe caption/text (from a share-sheet hand-off or
 * manual paste) before it's interpolated into the Claude prompt: strips the
 * same known prompt-injection phrases as `sanitizeInput`, but skips its
 * strict food-word character allowlist since captions legitimately contain
 * punctuation, emoji, and hashtags. Capped at 3000 chars to match the
 * backend's own `sanitizeUserContent` truncation ceiling (server.ts) so
 * client and server agree on the limit rather than the server silently
 * cutting off content the client thought it sent in full.
 */
export function sanitizeCaption(str: string | null | undefined): string {
  if (!str) return ''
  let s = str.slice(0, 3000)
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[removed]')
  }
  return s.trim()
}
