
export default async function handler(req, res) {
  const API_KEY = process.env.HENRIK_API_KEY;
  const NAME = process.env.RIOT_NAME;
  const TAG = process.env.RIOT_TAG;
  const REGION = process.env.VAL_REGION || "eu";

  if (!API_KEY || !NAME || !TAG) {
    return res.status(500).send("Errore: variabili Riot mancanti su Vercel.");
  }

  try {
    const url =
      `https://api.henrikdev.xyz/valorant/v3/matches/` +
      `${encodeURIComponent(REGION)}/${encodeURIComponent(NAME)}/` +
      `${encodeURIComponent(TAG)}?size=20`;

    const response = await fetch(url, {
      headers: { Authorization: API_KEY }
    });

    if (!response.ok) {
      return res.status(502).send("Errore nel recupero delle partite.");
    }

    const json = await response.json();
    const matches = Array.isArray(json.data) ? json.data : [];
    const competitive = matches.filter(
      m => String(m.metadata?.mode || "").toLowerCase() === "competitive"
    );

    const agenti = {};
    const mappe = {};
    const armi = {};

    let vinte = 0;
    let perse = 0;
    let killsTotali = 0;
    let mortiTotali = 0;
    let secondiGiocati = 0;
    let partiteAnalizzate = 0;

    for (const match of competitive) {
      const players = match.players || {};
      const allPlayers = Array.isArray(players.all_players)
        ? players.all_players
        : [
            ...(Array.isArray(players.red) ? players.red : []),
            ...(Array.isArray(players.blue) ? players.blue : [])
          ];

      const me = allPlayers.find(
        p =>
          String(p.name || "").toLowerCase() === NAME.toLowerCase() &&
          String(p.tag || "").toLowerCase() === TAG.toLowerCase()
      );

      if (!me) continue;

      partiteAnalizzate++;

      const puuid = me.puuid;
      const agent = me.character || "Sconosciuto";
      const map = match.metadata?.map || "Sconosciuta";

      agenti[agent] = (agenti[agent] || 0) + 1;
      mappe[map] = (mappe[map] || 0) + 1;

      killsTotali += Number(me.stats?.kills || 0);
      mortiTotali += Number(me.stats?.deaths || 0);
      secondiGiocati += Number(match.metadata?.game_length || 0);

      const team = String(me.team || "").toLowerCase();
      const teamData = match.teams?.[team];

      if (teamData?.has_won === true) vinte++;
      if (teamData?.has_won === false) perse++;

      if (Array.isArray(match.kills)) {
        for (const kill of match.kills) {
          if (kill.killer_puuid !== puuid) continue;

          const weapon = kill.damage_weapon_name;
          if (!weapon || typeof weapon !== "string") continue;

          armi[weapon] = (armi[weapon] || 0) + 1;
        }
      }
    }

    const top = obj =>
      Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

    const agente = top(agenti);
    const mappa = top(mappe);
    const arma = top(armi);

    const ore = Math.floor(secondiGiocati / 3600);
    const kd = mortiTotali
      ? (killsTotali / mortiTotali).toFixed(2)
      : killsTotali.toFixed(2);

    return res.status(200).send(
      `Cose più giocate: Agente: ${agente ? `${agente[0]} (${agente[1]})` : "N/D"} / ` +
      `Mappa: ${mappa ? `${mappa[0]} (${mappa[1]})` : "N/D"} | ` +
      `Arma migliore: ${arma ? `${arma[0]} (${arma[1]} kills)` : "N/D"} | ` +
      `Partite Totali: ${vinte + perse} (${vinte} vinte e ${perse} perse) | ` +
      `Ore giocate: ${ore} ore | K/D: ${kd} | ` +
      `Campione: ${partiteAnalizzate} partite Competitive disponibili`
    );
  } catch (error) {
    console.error("Errore statistiche:", error);
    return res.status(500).send("Errore durante il calcolo delle statistiche.");
  }
}
