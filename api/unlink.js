export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Metodo non consentito.");
  }

  const twitchUser = String(req.query.user || "")
    .trim()
    .toLowerCase();

  if (!twitchUser || twitchUser.length > 25) {
    return res.status(400).send("Nome utente Twitch non valido.");
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return res.status(500).send("Configurazione GitHub incompleta.");
  }

  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
    "/contents/data/players.json";

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const response = await fetch(
      `${url}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );

    if (!response.ok) {
      console.error("GitHub read error:", response.status);
      return res.status(502).send("Errore durante la lettura dei collegamenti.");
    }

    const file = await response.json();
    const data = JSON.parse(
      Buffer.from(file.content, "base64").toString("utf8")
    );

    if (!data.players || !data.players[twitchUser]) {
      return res.status(404).send(
        `${twitchUser}: non hai un Riot ID collegato.`
      );
    }

    delete data.players[twitchUser];

    const update = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Scollega Riot ID per ${twitchUser}`,
        content: Buffer.from(
          JSON.stringify(data, null, 2) + "\n"
        ).toString("base64"),
        sha: file.sha,
        branch,
      }),
    });

    if (!update.ok) {
      console.error("GitHub write error:", update.status);
      return res.status(502).send("Non riesco a salvare la modifica. Riprova.");
    }

    return res.status(200).send(
      `${twitchUser}: Riot ID scollegato!`
    );
  } catch (error) {
    console.error("Unlink endpoint error:", error);
    return res.status(500).send("Errore interno durante lo scollegamento.");
  }
}
