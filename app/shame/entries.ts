/**
 * The Wall of Shame — league gag booking photos. Hand-edited; add a new
 * object to the top of the list and drop the photo in public/shame/.
 * Everything here is a joke among teammates, so keep it that way: no real
 * accusations, and the page stays noindexed (see page.tsx + app/robots.ts).
 *
 * **No names.** The placard carries the team and the charge; the photo is the
 * identification, and everyone in the room knows the face. A name next to a
 * fake charge is funny on the bench and not funny in a search for that guy —
 * so it isn't in the markup, the alt text, the filename, or this file. Photo
 * names are opaque for the same reason: /shame/<id>.jpg is fetchable on its
 * own, with or without a page around it.
 */
export type ShameEntry = {
  /** Opaque slug — also the photo name: public/shame/<id>.jpg. Never a name. */
  id: string;
  /** The team that has to answer for it. Shown on the placard. */
  team: string;
  /** The "charge" — the punchline. */
  charge: string;
  /** Booked on, ISO. */
  bookedOn: string;
  /** League week the card belongs to — the wall grows one card a week. */
  week: number;
};

export const SHAME_ENTRIES: ShameEntry[] = [
  {
    id: "w2-lg0427",
    team: "Toe Dragons",
    charge: "Moldy jock strap",
    bookedOn: "2026-09-16",
    week: 2,
  },
  {
    id: "w1-bk1189",
    team: "Trashers",
    charge: "Being too nice",
    bookedOn: "2026-09-14",
    week: 1,
  },
];
