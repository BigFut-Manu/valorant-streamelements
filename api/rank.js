
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
      return res.status(502).send("Errore nel recupero del rank");
    }

    const result = await response.json();
    const data = result?.data;

    if (!data?.current) {
      return res.status(502).send("Rank non disponibile");
    }

    const rank = data.current.tier?.name ?? "Unrated";
    const rr = Number(data.current.rr);
    const change = Number(data.current.last_change);
    const peak = data.peak?.tier?.name ?? "Non disponibile";

    const rrText = Number.isFinite(rr) ? `${rr}/100 RR` : "RR N/D";

    const changeText = Number.isFinite(change)
      ? `${change > 0 ? "+" : ""}${change}`
      : "N/D";

    return res.status(200).send(
      `${rank} (${rrText}) (${changeText} nell'ultima) | Rank Peak: ${peak}`
    );
  } catch (error) {
    console.error("Errore !rank:", error.message);
    return res.status(502).send("Errore nel recupero del rank");
  }
}
