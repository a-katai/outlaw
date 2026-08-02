import { randomBytes } from "crypto";

// no 0/O/1/I ambiguity — shared by admin/teams (generate-code) and
// admin/draft (force-pick rescue) so both mint codes the same way.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTeamCode(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}
