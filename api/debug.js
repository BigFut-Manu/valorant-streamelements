
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
    const match = prima[0];

    const riassunto = matches => {
      const modalita = {};

      for (const partita of matches) {
        const mode =
          partita.metadata?.queue?.name || "Sconosciuta";

        modalita[mode] = (modalita[mode] || 0) + 1;
      }

      return {
        ricevute: matches.length,
        modalita,
        primaPartita:
          matches[0]?.metadata?.started_at || null,
        ultimaPartita:
          matches[matches.length - 1]?.metadata?.started_at || null
      };
    };

    const giocatore = match?.players?.find(
      p =>
        String(p.name || "").toLowerCase() === RIOT_NAME.toLowerCase() &&
        String(p.tag || "").toLowerCase() === RIOT_TAG.toLowerCase()
    );

    return res.status(200).json({
      endpoint: "HenrikDev VALORANT v4",

      pagina1_start0: riassunto(prima),
      pagina2_start10: riassunto(seconda),

      esempioStruttura: match
        ? {
            chiaviPartita: Object.keys(match),
            metadata: match.metadata,
            teams: match.teams || null,

            giocatoreCercato: giocatore || null,

            primaKill: match.kills?.[0] || null
          }
        : null
    });
  } catch (error) {
    console.error("Errore debug v4:", error);

    return res.status(502).json({
      error: error.message
    });
  }
}
