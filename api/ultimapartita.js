
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Metodo non consentito");
  }

  const { HENRIK_API_KEY, RIOT_NAME, RIOT_TAG, VAL_REGION } =
    process.env;

  if (!HENRIK_API_KEY || !RIOT_NAME || !RIOT_TAG || !VAL_REGION) {
    return res.status(500).send(
      "Configurazione API incompleta su Vercel"
    );
  }

  try {
    const name = encodeURIComponent(RIOT_NAME);
    const tag = encodeURIComponent(RIOT_TAG);
    const region = encodeURIComponent(VAL_REGION);

    const url =
      `https://api.henrikdev.xyz/valorant/v3/matches/` +
      `${region}/${name}/${tag}?size=5`;

    const response = await fetch(url, {
      headers: {
        Authorization: HENRIK_API_KEY
      }
    });

    const result = await response.json();

    if (!response.ok || !Array.isArray(result.data)) {
      return res.status(502).send(
        "HenrikDev non ha restituito lo storico atteso"
      );
    }

    const match = result.data.find(
      (m) => m.metadata?.mode?.toLowerCase() === "competitive"
    );

    if (!match) {
      return res.status(404).send(
        "Nessuna partita competitiva trovata"
      );
    }

    const players = match.players?.all_players ?? [];
    const player = players.find(
      (p) =>
        p.name?.toLowerCase() === RIOT_NAME.toLowerCase() &&
        p.tag?.toLowerCase() === RIOT_TAG.toLowerCase()
    );

    if (!player) {
      return res.status(502).send(
        "Giocatore non trovato nei dati della partita"
      );
    }

    const stats = player.stats ?? {};
    const teams = match.teams ?? {};
    const team = player.team?.toLowerCase();
    const ownTeam = teams[team];

    if (!ownTeam || ownTeam.rounds_won == null) {
      return res.status(502).send(
        "Punteggio della partita non disponibile"
      );
    }

    const enemyTeam = team === "red" ? teams.blue : teams.red;

    if (!enemyTeam || enemyTeam.rounds_won == null) {
      return res.status(502).send(
        "Punteggio avversario non disponibile"
      );
    }

    const hs = Number(stats.headshots ?? 0);
    const bs = Number(stats.bodyshots ?? 0);
    const ls = Number(stats.legshots ?? 0);
    const totalShots = hs + bs + ls;
    const hsPercent = totalShots
      ? Math.round((hs / totalShots) * 100)
      : 0;

    const score =
      `${ownTeam.rounds_won}/${enemyTeam.rounds_won}`;

    const agent = player.character ?? "Sconosciuto";
    const kda =
      `${stats.kills ?? 0}/${stats.deaths ?? 0}/${stats.assists ?? 0}`;

    return res.status(200).send(
      `Esito: ${score} | Agente: ${agent} | ` +
      `KDA: ${kda} | HS: ${hsPercent}%`
    );
  } catch {
    return res.status(502).send(
      "Errore durante il recupero delle statistiche Valorant"
    );
  }
}
