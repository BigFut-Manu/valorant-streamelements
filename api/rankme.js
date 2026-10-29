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

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const apiKey = process.env.HENRIK_API_KEY;
  const region = process.env.VAL_REGION || "eu";

  if (!token || !owner || !repo || !apiKey) {
    return res.status(500).send("Configurazione incompleta su Vercel.");
  }

  const githubUrl =
    `https://api.github.com/repos/${owner}/${repo}` +
    "/contents/data/players.json";

  try {
    const fileResponse = await fetch(
      `${githubUrl}?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!fileResponse.ok) {
      console.error("GitHub read error:", fileResponse.status);
      return res.status(502).send("Errore nella lettura del profilo collegato.");
    }

    const file = await fileResponse.json();
    const data = JSON.parse(
      Buffer.from(file.content, "base64").toString("utf8")
    );

    const player = data.players?.[twitchUser];

    if (!player?.name || !player?.tag) {
      return res.status(404).send(
        `${twitchUser}: usa !link NomeRiot#TAG prima di usare !rankme.`
      );
    }

    const riotName = player.name;
    const riotTag = player.tag;

    
    const rankUrl =
      `https://api.henrikdev.xyz/valorant/v3/mmr/` +
      `${encodeURIComponent(region)}/pc/` +
      `${encodeURIComponent(riotName)}/` +
      `${encodeURIComponent(riotTag)}`;


    const rankResponse = await fetch(rankUrl, {
      headers: {
        Authorization: apiKey,
      },
    });

    
    const responseText = await rankResponse.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = null;
    }
    
    if (!rankResponse.ok || !result?.data) {
      console.error("HenrikDev error:", {
        status: rankResponse.status,
        response: responseText.slice(0, 500),
      });
    
      return res.status(502).send(
        `Errore nel recupero del rank (HTTP ${rankResponse.status}). Controlla i log di Vercel.`
      );
    }

    
  const current = result.data.current;
  
  const tier = current?.tier?.name || "Rank non disponibile";
  const rr = current?.rr;
  const lastChange = current?.last_change;
  
  const peak = result.data.peak?.tier?.name || "Non disponibile";
  
  const rrText = Number.isFinite(Number(rr))
    ? `(${rr}/100 RR)`
    : "";
  
  const changeText = Number.isFinite(Number(lastChange))
    ? ` (${Number(lastChange) > 0 ? "+" : ""}${lastChange} nell'ultima)`
    : "";
  
  return res.status(200).send(
    `${tier} ${rrText}${changeText} | Rank Peak: ${peak}`
  );

  } catch (error) {
    console.error("Rankme endpoint error:", error);
    return res.status(500).send("Errore interno durante il recupero del rank.");
  }
}
