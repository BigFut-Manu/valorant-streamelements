
export default async function handler(req, res) {
  const { HENRIK_API_KEY, RIOT_NAME, RIOT_TAG } = process.env;
  const region = process.env.VAL_REGION || "eu";

  try {
    const url =
      `https://api.henrikdev.xyz/valorant/v3/matches/${region}/` +
      `${encodeURIComponent(RIOT_NAME)}/${encodeURIComponent(RIOT_TAG)}?size=1`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    const json = await response.json();
    const match = json.data?.[0];

    if (!match) {
      return res.status(200).send(JSON.stringify(json).slice(0, 3000));
    }

    return res.status(200).json({
      metadata: match.metadata,
      playerKeys: Object.keys(match.players || {}),
      playerExample: match.players?.all_players?.[0] || match.players?.red?.[0],
      killKeys: Object.keys(match).filter(k =>
        k.toLowerCase().includes("kill") ||
        k.toLowerCase().includes("damage")
      ),
      killExample: match.kills?.[0] || null
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
}
