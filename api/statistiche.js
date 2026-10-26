
export default async function handler(req, res) {
  const API_KEY = process.env.HENRIK_API_KEY;
  const NAME = process.env.RIOT_NAME;
  const TAG = process.env.RIOT_TAG;
  const REGION = process.env.VAL_REGION || "eu";

  if (!API_KEY || !NAME || !TAG) {
    return res.status(500).send(
      "Errore: variabili HenrikDev mancanti."
    );
  }

  try {
    // Limite massimo: 1000 partite recuperate.
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;
    const matchesById = new Map();

    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * PAGE_SIZE;

      const url =
        `https://api.henrikdev.xyz/valorant/v4/matches/` +
        `${encodeURIComponent(REGION)}/pc/` +
        `${encodeURIComponent(NAME)}/` +
        `${encodeURIComponent(TAG)}` +
        `?size=${PAGE_SIZE}&start=${start}`;

      const response = await fetch(url, {
        headers: {
          Authorization: API_KEY
        }
      });

      if (!response.ok) {
        console.error(
          "Errore HenrikDev:",
          response.status,
          await response.text()
        );

        return res.status(502).send(
          `Errore HenrikDev: HTTP ${response.status}`
        );
      }

      const json = await response.json();
      const pageMatches = Array.isArray(json.data)
        ? json.data
        : [];

      if (pageMatches.length === 0) break;

      for (const match of pageMatches) {
        const id = match.metadata?.match_id;

        if (id) {
          matchesById.set(id, match);
        }
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

    const incrementa = (oggetto, nome, quantita = 1) => {
      if (!nome) return;
      oggetto[nome] = (oggetto[nome] || 0) + quantita;
    };

    const nomeGiocatore = (player) =>
      String(player?.name || "").toLowerCase();

    const tagGiocatore = (player) =>
      String(player?.tag || "").toLowerCase();

    for (const match of matches) {
      const metadata = match.metadata || {};
      const queue = String(
        metadata.queue?.name || ""
      ).toLowerCase();

      // Considera esclusivamente le partite Competitive.
      if (queue !== "competitive") continue;

      const players = Array.isArray(match.players)
        ? match.players
        : [];

      const me = players.find(
        (player) =>
          nomeGiocatore(player) === NAME.toLowerCase() &&
          tagGiocatore(player) === TAG.toLowerCase()
      );

      if (!me) continue;

      partiteCompetitive++;

      // Agente e mappa più giocati.
      incrementa(
        agenti,
        me.agent?.name || "Sconosciuto"
      );

      incrementa(
        mappe,
        metadata.map?.name || "Sconosciuta"
      );

      // Statistiche personali.
      killsTotali += Number(me.stats?.kills || 0);
      mortiTotali += Number(me.stats?.deaths || 0);
      millisecondiGiocati += Number(
        metadata.game_length_in_ms || 0
      );

      // Risultato della partita.
      const mioTeam =
        me.team_id ??
        me.team?.id ??
        me.team?.name ??
        me.team;

      const teams = Array.isArray(match.teams)
        ? match.teams
        : [];

      const team = teams.find((t) => {
        const teamId =
          t.team_id ??
          t.id ??
          t.name;

        return String(teamId).toLowerCase() ===
          String(mioTeam).toLowerCase();
      });

      if (team?.won === true) {
        vinte++;
      } else if (team?.won === false) {
        perse++;
      }

      // Kill per arma, usando gli eventi della partita.
      const eventiKill = Array.isArray(match.kills)
        ? match.kills
        : [];

      for (const kill of eventiKill) {
        const killerPuuid =
          kill.killer?.puuid ??
          kill.killer_puuid ??
          kill.killer;

        if (
          typeof killerPuuid !== "string" ||
          killerPuuid !== me.puuid
        ) {
          continue;
        }

        const weaponName =
          kill.weapon?.name ||
          kill.weapon?.display_name ||
          (typeof kill.weapon === "string"
            ? kill.weapon
            : null);

        if (weaponName) {
          incrementa(armi, weaponName);
        }
      }
    }

    const top = (oggetto) =>
      Object.entries(oggetto).sort(
        (a, b) => b[1] - a[1]
      )[0];

    const agente = top(agenti);
    const mappa = top(mappe);
    const arma = top(armi);

    const ore = Math.floor(
      millisecondiGiocati / 3600000
    );

    const kd = mortiTotali > 0
      ? (killsTotali / mortiTotali).toFixed(2)
      : killsTotali.toFixed(2);

    const partiteConRisultato = vinte + perse;

    if (partiteCompetitive === 0) {
      return res.status(200).send(
        "Nessuna partita Competitive trovata nei risultati recuperati."
      );
    }

    return res.status(200).send(
      `Cose più giocate: ` +
      `Agente: ${agente ? `${agente[0]} (${agente[1]})` : "N/D"} / ` +
      `Mappa: ${mappa ? `${mappa[0]} (${mappa[1]})` : "N/D"} | ` +
      `Arma migliore: ${arma ? `${arma[0]} (${arma[1]} kills)` : "N/D"} | ` +
      `Partite Totali: ${partiteConRisultato} (${vinte} vinte e ${perse} perse) | ` +
      `Ore giocate: ${ore} ore | ` +
      `K/D: ${kd} | ` +
      `Campione: ${partiteCompetitive} partite Competitive analizzate`
    );
  } catch (error) {
    console.error("Errore statistiche:", error);

    return res.status(500).send(
      "Errore durante il calcolo delle statistiche."
    );
  }
}
