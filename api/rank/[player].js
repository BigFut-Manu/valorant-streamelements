
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Metodo non consentito");
  }

  const {
    HENRIK_API_KEY,
    RIOT_NAME = "ImLogan4K",
    RIOT_TAG = "811",
    VAL_REGION = "eu"
  } = process.env;

  if (!HENRIK_API_KEY) {
    return res.status(500).send("Configurazione API incompleta");
  }

  // Profilo predefinito oppure nome#tag nell'URL
  let name = RIOT_NAME;
  let tag = RIOT_TAG;

  const player = req.query.player;

  if (player !== undefined) {
    const riotId = Array.isArray(player) ? player.join("/") : player;
    const decoded = String(riotId);

    // Il formato atteso è NOME#TAG
    const separator = decoded.lastIndexOf("#");

    if (separator <= 0 || separator === decoded.length - 1) {
      return res.status(400).send(
        "Formato non valido. Usa /api/rank/NOME%23TAG"
      );
    }

    name = decoded.slice(0, separator);
    tag = decoded.slice(separator + 1);
  }

  name = String(name).trim();
  tag = String(tag).trim();

  if (
    !name ||
    !tag ||
    name.length > 32 ||
    tag.length > 16 ||
    /[/\\]/.test(name) ||
    /[/\\]/.test(tag)
  ) {
    return res.status(400).send("Riot ID o Tag non validi");
  }

  try {
    const url =
      "https://api.henrikdev.xyz/valorant/v3/mmr/" +
      `${encodeURIComponent(VAL_REGION)}/pc/` +
      `${encodeURIComponent(name)}/` +
      `${encodeURIComponent(tag)}`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    if (response.status === 429) {
      return res.status(429).send("Troppe richieste. Riprova più tardi.");
    }

    if (!response.ok) {
      return res.status(502).send("Errore nel recupero del rank");
    }

    const result = await response.json();
    const data = result?.data;

    if (!data?.current) {
      return res.status(404).send("Rank non disponibile");
    }

    const rank = data.current.tier?.name ?? "Unrated";
    const rr = Number(data.current.rr);
    const change = Number(data.current.last_change);
    const peak = data.peak?.tier?.name ?? "Non disponibile";

    const rrText = Number.isFinite(rr)
      ? `${rr}/100 RR`
      : "RR N/D";

    const changeText = Number.isFinite(change)
      ? `${change > 0 ? "+" : ""}${change}`
      : "N/D";

    return res.status(200).send(
      `${rank} (${rrText}) ` +
      `(${changeText} nell'ultima) | Rank Peak: ${peak}`
    );
  } catch (error) {
    console.error("Errore !rank:", error.message);
    return res.status(502).send("Errore nel recupero del rank");
  }
}
