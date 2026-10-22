
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

  function italyDate(timestampSeconds) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(timestampSeconds * 1000));
  }

  try {
    const region = encodeURIComponent(VAL_REGION);
    const name = encodeURIComponent(RIOT_NAME);
    const tag = encodeURIComponent(RIOT_TAG);
    const base = "https://api.henrikdev.xyz/valorant";

    const [matchesResult, historyResult] = await Promise.all([
      getApi(
        `${base}/v3/matches/${region}/${name}/${tag}?size=20`
      ),
      getApi(
        `${base}/v1/mmr-history/${region}/${name}/${tag}`
      )
    ]);

    const matches = Array.isArray(matchesResult?.data)
      ? matchesResult.data
      : [];

    const history = Array.isArray(historyResult?.data)
      ? historyResult.data
      : [];

    const today = italyDate(Date.now() / 1000);

    const todayMatches = matches.filter(match =>
      match?.metadata?.mode === "Competitive" &&
      Number.isFinite(Number(match?.metadata?.game_start)) &&
      italyDate(Number(match.metadata.game_start)) === today
    );

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const match of todayMatches) {
      const players = [
        ...(Array.isArray(match.players?.red) ? match.players.red : []),
        ...(Array.isArray(match.players?.blue) ? match.players.blue : [])
      ];

      const player = players.find(p =>
        String(p.name ?? "").toLowerCase() === RIOT_NAME.toLowerCase() &&
        String(p.tag ?? "").toLowerCase() === RIOT_TAG.toLowerCase()
      );

      if (!player) continue;

      const team = String(player.team ?? "").toLowerCase();
      const won = match.teams?.[team]?.has_won;

      if (won === true) wins++;
      else if (won === false) losses++;
      else draws++;
    }

    const total = wins + losses + draws;
    const winrate = total > 0
      ? Math.round((wins / total) * 100)
      : 0;

    const todayHistory = history.filter(entry => {
      const timestamp = Number(entry.date_raw);
      return Number.isFinite(timestamp) &&
        italyDate(timestamp) === today;
    });

    const rrToday = todayHistory.reduce((sum, entry) => {
      const change = Number(entry.mmr_change_to_last_game);
      return sum + (Number.isFinite(change) ? change : 0);
    }, 0);

    return res.status(200).send(
      `Partite di Oggi: ${wins} Vinte - ${losses} Perse - ${draws} Pareggiate | ` +
      `Winrate: ${winrate}% | RR di oggi: ${rrToday > 0 ? "+" : ""}${rrToday}`
    );
  } catch (error) {
    console.error("Errore !record:", error.message);
    return res.status(502).send("Errore nel recupero del record giornaliero");
  }
}
