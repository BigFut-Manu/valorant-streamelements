
export default async function handler(req, res) {
  const { HENRIK_API_KEY, RIOT_NAME, RIOT_TAG } = process.env;
  const region = process.env.VAL_REGION || "eu";

  if (!HENRIK_API_KEY || !RIOT_NAME || !RIOT_TAG) {
    return res.status(500).json({
      error: "Variabili HenrikDev mancanti su Vercel"
    });
  }

  async function getPage(start) {
    const url =
      `https://api.henrikdev.xyz/valorant/v4/matches/` +
      `${encodeURIComponent(region)}/pc/` +
      `${encodeURIComponent(RIOT_NAME)}/` +
      `${encodeURIComponent(RIOT_TAG)}` +
      `?size=10&start=${start}`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        `HenrikDev v4: HTTP ${response.status} - ` +
        JSON.stringify(json).slice(0, 500)
      );
    }

    return Array.isArray(json.data) ? json.data : [];
  }

  try {
    const prima = await getPage(0);
    const seconda = await getPage(10);

    const riassunto = matches => {
      const modalita = {};

      for (const match of matches) {
        const mode = match.metadata?.mode || "Sconosciuta";
        modalita[mode] = (modalita[mode] || 0) + 1;
      }

      return {
        ricevute: matches.length,
        modalita,
        primaPartita: matches[0]?.metadata?.game_start_patched || null,
        ultimaPartita:
          matches[matches.length - 1]?.metadata?.game_start_patched || null
      };
    };

    return res.status(200).json({
      endpoint: "HenrikDev VALORANT v4",
      pagina1_start0: riassunto(prima),
      pagina2_start10: riassunto(seconda),
      esempioStruttura: prima[0]
        ? {
            chiaviPartita: Object.keys(prima[0]),
            metadata: prima[0].metadata,
            tipoPlayers: Array.isArray(prima[0].players)
              ? "array"
              : typeof prima[0].players,
            primoGiocatore: prima[0].players?.[0] || null,
            primaKill: prima[0].kills?.[0] || null
          }
        : null
    });
  } catch (error) {
    console.error("Errore debug v4:", error);
    return res.status(502).json({ error: error.message });
  }
}
