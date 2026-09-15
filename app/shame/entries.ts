/**
 * The Wall of Shame — league gag booking photos. Hand-edited; add a new
 * object to the top of the list and drop the photo in public/shame/.
 * Everything here is a joke among teammates, so keep it that way: no real
 * accusations, and the page stays noindexed (see page.tsx).
 */
export type ShameEntry = {
  /** Slug — also the photo name: public/shame/<id>.jpg */
  id: string;
  name: string;
  /** The "charge" — the punchline. */
  charge: string;
  /** Booked on, ISO. */
  bookedOn: string;
  /** League week the card belongs to — the wall grows one card a week. */
  week: number;
  team?: string;
};

export const SHAME_ENTRIES: ShameEntry[] = [
  {
    id: "jeff-wesley",
    name: "Jeff Wesley",
    charge: "Being too nice",
    bookedOn: "2026-09-14",
    week: 1,
  },
];
