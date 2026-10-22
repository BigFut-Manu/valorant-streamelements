
export default async function handler(req, res) {
  const API_KEY = process.env.HENRIK_API_KEY;
  const NAME = process.env.RIOT_NAME;
  const TAG = process.env.RIOT_TAG;
  const REGION = process.env.VAL_REGION || "eu";

  if (!API_KEY || !NAME || !TAG) {
    return res.status(500).send("Errore: variabili HenrikDev mancanti.");
  }

  try {
    const PAGE_SIZE = 10;
    const MAX_PAGES = 10;
    const matchesById = new Map();

    // Recupera fino a 100 partite tramite la paginazione v4.
    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * PAGE_SIZE;

      const url =
        `https://api.henrikdev.xyz/valorant/v4/matches/` +
        `${encodeURIComponent(REGION)}/pc/` +
        `${encodeURIComponent(NAME)}/` +
        `${encodeURIComponent(TAG)}` +
        `?size=${PAGE_SIZE}&start=${start}`;

      const response = await fetch(url, {
        headers: { Authorization: API_KEY }
      });

      if (!response.ok) {
        console.error("Errore HenrikDev v4:", response.status);
        return res.status(502).send(
          `Errore HenrikDev v4: HTTP ${response.status}`
        );
      }

      const json = await response.json();
      const pageMatches = Array.isArray(json.data) ? json.data : [];

      for (const match of pageMatches) {
        const id = match.metadata?.match_id;
        if (id) matchesById.set(id, match);
      }

      if (pageMatches.length < PAGE_SIZE) break;
    }

    const matches = [...matchesById.values()];

    const agenti = {};
    const mappe = {};
    const armi = {};

    let vinte = 0;
    let perse = 0;
    let killsTotali = 0;
    let mortiTotali = 0;
    let millisecondiGiocati = 0;
    let partiteCompetitive = 0;

    for (const match of matches) {
      const metadata = match.metadata || {};

      // Considera solo le partite Competitive.
      const queue = String(metadata.queue?.name || "").toLowerCase();
      if (queue !== "competitive") continue;

      const players = Array.isArray(match.players) ? match.players : [];

      const me = players.find(
        p =>
          String(p.name || "").toLowerCase() === NAME.toLowerCase() &&
          String(p.tag || "").toLowerCase() === TAG.toLowerCase()
      );

      if (!me) continue;

      partiteCompetitive++;

      const agent = me.agent?.name || "Sconosciuto";
      const map = metadata.map?.name || "Sconosciuta";

      agenti[agent] = (agenti[agent] || 0) + 1;
      mappe[map] = (mappe[map] || 0) + 1;

      killsTotali += Number(me.stats?.kills || 0);
      mortiTotali += Number(me.stats?.deaths || 0);
      millisecondiGiocati += Number(metadata.game_length_in_ms || 0);

      // Trova il risultato della squadra del giocatore.
      const team = (match.teams || []).find(
        t => t.team_id === me.team_id
      );

      if (team?.won === true) vinte++;
      else if (team?.won === false) perse++;

      // Conta le kill del giocatore per arma.
      if (Array.isArray(match.kills)) {
        for (const kill of match.kills) {
          if (kill.killer?.puuid !== me.puuid) continue;

          const weapon = kill.weapon?.name;
          if (!weapon) continue;

          armi[weapon] = (armi[weapon] || 0) + 1;
        }
      }
    }

    const top = obj =>
      Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

    const agente = top(agenti);
    const mappa = top(mappe);
    const arma = top(armi);

    const ore = Math.floor(millisecondiGiocati / 3600000);
    const kd = mortiTotali > 0
      ? (killsTotali / mortiTotali).toFixed(2)
      : killsTotali.toFixed(2);

    return res.status(200).send(
      `Cose più giocate: ` +
      `Agente: ${agente ? `${agente[0]} (${agente[1]})` : "N/D"} / ` +
      `Mappa: ${mappa ? `${mappa[0]} (${mappa[1]})` : "N/D"} | ` +
      `Arma migliore: ${arma ? `${arma[0]} (${arma[1]} kills)` : "N/D"} | ` +
      `Partite Totali: ${vinte + perse} (${vinte} vinte e ${perse} perse) | ` +
      `Ore giocate: ${ore} ore | K/D: ${kd} | ` +
      `Campione: ${partiteCompetitive} partite Competitive analizzate`
    );
  } catch (error) {
    console.error("Errore statistiche:", error);
    return res.status(500).send(
      "Errore durante il calcolo delle statistiche."
    );
  }
}
