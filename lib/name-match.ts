// Fuzzy name matching for reconciling free-text Clover payer names against
// the roster. Pure + framework-free so it's unit-testable in isolation.
//
// Real-world cases this has to handle (see scratchpad test script):
//   "Paul Erikson"      -> "Paul Erickson"   (spelling variance)
//   "Andrew bleecker"   -> "Andrew Bleeker"  (case + spelling)
//   "Robert Luzynski"   -> "Rob Luzynski"    (given-name diminutive)
//   "Joseph Caram"      -> "Joey Caram"      (diminutive)
//   "DeMeritt"          -> "Vail DeMeritt"   (surname only)
//   "Matthew Patterson" -> "Matt Patt"       (both sides truncated/nicknamed)

import type { Player } from "@/lib/draft-types";

export type PlayerSuggestion = {
  player: Player;
  score: number; // 0..1
};

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type NameParts = { given: string; surname: string };

/** Last token is the surname; everything before it is the given name(s). */
function splitName(normalized: string): NameParts {
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return { given: "", surname: "" };
  if (tokens.length === 1) return { given: "", surname: tokens[0] };
  return { given: tokens.slice(0, -1).join(" "), surname: tokens[tokens.length - 1] };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Character trigrams, padded like pg_trgm so short strings still yield some. */
function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

function trigramSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/** Spelling-similarity blend, used both standalone and as a fallback. */
function spellingSimilarity(a: string, b: string): number {
  return 0.5 * trigramSimilarity(a, b) + 0.5 * levenshteinSimilarity(a, b);
}

/**
 * Score a single name token/phrase pair (e.g. two surnames, or two given
 * names). Prefix matches in either direction catch diminutives/truncation
 * ("rob" -> "robert", "patterson" -> "patt"); otherwise fall back to
 * spelling similarity to catch misspellings ("erikson" -> "erickson").
 */
function tokenScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 2 && b.length >= 2 && (a.startsWith(b) || b.startsWith(a))) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return 0.6 + 0.4 * ratio;
  }
  return spellingSimilarity(a, b);
}

/** First token of a (possibly multi-token) given-name string. */
function firstGivenToken(given: string): string {
  return given.split(" ").filter(Boolean)[0] ?? "";
}

export function scoreName(payerName: string, candidateName: string): number {
  const payerNorm = normalizeName(payerName);
  const candidateNorm = normalizeName(candidateName);
  if (!payerNorm || !candidateNorm) return 0;
  if (payerNorm === candidateNorm) return 1;

  const payer = splitName(payerNorm);
  const candidate = splitName(candidateNorm);

  const surnameScore = tokenScore(payer.surname, candidate.surname);
  const fullScore = spellingSimilarity(payerNorm, candidateNorm);

  const payerGiven = firstGivenToken(payer.given);
  const candidateGiven = firstGivenToken(candidate.given);

  if (!payerGiven) {
    // Surname-only payer text (e.g. a Clover entry with just a last name).
    return 0.65 * surnameScore + 0.35 * fullScore;
  }
  if (!candidateGiven) {
    // Roster player has no given name on file — fall back the same way.
    return 0.65 * surnameScore + 0.35 * fullScore;
  }

  const givenScore = tokenScore(payerGiven, candidateGiven);
  return 0.45 * surnameScore + 0.3 * givenScore + 0.25 * fullScore;
}

/**
 * Rank roster players by how well they match a free-text payer name.
 * Returns the top `limit` candidates, best first.
 */
export function suggestPlayers(payerName: string, players: Player[], limit = 5): PlayerSuggestion[] {
  if (!payerName?.trim()) return [];
  return players
    .map((player) => ({ player, score: scoreName(payerName, player.name) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name))
    .slice(0, limit);
}

export function confidenceLabel(score: number): string | null {
  if (score >= 0.75) return "likely match";
  if (score >= 0.55) return "possible match";
  return null;
}
