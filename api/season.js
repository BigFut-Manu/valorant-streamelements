
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

  try {
    const url =
      "https://api.henrikdev.xyz/valorant/v3/mmr/" +
      `${encodeURIComponent(VAL_REGION)}/pc/` +
      `${encodeURIComponent(RIOT_NAME)}/` +
      `${encodeURIComponent(RIOT_TAG)}`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    if (!response.ok) {
      return res.status(502).send("Errore nel recupero delle statistiche Season");
    }

    const result = await response.json();
    const data = result?.data;
    const seasonal = data?.seasonal;

    if (!data || !Array.isArray(seasonal) || seasonal.length === 0) {
      return res.status(502).send("Statistiche Season non disponibili");
    }

    // Ultimo atto restituito dall'API
    const latestSeason = seasonal[seasonal.length - 1];

    const total = Number(latestSeason.games ?? 0);
    const wins = Number(latestSeason.wins ?? 0);

    // Stima delle sconfitte: non distingue eventuali pareggi.
    const losses = Math.max(0, total - wins);

    const currentRank = data.current?.tier?.name ?? "Unrated";
    const rr = data.current?.rr;

    const peak =
      data.peak?.tier?.name ??
      data.peak?.rank?.name ??
      "Non disponibile";

    const rrText = Number.isFinite(Number(rr))
      ? ` ${rr} RR`
      : "";

    const output =
      `Partite Totali: ${total} | ` +
      `Vinte: ${wins} | ` +
      `Perse: ${losses} | ` +
      `Rank attuale: ${currentRank} (${rrText}) | ` +
      `Rank Peak: ${peak}`;

    return res.status(200).send(output);
  } catch (error) {
    console.error("Errore comando season:", error.message);
    return res.status(502).send("Errore nel recupero delle statistiche Season");
  }
}
