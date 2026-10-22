
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

    if (!mmr || !Array.isArray(seasonal) || !seasonal.length) {
      return res.status(502).send("Statistiche Season non disponibili");
    }

    const latestSeason = seasonal[seasonal.length - 1];
    const seasonId = latestSeason?.season?.id;

    const matches = Array.isArray(matchesResult?.data)
      ? matchesResult.data
      : [];

    let winsRecent = 0;
    let lossesRecent = 0;
    let drawsRecent = 0;
    let kills = 0;
    let deaths = 0;
    let counted = 0;

    for (const match of matches) {
      const meta = match?.metadata;

      if (
        meta?.mode !== "Competitive" ||
        meta?.season_id !== seasonId
      ) {
        continue;
      }

      const allPlayers = [
        ...(Array.isArray(match.players?.red) ? match.players.red : []),
        ...(Array.isArray(match.players?.blue) ? match.players.blue : [])
      ];

      const player = allPlayers.find(p =>
        String(p.name ?? "").toLowerCase() === RIOT_NAME.toLowerCase() &&
        String(p.tag ?? "").toLowerCase() === RIOT_TAG.toLowerCase()
      );

      if (!player) continue;

      kills += Number(player.stats?.kills ?? 0);
      deaths += Number(player.stats?.deaths ?? 0);
      counted++;

      const teamKey = String(player.team ?? "").toLowerCase();
      const result = match.teams?.[teamKey];

      if (!result || typeof result.has_won !== "boolean") {
        drawsRecent++;
      } else if (result.has_won) {
        winsRecent++;
      } else {
        lossesRecent++;
      }
    }

    const totalSeason = Number(latestSeason.games ?? 0);
    const winsSeason = Number(latestSeason.wins ?? 0);
    const lossesSeason = Math.max(0, totalSeason - winsSeason);

    const kd = deaths > 0
      ? (kills / deaths).toFixed(2)
      : kills > 0
        ? kills.toFixed(2)
        : "N/D";

    const currentRank = mmr.current?.tier?.name ?? "Unrated";
    const rr = mmr.current?.rr;
    const peak = mmr.peak?.tier?.name ?? "Non disponibile";

    const output =
      `Season (${latestSeason.season?.short ?? "atto corrente"}): ` +
      `Partite Totali: ${totalSeason} | ` +
      `Vinte: ${winsSeason} | ` +
      `Perse stimate: ${lossesSeason} | ` +
      `Vinte/Perse/Pareggiate recenti: ${winsRecent}/${lossesRecent}/${drawsRecent} | ` +
      `K/D recente: ${counted > 0 ? kd : "N/D"} | ` +
      `Rank attuale: ${currentRank}` +
      (Number.isFinite(Number(rr)) ? ` ${rr} RR` : "") +
      ` | Rank Peak: ${peak}`;

    return res.status(200).send(output);
  } catch (error) {
    console.error("Errore comando season:", error.message);
    return res.status(502).send("Errore nel recupero delle statistiche Season");
  }
}
