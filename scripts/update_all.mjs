import fs from "node:fs/promises";

const OZ_TO_KG = 32.150746568627;

async function stooqLast(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { headers: { "user-agent": "georisk/1.0" } });
  if (!res.ok) throw new Error(`${symbol} http ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const cols = (lines[1] || "").split(",");
  const close = Number(cols[6]);
  if (!Number.isFinite(close)) throw new Error(`${symbol} bad close`);
  return close;
}

async function main() {
  const snapPath = new URL("../public/snapshot.json", import.meta.url);
  const snap = JSON.parse(await fs.readFile(snapPath, "utf8"));

  const [xauUsdPerOz, btcUsd, wti, brent] = await Promise.all([
    stooqLast("xauusd"),
    stooqLast("btcusd"),
    stooqLast("cl.f"),
    stooqLast("cb.f"),
  ]);

  snap.generated_at = new Date().toISOString();
  snap.markets = {
    gold_usd: xauUsdPerOz * OZ_TO_KG,
    btc_usd: btcUsd,
    wti_usd: wti,
    brent_usd: brent
  };

  await fs.writeFile(snapPath, JSON.stringify(snap, null, 2) + "\n", "utf8");
  console.log("snapshot.json updated:", snap.generated_at);
}

main().catch(e => { console.error(e); process.exit(1); });
