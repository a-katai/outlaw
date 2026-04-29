export type TeamStanding = {
  team: string;
  gp: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  pct: string;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
};

export type SkaterStat = {
  player: string;
  team: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
};

type TeamColorPalette = {
  background: string;
  text: string;
  border: string;
};

export const standings: TeamStanding[] = [
  {
    team: "Toe Dragons",
    gp: 24,
    wins: 16,
    losses: 5,
    ties: 3,
    points: 35,
    pct: ".729",
    goalsFor: 123,
    goalsAgainst: 83,
    diff: 40,
  },
  {
    team: "Ghost Pirates",
    gp: 24,
    wins: 14,
    losses: 6,
    ties: 4,
    points: 32,
    pct: ".667",
    goalsFor: 116,
    goalsAgainst: 103,
    diff: 13,
  },
  {
    team: "Wednesday Knights",
    gp: 24,
    wins: 10,
    losses: 10,
    ties: 4,
    points: 24,
    pct: ".500",
    goalsFor: 118,
    goalsAgainst: 128,
    diff: -10,
  },
  {
    team: "Tank Fillers",
    gp: 24,
    wins: 7,
    losses: 12,
    ties: 5,
    points: 19,
    pct: ".396",
    goalsFor: 91,
    goalsAgainst: 99,
    diff: -8,
  },
  {
    team: "Trashers",
    gp: 24,
    wins: 4,
    losses: 18,
    ties: 2,
    points: 10,
    pct: ".208",
    goalsFor: 106,
    goalsAgainst: 141,
    diff: -35,
  },
];

export const topSkaters: SkaterStat[] = [
  { player: "Larry Rowe", team: "Toe Dragons", gamesPlayed: 23, goals: 33, assists: 31, points: 64 },
  { player: "Nic Laburn", team: "Wednesday Knights", gamesPlayed: 24, goals: 32, assists: 23, points: 55 },
  { player: "Brett Best", team: "Trashers", gamesPlayed: 25, goals: 36, assists: 15, points: 50 },
  { player: "Dawson Richard", team: "Wednesday Knights", gamesPlayed: 22, goals: 24, assists: 25, points: 49 },
  { player: "Adam Black", team: "Ghost Pirates", gamesPlayed: 22, goals: 29, assists: 18, points: 47 },
  { player: "Eric Leuenberger", team: "Toe Dragons", gamesPlayed: 23, goals: 32, assists: 14, points: 46 },
  { player: "John Hunter", team: "Trashers", gamesPlayed: 25, goals: 30, assists: 16, points: 46 },
  { player: "Blake Best", team: "Trashers", gamesPlayed: 22, goals: 18, assists: 28, points: 46 },
  { player: "Cam Czapksi", team: "Ghost Pirates", gamesPlayed: 21, goals: 21, assists: 22, points: 43 },
  { player: "Alex Chartrand", team: "Ghost Pirates", gamesPlayed: 24, goals: 19, assists: 21, points: 40 },
  { player: "Zach Shencopp", team: "Wednesday Knights", gamesPlayed: 23, goals: 19, assists: 20, points: 39 },
  { player: "Shawn Hoffman", team: "Wednesday Knights", gamesPlayed: 24, goals: 18, assists: 15, points: 33 },
  { player: "Brendan Collier", team: "Toe Dragons", gamesPlayed: 19, goals: 15, assists: 16, points: 31 },
  { player: "Taharka Yi", team: "Toe Dragons", gamesPlayed: 26, goals: 16, assists: 14, points: 30 },
  { player: "Andy Golota", team: "Toe Dragons", gamesPlayed: 24, goals: 17, assists: 12, points: 29 },
  { player: "Jake Mazur", team: "Ghost Pirates", gamesPlayed: 24, goals: 8, assists: 21, points: 29 },
  { player: "Patrick Campbell", team: "Toe Dragons", gamesPlayed: 23, goals: 4, assists: 24, points: 28 },
  { player: "Joey Aram", team: "Toe Dragons", gamesPlayed: 27, goals: 5, assists: 18, points: 23 },
  { player: "Dominic Cappello", team: "Trashers", gamesPlayed: 17, goals: 10, assists: 12, points: 22 },
  { player: "E Strebe", team: "Ghost Pirates", gamesPlayed: 26, goals: 10, assists: 12, points: 22 },
  { player: "Jake Wesley", team: "Trashers", gamesPlayed: 25, goals: 9, assists: 12, points: 21 },
  { player: "Tim Tomkowiak", team: "Wednesday Knights", gamesPlayed: 26, goals: 8, assists: 11, points: 19 },
  { player: "Pete Miller", team: "Ghost Pirates", gamesPlayed: 27, goals: 8, assists: 10, points: 18 },
  { player: "Andy Newly", team: "Ghost Pirates", gamesPlayed: 25, goals: 4, assists: 10, points: 18 },
  { player: "Ian Teal", team: "Wednesday Knights", gamesPlayed: 20, goals: 7, assists: 10, points: 17 },
  { player: "Ryan Kravetz", team: "Trashers", gamesPlayed: 21, goals: 3, assists: 14, points: 17 },
  { player: "Tim Hunter", team: "Toe Dragons", gamesPlayed: 20, goals: 3, assists: 14, points: 17 },
  { player: "Dan Mckean", team: "Ghost Pirates", gamesPlayed: 24, goals: 2, assists: 15, points: 17 },
  { player: "Alex Winquist", team: "Trashers", gamesPlayed: 23, goals: 4, assists: 12, points: 16 },
  { player: "Adam Mccormick", team: "Wednesday Knights", gamesPlayed: 21, goals: 6, assists: 10, points: 16 },
  { player: "Justin Marchand", team: "Wednesday Knights", gamesPlayed: 22, goals: 2, assists: 14, points: 16 },
  { player: "David Snyder", team: "Ghost Pirates", gamesPlayed: 21, goals: 9, assists: 6, points: 15 },
  { player: "Tony Katai", team: "Wednesday Knights", gamesPlayed: 19, goals: 6, assists: 8, points: 14 },
  { player: "Aaron Shencopp", team: "Wednesday Knights", gamesPlayed: 24, goals: 3, assists: 12, points: 15 },
  { player: "Matty Walters", team: "Sub", gamesPlayed: 4, goals: 8, assists: 6, points: 14 },
  { player: "Scott Campbell", team: "Toe Dragons", gamesPlayed: 15, goals: 7, assists: 2, points: 13 },
  { player: "Noah Jacobs", team: "Sub", gamesPlayed: 5, goals: 7, assists: 5, points: 12 },
  { player: "Rob Lozinski", team: "Sub", gamesPlayed: 21, goals: 6, assists: 7, points: 12 },
  { player: "Chris Puzzoli", team: "Krushers", gamesPlayed: 25, goals: 7, assists: 4, points: 11 },
  { player: "Matt Patt", team: "Wednesday Knights", gamesPlayed: 19, goals: 1, assists: 10, points: 11 },
  { player: "Nick Modas", team: "Toe Dragons", gamesPlayed: 17, goals: 7, assists: 3, points: 10 },
  { player: "Tony Cantu", team: "Sub", gamesPlayed: 22, goals: 3, assists: 7, points: 10 },
  { player: "Marty Agents", team: "Sub", gamesPlayed: 21, goals: 1, assists: 9, points: 10 },
  { player: "Tim Foley", team: "Sub", gamesPlayed: 15, goals: 6, assists: 3, points: 9 },
  { player: "Joey Sova", team: "Sub", gamesPlayed: 5, goals: 3, assists: 6, points: 9 },
  { player: "Vincent Azzopardi", team: "Sub", gamesPlayed: 4, goals: 2, assists: 7, points: 9 },
  { player: "Dylan Lemp", team: "Sub", gamesPlayed: 25, goals: 3, assists: 4, points: 7 },
  { player: "Trevor Lemp", team: "Sub", gamesPlayed: 19, goals: 2, assists: 5, points: 7 },
  { player: "Patrick Mcelwee", team: "Ghost Pirates", gamesPlayed: 26, goals: 2, assists: 5, points: 7 },
  { player: "Jakob Edinger", team: "Sub", gamesPlayed: 21, goals: 1, assists: 6, points: 7 },
  { player: "John Parrish", team: "Sub", gamesPlayed: 1, goals: 2, assists: 3, points: 5 },
  { player: "Jeff Wesley", team: "Trashers", gamesPlayed: 22, goals: 2, assists: 3, points: 5 },
  { player: "Don Martin", team: "Sub", gamesPlayed: 1, goals: 1, assists: 4, points: 5 },
  { player: "Steve Schultz", team: "Trashers", gamesPlayed: 16, goals: 0, assists: 5, points: 5 },
  { player: "Val DeMeritt", team: "Trashers", gamesPlayed: 18, goals: 0, assists: 5, points: 5 },
  { player: "Nick Kent", team: "Sub", gamesPlayed: 3, goals: 3, assists: 1, points: 4 },
  { player: "Jake Howard", team: "Sub", gamesPlayed: 5, goals: 2, assists: 2, points: 4 },
  { player: "Riley Whelan", team: "Sub", gamesPlayed: 23, goals: 2, assists: 2, points: 4 },
  { player: "Sam Genetti", team: "Wednesday Knights", gamesPlayed: 10, goals: 0, assists: 4, points: 4 },
  { player: "Mike Glenn", team: "Toe Dragons", gamesPlayed: 12, goals: 0, assists: 4, points: 4 },
  { player: "Rick Mazur", team: "Ghost Pirates", gamesPlayed: 21, goals: 0, assists: 4, points: 4 },
  { player: "Jacob Porrotti", team: "Sub", gamesPlayed: 2, goals: 3, assists: 0, points: 3 },
  { player: "Dan Goodwin", team: "Sub", gamesPlayed: 3, goals: 3, assists: 0, points: 3 },
  { player: "Ethan Marcola", team: "Sub", gamesPlayed: 2, goals: 2, assists: 1, points: 3 },
  { player: "Gage Worden", team: "Sub", gamesPlayed: 1, goals: 1, assists: 2, points: 3 },
  { player: "Mitch Kellerman", team: "Sub", gamesPlayed: 4, goals: 1, assists: 2, points: 3 },
  { player: "Kyle Shmunk", team: "Sub", gamesPlayed: 6, goals: 1, assists: 2, points: 3 },
  { player: "Pat Blake", team: "Sub", gamesPlayed: 2, goals: 0, assists: 3, points: 3 },
  { player: "Jay Welch", team: "Sub", gamesPlayed: 5, goals: 0, assists: 3, points: 3 },
  { player: "Mike Grabowski", team: "Sub", gamesPlayed: 13, goals: 0, assists: 3, points: 3 },
  { player: "John Sturza", team: "Sub", gamesPlayed: 2, goals: 2, assists: 0, points: 2 },
  { player: "Bryan Klemett", team: "Sub", gamesPlayed: 10, goals: 2, assists: 0, points: 2 },
  { player: "Kevin Jankovich", team: "Sub", gamesPlayed: 1, goals: 1, assists: 1, points: 2 },
  { player: "Jared Bader", team: "Sub", gamesPlayed: 2, goals: 1, assists: 1, points: 2 },
  { player: "Joel Brodzinski", team: "Sub", gamesPlayed: 2, goals: 1, assists: 1, points: 2 },
  { player: "Sean Hnook", team: "Sub", gamesPlayed: 2, goals: 1, assists: 1, points: 2 },
  { player: "Jason Cools", team: "Sub", gamesPlayed: 4, goals: 1, assists: 1, points: 2 },
  { player: "Nathan Salzeider", team: "Sub", gamesPlayed: 4, goals: 1, assists: 1, points: 2 },
  { player: "Jimmy Bonventre", team: "Sub", gamesPlayed: 19, goals: 1, assists: 1, points: 2 },
  { player: "Jeremy Wimmer", team: "Sub", gamesPlayed: 1, goals: 0, assists: 2, points: 2 },
  { player: "Adam Johns", team: "Sub", gamesPlayed: 3, goals: 0, assists: 2, points: 2 },
  { player: "Travis Mcgrath", team: "Toe Dragons", gamesPlayed: 1, goals: 0, assists: 2, points: 2 },
  { player: "Eric Keljo", team: "Sub", gamesPlayed: 1, goals: 1, assists: 0, points: 1 },
  { player: "Kurt Latshaw", team: "Sub", gamesPlayed: 4, goals: 1, assists: 0, points: 1 },
  { player: "Brandon Rodriguez", team: "Sub", gamesPlayed: 1, goals: 0, assists: 1, points: 1 },
  { player: "Drake Mclaughlin", team: "Sub", gamesPlayed: 1, goals: 0, assists: 1, points: 1 },
  { player: "Jake Tresnak", team: "Sub", gamesPlayed: 4, goals: 0, assists: 1, points: 1 },
  { player: "Joseph Marek", team: "Sub", gamesPlayed: 1, goals: 0, assists: 1, points: 1 },
  { player: "Matt Zaremba", team: "Sub", gamesPlayed: 1, goals: 0, assists: 1, points: 1 },
  { player: "Rick Aiken", team: "Sub", gamesPlayed: 5, goals: 0, assists: 1, points: 1 },
  { player: "Wilson Phillips", team: "Trashers", gamesPlayed: 24, goals: 0, assists: 1, points: 1 },
];

export const latestResult = {
  date: "Wednesday, April 22",
  title: "Week 34 Play-In (4th vs 5th)",
  summary: "Trashers 9 - 3 Tank Fillers",
};

export const upcomingMatchups = [
  {
    date: "Next Week",
    home: "Toe Dragons",
    away: "Trashers",
    notes: "Playoff Semifinal",
  },
  {
    date: "Next Week",
    home: "Ghost Pirates",
    away: "Wednesday Knights",
    notes: "Playoff Semifinal",
  },
];

const fallbackTeamColors: TeamColorPalette = {
  background: "#f3f4f6",
  text: "#111827",
  border: "#d1d5db",
};

const teamColors: Record<string, TeamColorPalette> = {
  "Toe Dragons": {
    background: "#ffe8e8",
    text: "#991b1b",
    border: "#ef4444",
  },
  "Ghost Pirates": {
    background: "#ecfccb",
    text: "#111111",
    border: "#84cc16",
  },
  "Wednesday Knights": {
    background: "#fef3c7",
    text: "#111111",
    border: "#f59e0b",
  },
  Trashers: {
    background: "#dbeafe",
    text: "#111111",
    border: "#2563eb",
  },
  "Tank Fillers": {
    background: "#fef08a",
    text: "#991b1b",
    border: "#ef4444",
  },
};

export function getTeamColors(teamName: string): TeamColorPalette {
  return teamColors[teamName] ?? fallbackTeamColors;
}
