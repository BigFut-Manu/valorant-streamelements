
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Consenti solo richieste GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  const { HENRIK_API_KEY, VAL_REGION } = process.env;

  if (!HENRIK_API_KEY || !VAL_REGION) {
    return res.status(500).json({
      error: "Configurazione API incompleta"
    });
  }

  const name = String(req.query.name || "").trim();
  const tag = String(req.query.tag || "").trim();

  if (
    !name ||
    !tag ||
    name.length > 32 ||
    tag.length > 16 ||
    /[/\\]/.test(name) ||
    /[/\\]/.test(tag)
  ) {
    return res.status(400).json({
      error: "Inserisci un Riot ID e un Tag validi"
    });
  }

  try {
    const url =
      "https://api.henrikdev.xyz/valorant/v3/mmr/" +
      `${encodeURIComponent(VAL_REGION)}/pc/` +
      `${encodeURIComponent(name)}/` +
      `${encodeURIComponent(tag)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: HENRIK_API_KEY
      }
    });

    if (response.status === 404) {
      return res.status(404).json({
        error: "Giocatore non trovato o rank non disponibile"
      });
    }

    if (response.status === 429) {
      return res.status(429).json({
        error: "Troppe richieste. Riprova tra poco."
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: "Errore nel recupero del rank"
      });
    }

    const result = await response.json();
    const data = result?.data;

    if (!data?.current) {
      return res.status(404).json({
        error: "Rank non disponibile"
      });
    }

    const rank = data.current.tier?.name ?? "Unrated";
    const rr = Number(data.current.rr);
    const change = Number(data.current.last_change);
    const peak = data.peak?.tier?.name ?? "Non disponibile";

    return res.status(200).json({
      player: `${name}#${tag}`,
      rank,
      rr: Number.isFinite(rr) ? rr : null,
      lastChange: Number.isFinite(change) ? change : null,
      peak
    });
  } catch (error) {
    console.error("Errore API sito rank:", error.message);

    return res.status(502).json({
      error: "Errore temporaneo nel recupero del rank"
    });
  }
}
