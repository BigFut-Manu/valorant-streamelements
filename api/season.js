
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const {
    HENRIK_API_KEY,
    RIOT_NAME,
    RIOT_TAG,
    VAL_REGION
  } = process.env;

  if (!HENRIK_API_KEY || !RIOT_NAME || !RIOT_TAG || !VAL_REGION) {
    return res.status(500).json({
      error: "Configurazione API incompleta"
    });
  }

  try {
    const url =
      "https://api.henrikdev.xyz/valorant/v3/mmr/" +
      `${encodeURIComponent(VAL_REGION)}/pc/` +
      `${encodeURIComponent(RIOT_NAME)}/` +
      `${encodeURIComponent(RIOT_TAG)}`;

    const response = await fetch(url, {
      headers: { Authorization: HENRIK_API_KEY }
    });

    const result = await response.json();
    const data = result?.data;

    return res.status(response.ok ? 200 : 502).json({
      apiStatus: response.status,
      keys: data ? Object.keys(data) : [],
      seasonal: data?.seasonal ?? null,
      peak: data?.peak ?? null,
      current: data?.current ?? null
    });
  } catch {
    return res.status(502).json({
      error: "Errore nella richiesta HenrikDev"
    });
  }
}
