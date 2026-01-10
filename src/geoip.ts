export type GeoIP = { ip?: string; country_name?: string; city?: string };

export async function getGeoIP(): Promise<GeoIP> {
  try {
    const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!r.ok) return {};
    const j = await r.json();
    return { ip: j.ip, country_name: j.country_name, city: j.city };
  } catch {
    return {};
  }
}
