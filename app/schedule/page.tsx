import { getTeamColors, latestResult, upcomingMatchups } from "@/lib/league-data";

export default function SchedulePage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Schedule</h1>
        <p className="mt-3 text-neutral-600">Latest result and what is coming next.</p>
      </div>

      <div className="glass-card rounded-3xl p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{latestResult.date}</p>
        <h2 className="mt-2 text-3xl font-semibold text-neutral-900">{latestResult.title}</h2>
        <p className="mt-4 text-lg font-medium text-neutral-800">{latestResult.summary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {upcomingMatchups.map((game) => (
          <article key={`${game.home}-${game.away}`} className="glass-card lift rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{game.date}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xl font-semibold text-neutral-900">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                style={{
                  backgroundColor: getTeamColors(game.home).background,
                  color: getTeamColors(game.home).text,
                  borderColor: getTeamColors(game.home).border,
                }}
              >
                {game.home}
              </span>
              <span className="text-neutral-400">vs</span>
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                style={{
                  backgroundColor: getTeamColors(game.away).background,
                  color: getTeamColors(game.away).text,
                  borderColor: getTeamColors(game.away).border,
                }}
              >
                {game.away}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{game.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
