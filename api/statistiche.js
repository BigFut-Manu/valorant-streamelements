
export default async function handler(req, res) {
  const API_KEY = process.env.HENRIK_API_KEY;
  const NAME = process.env.RIOT_NAME;
  const TAG = process.env.RIOT_TAG;
  const REGION = process.env.VAL_REGION || "eu";

  if (!API_KEY || !NAME || !TAG) {
    return res.status(500).send("Errore: configura le variabili Riot su Vercel.");
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
      return res.status(502).send("Errore nel recupero delle statistiche Valorant.");
    }

    const json = await response.json();
    const matches = Array.isArray(json.data) ? json.data : [];

    // Per ora consideriamo solo le partite Competitive.
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

    for (const match of competitive) {
      const metadata = match.metadata || {};
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

      const agent = me.character || me.agent || "Sconosciuto";
      const map = metadata.map || "Sconosciuta";

      agenti[agent] = (agenti[agent] || 0) + 1;
      mappe[map] = (mappe[map] || 0) + 1;

      killsTotali += Number(me.stats?.kills || 0);
      mortiTotali += Number(me.stats?.deaths || 0);

      const durata = Number(metadata.game_length || 0);
      secondiGiocati += durata;

      const team = String(me.team || "").toLowerCase();
      const teamData = match.teams?.[team];

      if (teamData?.has_won === true) vinte++;
      else if (teamData?.has_won === false) perse++;

      // Le armi vengono conteggiate dai dati dettagliati delle uccisioni,
      // se presenti nella risposta dell'API.
      const kills = Array.isArray(match.players?.all_players)
        ? match.kills
        : match.kills;

      if (Array.isArray(kills)) {
        for (const kill of kills) {
          const killer = kill.killer || {};
          const killerName =
            typeof killer === "string" ? killer : killer.name;
          const killerTag =
            typeof killer === "object" ? killer.tag : undefined;

          if (
            String(killerName || "").toLowerCase() === NAME.toLowerCase() &&
            (!killerTag || String(killerTag).toLowerCase() === TAG.toLowerCase())
          ) {
            const arma =
              kill.weapon?.name ||
              kill.weapon ||
              kill.finishing_damage?.damage_type ||
              null;

            if (arma && typeof arma === "string") {
              armi[arma] = (armi[arma] || 0) + 1;
            }
          }
        }
      }
    }

    const piuGiocato = obj =>
      Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

    const agente = piuGiocato(agenti);
    const mappa = piuGiocato(mappe);
    const arma = piuGiocato(armi);

    const partite = vinte + perse;
    const ore = Math.floor(secondiGiocati / 3600);
    const kd = mortiTotali > 0
      ? (killsTotali / mortiTotali).toFixed(2)
      : killsTotali.toFixed(2);

    const agenteText = agente
      ? `${agente[0]} (${agente[1]})`
      : "N/D";
    const mappaText = mappa
      ? `${mappa[0]} (${mappa[1]})`
      : "N/D";
    const armaText = arma
      ? `${arma[0]} (${arma[1]} kills)`
      : "N/D";

    return res.status(200).send(
      `Cose più giocate: Agente: ${agenteText} / Mappa: ${mappaText} | ` +
      `Arma migliore: ${armaText} | ` +
      `Partite Totali: ${partite} (${vinte} vinte e ${perse} perse) | ` +
      `Ore giocate: ${ore} ore | K/D: ${kd} | ` +
      `Campione: ${competitive.length} partite Competitive disponibili`
    );
  } catch (error) {
    console.error("Errore statistiche:", error);
    return res.status(500).send("Errore durante il calcolo delle statistiche.");
  }
}
