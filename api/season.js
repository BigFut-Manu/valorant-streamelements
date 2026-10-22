
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const {
    HENRIK_API_KEY,
    RIOT_NAME,
    RIOT_TAG,
    VAL_REGION
  } = process.env;

  if (!HENRIK_API_KEY || !RIOT_NAME || !RIOT_TAG || !VAL_REGION) {
    return res.status(500).send("Configurazione API incompleta");
  }

  async function getApi(url) {
    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`HenrikDev HTTP ${response.status}`);
    }

    return response.json();
  }

  try {
    const base = "https://api.henrikdev.xyz/valorant";
    const region = encodeURIComponent(VAL_REGION);
    const name = encodeURIComponent(RIOT_NAME);
    const tag = encodeURIComponent(RIOT_TAG);

    const [mmrResult, matchesResult] = await Promise.all([
      getApi(`${base}/v3/mmr/${region}/pc/${name}/${tag}`),
      getApi(`${base}/v3/matches/${region}/${name}/${tag}?size=20`)
    ]);

    const mmr = mmrResult?.data;
    const seasonal = mmr?.seasonal;

    if (!mmr || !Array.isArray(seasonal)) {
      return res.status(502).send("Statistiche Season non disponibili");
    }

    // Trova l'atto più recente presente nella risposta.
    const latestSeason = seasonal[seasonal.length - 1];

    if (!latestSeason) {
      return res.status(502).send("Dati Season non disponibili");
    }

    const peak = mmr.peak?.tier?.name ?? "Non disponibile";
    const currentRank = mmr.current?.tier?.name ?? "Unrated";
    const rr = mmr.current?.rr;

    const matches = Array.isArray(matchesResult?.data)
      ? matchesResult.data
      : [];

    // Le partite sono filtrate sull'ID dell'atto più recente,
    // se l'API fornisce l'ID della Season nei metadati.
    const seasonId = latestSeason.season?.id;

    const seasonMatches = matches.filter(match => {
      const matchSeason =
        match?.metadata?.season?.id ??
        match?.metadata?.season_id ??
        match?.season?.id;

      return seasonId && matchSeason === seasonId;
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let kills = 0;
    let deaths = 0;

    for (const match of seasonMatches) {
      const players = match?.players?.all ?? match?.players ?? [];
      const player = Array.isArray(players)
        ? players.find(p =>
            p?.name?.toLowerCase() === RIOT_NAME.toLowerCase() &&
            String(p?.tag ?? "").toLowerCase() === RIOT_TAG.toLowerCase()
          )
        : null;

      if (!player) continue;

      kills += Number(player.stats?.kills ?? 0);
      deaths += Number(player.stats?.deaths ?? 0);

      const team = player.team?.toLowerCase();
      const teams = match?.teams;

      const won =
        team && teams?.[team]?.has_won === true
          ? true
          : team && teams?.[team]?.has_won === false
            ? false
            : null;

      if (won === true) wins++;
      else if (won === false) losses++;
      else draws++;
    }

    const total = Number(latestSeason.games ?? 0);
    const seasonalWins = Number(latestSeason.wins ?? 0);
    const kd = deaths > 0
      ? (kills / deaths).toFixed(2)
      : kills > 0
        ? kills.toFixed(2)
        : "N/D";

    const rankPeak = peak;

    // La cronologia restituita può essere limitata alle ultime 20 partite.
    // Non mostriamo un K/D incompleto come se fosse quello dell'intero atto.
    const kdText = seasonMatches.length > 0
      ? kd
      : "N/D";

    const output =
      `Season (${latestSeason.season?.short ?? "atto più recente"}): ` +
      `Partite Totali: ${total} | ` +
      `Vinte: ${seasonalWins} | ` +
      `Vinte/Perse/Pareggiate recenti: ${wins}/${losses}/${draws} | ` +
      `K/D recente: ${kdText} | ` +
      `Rank attuale: ${currentRank}` +
      (Number.isFinite(Number(rr)) ? ` ${rr} RR` : "") +
      ` | Rank Peak: ${rankPeak}`;

    return res.status(200).send(output);
  } catch (error) {
    console.error("Errore comando season:", error.message);
    return res.status(502).send(
      "Errore nel recupero delle statistiche Season"
    );
  }
}
