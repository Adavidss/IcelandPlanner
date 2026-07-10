export default function AboutPage() {
  return (
    <div className="prose-sm max-w-2xl">
      <h1 className="text-xl font-bold text-strong">About IcelandPlanner</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg">
        A free, static trip planner and discovery tool for Iceland. Everything is season-aware: pick your travel
        month and the map, tours, warnings and daylight all adapt — because Iceland in February and Iceland in
        July are, practically speaking, two different countries.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fg">
        Your itineraries live entirely in your browser&apos;s local storage — there are no accounts and no
        tracking. Use Export on the Plan page to back them up or move devices.
      </p>
      <h2 className="mt-5 text-base font-semibold text-strong">Data sources</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg">
        <li>Tours: <a className="text-aurora hover:underline" href="https://www.re.is" target="_blank" rel="noreferrer">Reykjavik Excursions</a> (booking happens on re.is; prices are &quot;from&quot; prices)</li>
        <li>Restaurants, fuel, pools, shops, lodging: © OpenStreetMap contributors (Overpass API)</li>
        <li>Road conditions: <a className="text-aurora hover:underline" href="https://umferdin.is/en" target="_blank" rel="noreferrer">Vegagerðin</a> — refreshed ~every 30 minutes</li>
        <li>Weather: <a className="text-aurora hover:underline" href="https://en.vedur.is" target="_blank" rel="noreferrer">Veðurstofa Íslands</a></li>
        <li>Hazards & alerts: <a className="text-aurora hover:underline" href="https://safetravel.is" target="_blank" rel="noreferrer">SafeTravel</a> (ICE-SAR)</li>
        <li>Aurora Kp index: NOAA Space Weather Prediction Center</li>
        <li>Extended places & photos: Wikipedia / Wikidata / Wikimedia Commons</li>
        <li>Map tiles: © OpenStreetMap © CARTO</li>
      </ul>
      <h2 className="mt-5 text-base font-semibold text-strong">Honesty notes</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg">
        <li>Drive times are straight-line estimates with a road factor — always verify in a real navigation app.</li>
        <li>Road/weather data here can lag the sources by up to an hour. Before driving in winter, check umferdin.is and vedur.is directly.</li>
        <li>Season scores are editorial judgment, not guarantees. F-road opening dates vary by year.</li>
      </ul>
      <p className="mt-5 text-xs text-muted">
        Open source on <a className="text-aurora hover:underline" href="https://github.com/Adavidss/IcelandPlanner" target="_blank" rel="noreferrer">GitHub</a>.
        Not affiliated with any listed service. Góða ferð!
      </p>
    </div>
  );
}
