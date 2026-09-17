/**
 * The Wall of Shame — league gag booking photos. Hand-edited; add a new
 * object to the top of the list and drop the photo in public/shame/.
 * Everything here is a joke among teammates, so keep it that way: no real
 * accusations, and the page stays noindexed (see page.tsx + app/robots.ts).
 *
 * Names never reach an indexed page. `/shame` is noindexed and disallowed and
 * is the only place they render; the home strip gets `redact()`ed copies, so
 * a guy's name next to a fake charge can't turn up in a search for him. Photo
 * filenames are opaque for the same reason — `/shame/<id>.jpg` is fetchable on
 * its own, with or without a page around it.
 */
export type ShameEntry = {
  /** Opaque slug — also the photo name: public/shame/<id>.jpg. Never a name. */
  id: string;
  /** Rendered on /shame only. Omitted everywhere that search engines look. */
  name?: string;
  /** The "charge" — the punchline. */
  charge: string;
  /** Booked on, ISO. */
  bookedOn: string;
  /** League week the card belongs to — the wall grows one card a week. */
  week: number;
  team?: string;
};

/** Strip the name for any surface that gets indexed. The card falls back to the team. */
export function redact(entries: ShameEntry[]): ShameEntry[] {
  return entries.map(({ name: _name, ...rest }) => rest);
}

export const SHAME_ENTRIES: ShameEntry[] = [
  {
    id: "w2-lg0427",
    name: "Tony Katai",
    charge: "Moldy jock strap",
    bookedOn: "2026-09-16",
    week: 2,
    team: "Toe Dragons",
  },
  {
    id: "w1-bk1189",
    name: "Jeff Wesley",
    charge: "Being too nice",
    bookedOn: "2026-09-14",
    week: 1,
    team: "Trashers",
  },
];
