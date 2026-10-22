
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const {
    HENRIK_API_KEY,
    RIOT_NAME,
    RIOT_TAG,
    VAL_REGION
  } = process.env;

  try {
    const url =
      "https://api.henrikdev.xyz/valorant/v3/matches/" +
      `${encodeURIComponent(VAL_REGION)}/` +
      `${encodeURIComponent(RIOT_NAME)}/` +
      `${encodeURIComponent(RIOT_TAG)}?size=1`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    const json = await response.json();
    const match = json?.data?.[0];

    if (!response.ok || !match) {
      return res.status(502).json({
        status: response.status,
        message: json?.message ?? "Nessuna partita trovata"
      });
    }

    const players = match.players ?? {};

    function sample(value) {
      if (Array.isArray(value)) return value[0] ?? null;
      return value && typeof value === "object" ? value : null;
    }

    return res.status(200).json({
      playerKeys: Object.keys(players),
      redExample: sample(players.red),
      blueExample: sample(players.blue),
      allExample: sample(players.all),
      seasonId: match.metadata?.season_id,
      mode: match.metadata?.mode
    });
  } catch {
    return res.status(502).json({
      error: "Errore nel recupero delle partite"
    });
  }
}
