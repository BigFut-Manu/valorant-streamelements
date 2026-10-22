
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Metodo non consentito");
  }

  const {
    HENRIK_API_KEY,
    RIOT_NAME,
    RIOT_TAG,
    VAL_REGION
  } = process.env;

  if (!HENRIK_API_KEY || !RIOT_NAME || !RIOT_TAG || !VAL_REGION) {
    return res.status(500).send(
      "Configurazione API incompleta su Vercel"
    );
  }

  try {
    const name = encodeURIComponent(RIOT_NAME);
    const tag = encodeURIComponent(RIOT_TAG);
    const region = encodeURIComponent(VAL_REGION);
    const base = "https://api.henrikdev.xyz/valorant";

    const headers = { Authorization: HENRIK_API_KEY };

    const [matchesResponse, mmrResponse] = await Promise.all([
      fetch(
        `${base}/v3/matches/${region}/${name}/${tag}?size=20`,
        { headers }
      ),
      fetch(
        `${base}/v3/mmr/${region}/${name}/${tag}`,
        { headers }
      )
    ]);

    if (!matchesResponse.ok) {
      return res.status(502).send(
        "Impossibile recuperare lo storico delle partite"
      );
    }

    const matchResult = await matchesResponse.json();
    const matches = matchResult.data;

    if (!Array.isArray(matches)) {
      return res.status(502).send(
        "Formato dello storico non valido"
      );
    }

    const mmr = mmrResponse.ok
      ? await mmrResponse.json()
      : null;

    const currentSeason =
      mmr?.data?.current?.season?.id ??
      mmr?.data?.season?.id ??
      null;

    const competitive = matches.filter(m =>
      m.metadata?.mode?.toLowerCase() === "competitive"
    );

    const seasonMatches = currentSeason
      ? competitive.filter(m =>
          m.metadata?.season?.id === currentSeason
        )
      : [];

    if (!seasonMatches.length) {
      return res.status(200).send(
        "Statistiche Season non disponibili: stagione non verificata"
      );
    }

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let kills = 0;
    let deaths = 0;

    for (const match of seasonMatches) {
      const player = (match.players?.all_players ?? []).find(p =>
        p.name?.toLowerCase() === RIOT_NAME.toLowerCase() &&
        p.tag?.toLowerCase() === RIOT_TAG.toLowerCase()
      );

      if (!player) continue;

      const stats = player.stats ?? {};
      kills += Number(stats.kills ?? 0);
      deaths += Number(stats.deaths ?? 0);

      const team = player.team?.toLowerCase();
      const own = match.teams?.[team]?.rounds_won;
      const enemy = match.teams?.[team === "red" ? "blue" : "red"]?.rounds_won;

      if (own == null || enemy == null) continue;

      if (own > enemy) wins++;
      else if (own < enemy) losses++;
      else draws++;
    }

    const total = wins + losses + draws;
    const kd = deaths ? (kills / deaths).toFixed(2) : kills.toFixed(2);

    const peak =
      mmr?.data?.peak?.tier?.name ??
      mmr?.data?.peak?.tier?.patched ??
      "Non disponibile";

    return res.status(200).send(
      `Season: Partite Totali: ${total} | ` +
      `Partite Vinte/Perse/Pareggiate: ${wins}/${losses}/${draws} | ` +
      `KD: ${kd} | Rank Peak: ${peak}`
    );
  } catch {
    return res.status(502).send(
      "Errore nel recupero delle statistiche Season"
    );
  }
}
