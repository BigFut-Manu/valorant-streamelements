export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Metodo non consentito.");
  }

  const twitchUser = String(req.query.user || "")
    .trim()
    .toLowerCase();

  const riotId = String(req.query.riot || "").trim();
  const parts = riotId.split("#");

  if (!twitchUser || twitchUser.length > 25) {
    return res.status(400).send("Nome utente Twitch non valido.");
  }

  if (
    parts.length !== 2 ||
    !parts[0].trim() ||
    !parts[1].trim() ||
    riotId.length > 100
  ) {
    return res
      .status(400)
      .send("Formato non valido. Usa NomeRiot#TAG.");
  }

  const [riotName, riotTag] = parts.map((part) => part.trim());

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return res.status(500).send("Configurazione GitHub incompleta.");
  }

  const apiUrl =
    `https://api.github.com/repos/${owner}/${repo}` +
    `/contents/data/players.json`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const fileResponse = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );

    if (!fileResponse.ok) {
      console.error("GitHub read error:", fileResponse.status);
      return res
        .status(502)
        .send("Non riesco a leggere players.json. Controlla il file e il token.");
    }

    const file = await fileResponse.json();
    const content = Buffer.from(file.content, "base64").toString("utf8");
    const data = JSON.parse(content);

    if (!data.players || typeof data.players !== "object") {
      data.players = {};
    }

    if (Object.prototype.hasOwnProperty.call(data.players, twitchUser)) {
      return res
        .status(409)
        .send(`${twitchUser}: hai già collegato un Riot ID. Usa !unlink prima di cambiarlo.`);
    }

    data.players[twitchUser] = {
      name: riotName,
      tag: riotTag,
    };

    const updatedContent = Buffer.from(
      JSON.stringify(data, null, 2) + "\n"
    ).toString("base64");

    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Collega Riot ID per ${twitchUser}`,
        content: updatedContent,
        sha: file.sha,
        branch,
      }),
    });

    if (!updateResponse.ok) {
      console.error("GitHub write error:", updateResponse.status);
      return res
        .status(502)
        .send("Non riesco a salvare il collegamento. Riprova tra poco.");
    }

    return res
      .status(200)
      .send(`${twitchUser} collegato a ${riotName}#${riotTag}!`);
  } catch (error) {
    console.error("Link endpoint error:", error);
    return res.status(500).send("Errore interno durante il collegamento.");
  }
}
