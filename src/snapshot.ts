export type Snapshot = {
  generated_at: string;
  headlines: { title: string; region?: string }[];
  map_points: { lat: number; lon: number; title: string; kind: "news"|"flight"|"ship" }[];
  markets?: { gold_usd?: number; btc_usd?: number; wti_usd?: number; brent_usd?: number };
};

export async function loadSnapshot(): Promise<Snapshot> {
  const res = await fetch(`./snapshot.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("snapshot.json load failed");
  return res.json();
}

export function renderTicker(s: Snapshot) {
  const el = document.getElementById("tickerText")!;
  el.textContent = (s.headlines ?? []).map(h => h.title).join(" • ");
}

function intFormat(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function renderMarkets(s: Snapshot) {
  const m = s.markets ?? {};
  const el = document.getElementById("markets")!;

  const items: { key: string; val?: number; unit: string }[] = [
    { key: "GOLD",  val: m.gold_usd,  unit: "$/kg" },
    { key: "BTC",   val: m.btc_usd,   unit: "$" },
    { key: "WTI",   val: m.wti_usd,   unit: "$/bbl" },
    { key: "BRENT", val: m.brent_usd, unit: "$/bbl" }
  ];

  el.innerHTML = items
    .filter(i => typeof i.val === "number")
    .map(i => `
      <div class="market-pill">
        <b>${i.key}</b> ${intFormat(i.val!)} <span class="unit">${i.unit}</span>
      </div>
    `).join("");
}
