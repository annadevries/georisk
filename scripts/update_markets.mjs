import fs from "node:fs/promises";

const OZ_TO_KG = 32.150746568627; // 1 kg = 32.1507466 troy oz

async function stooqLast(symbol) {
  // Stooq "current quote" CSV
  // f=sd2t2ohlcv -> symbol,date,time,open,high,low,close,volume
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { headers: { "user-agent": "georisk/1.0" } });
  if (!res.ok) throw new Error(`${symbol} http ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`${symbol} no data`);
  const cols = lines[1].split(",");
  const close = Number(cols[6]);
  if (!Number.isFinite(close)) throw new Error(`${symbol} bad close`);
  return close;
}

async function main() {
  const path = new URL("../public/snapshot.json", import.meta.url);
  const raw = await fs.readFile(path, "utf8");
  const snap = JSON.parse(raw);

  // Stooq symbols:
  // XAUUSD = USD per troy oz
  // BTCUSD = USD per BTC
  // CL.F   = WTI crude oil futures (USD/bbl)
  // CB.F   = Brent crude oil futures (USD/bbl)
  const [xauUsdPerOz, btcUsd, wti, brent] = await Promise.all([
    stooqLast("xauusd"),
    stooqLast("btcusd"),
    stooqLast("cl.f"),
    stooqLast("cb.f"),
  ]);

  const goldUsdPerKg = xauUsdPerOz * OZ_TO_KG;

  snap.generated_at = new Date().toISOString();
  snap.markets = {
    gold_usd: goldUsdPerKg,   // now $/kg
    btc_usd: btcUsd,          // $/BTC
    wti_usd: wti,             // $/bbl
    brent_usd: brent          // $/bbl
  };

  await fs.writeFile(path, JSON.stringify(snap, null, 2) + "\n", "utf8");
  console.log("Updated markets:", snap.markets);
}

main().catch((e) => {
  console.error("update_markets failed:", e.message);
  process.exit(1);
});
