/* Shared helpers: persistence, formatting, and lookups (places, elevation, weather). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------- persistence: notes / days / pins live in site/data/*.json via serve.py ---------- */
const store = { notes: {}, days: {}, pins: {} }; // notes: id->text, days: date->{place,story}, pins: id->[lat,lon]
let storeOnline = false;
let siteConfig = {}; // data/config.json; the published copy sets {"readonly": true}
const saveTimers = {};
let saveMsgTimer;

function setSaveState(t) {
  const el = $("#savestate");
  if (!el) return;
  el.textContent = t;
  clearTimeout(saveMsgTimer);
  if (t === "Saved") saveMsgTimer = setTimeout(() => (el.textContent = ""), 1800);
}

async function loadStore() {
  try { const r = await fetch("data/config.json", { cache: "no-store" }); if (r.ok) siteConfig = await r.json(); } catch {}
  if (siteConfig.readonly) document.documentElement.classList.add("readonly");
  for (const name of Object.keys(store)) {
    try {
      const r = await fetch(`data/${name}.json`, { cache: "no-store" });
      store[name] = r.ok ? await r.json() : {};
      storeOnline = true;
    } catch { store[name] = ls.get("store." + name, {}); }
  }
  // one-time import of data that earlier versions kept only in the browser
  if (storeOnline && !ls.get("migrated1", false)) {
    const oldNotes = ls.get("notes", {}), oldPins = ls.get("manualLocations", {});
    for (const [k, v] of Object.entries(oldNotes)) if (!(k in store.notes)) store.notes[k] = v;
    for (const [k, v] of Object.entries(oldPins)) if (!(k in store.pins)) store.pins[k] = v;
    if (Object.keys(oldNotes).length) saveStore("notes");
    if (Object.keys(oldPins).length) saveStore("pins");
    ls.set("migrated1", true);
  }
}

function saveStore(name) {
  if (siteConfig.readonly) return;
  ls.set("store." + name, store[name]);
  setSaveState("Saving…");
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(async () => {
    try {
      const r = await fetch(`/api/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(store[name]) });
      setSaveState(r.ok ? "Saved" : "Saved in browser only (run serve.py)");
    } catch { setSaveState("Saved in browser only (run serve.py)"); }
  }, 500);
}

/* ---------- photo helpers ---------- */
const isVideo = (p) => p.type === "video";
const clock = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const countLabel = (ps) => {
  const v = ps.filter(isVideo).length, n = ps.length - v;
  return [n && `${n} photo${n > 1 ? "s" : ""}`, v && `${v} video${v > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
};
const gpsOf = (p) => {
  if (p.gps && !p.gps.est) return p.gps; // real location from the file
  const q = store.pins[p.id];
  if (q) return { lat: q[0], lon: q[1], manual: true }; // pinned by you; replaces any estimate
  return p.gps || null; // otherwise the estimate, if there is one
};
const isEst = (p) => !!gpsOf(p)?.est;
const estNote = (g) => `Approximate location, estimated from a photo taken ${g.estMin < 1 ? "under a minute" : Math.round(g.estMin) + " min"} away`;
// Photo times are local wall-clock; parse as UTC-labelled so display never shifts with the viewer's timezone.
const dt = (p) => (p.taken ? new Date(p.taken + "Z") : null);
const fmt = (d, o) => d.toLocaleString("en-US", { timeZone: "UTC", ...o });
const dayOf = (p) => (p.taken ? p.taken.slice(0, 10) : "undated");
const dayLabel = (k, o) => (k === "undated" ? "Undated" : fmt(new Date(k + "T00:00:00Z"), o));
function timeOfDay(h) {
  if (h < 5) return "Night"; if (h < 8) return "Early morning"; if (h < 12) return "Morning";
  if (h < 17) return "Afternoon"; if (h < 20) return "Evening"; return "Night";
}
function haversine(a, b, c, d) {
  const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const cache = {};
async function getJSON(url) {
  if (cache[url]) return cache[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return (cache[url] = await r.json());
}

/* ---------- Peru landmarks (approximate elevations, metres) ---------- */
const LANDMARKS = [
  { n: "Lima", lat: -12.0464, lon: -77.0428, m: 155 },
  { n: "Paracas", lat: -13.8333, lon: -76.25, m: 5 },
  { n: "Huacachina", lat: -14.0875, lon: -75.7626, m: 410 },
  { n: "Nazca", lat: -14.835, lon: -74.938, m: 590 },
  { n: "Arequipa", lat: -16.409, lon: -71.5375, m: 2335 },
  { n: "Puno", lat: -15.8402, lon: -70.0219, m: 3827 },
  { n: "Lake Titicaca", lat: -15.9254, lon: -69.3354, m: 3812, r: 25 },
  { n: "Cusco", lat: -13.532, lon: -71.9675, m: 3399 },
  { n: "Pisac", lat: -13.4219, lon: -71.8497, m: 2972 },
  { n: "Chinchero", lat: -13.3919, lon: -72.0472, m: 3762 },
  { n: "Moray", lat: -13.3295, lon: -72.1951, m: 3500 },
  { n: "Ollantaytambo", lat: -13.2583, lon: -72.2639, m: 2792 },
  { n: "Aguas Calientes", lat: -13.1544, lon: -72.5256, m: 2040, r: 4 },
  { n: "Machu Picchu", lat: -13.1631, lon: -72.545, m: 2430, r: 4 },
  { n: "Rainbow Mountain", lat: -13.8696, lon: -71.303, m: 5036, r: 8 },
  { n: "Huaraz", lat: -9.5277, lon: -77.5278, m: 3052 },
];
function nearestLandmark(g, maxKm = 10) {
  let best = null, bd = Infinity;
  for (const l of LANDMARKS) {
    const d = haversine(g.lat, g.lon, l.lat, l.lon);
    if (d < bd && d <= Math.min(maxKm, l.r ?? maxKm)) { best = l; bd = d; }
  }
  return best ? { ...best, km: bd } : null;
}

/* ---------- altitude is shown in feet first, metres second ---------- */
const toFt = (m) => Math.round(m * 3.28084);

/* ---------- elevation per photo: EXIF GPS altitude, else terrain lookup (Open-Meteo) ---------- */
const elev = {}; // photo id -> { m, src }
const ekey = (g) => g.lat.toFixed(3) + "," + g.lon.toFixed(3);
async function loadElevations() {
  Object.keys(elev).forEach((k) => delete elev[k]);
  const c = ls.get("cache.elev", {}), need = new Map(), waiting = [];
  for (const p of photos) {
    const g = gpsOf(p);
    if (!g) continue;
    if (g.alt != null) { elev[p.id] = { m: g.alt, src: "GPS" }; continue; }
    const k = ekey(g);
    if (c[k] != null) elev[p.id] = { m: c[k], src: "terrain" };
    else { need.set(k, g); waiting.push([p, k]); }
  }
  const entries = [...need.entries()];
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    try {
      const j = await getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((e) => e[1].lat).join(",")}&longitude=${chunk.map((e) => e[1].lon).join(",")}`);
      chunk.forEach(([k], n) => { if (j.elevation?.[n] != null) c[k] = j.elevation[n]; });
    } catch {}
  }
  ls.set("cache.elev", c);
  for (const [p, k] of waiting) if (c[k] != null) elev[p.id] = { m: c[k], src: "terrain" };
  document.dispatchEvent(new Event("elev-ready"));
}

/* ---------- place names per day ---------- */
const autoPlaces = {}; // day -> { place, country }
let geoChain = Promise.resolve();
function lookupPlace(g) {
  const lm = nearestLandmark(g, 8);
  if (lm) return Promise.resolve({ place: lm.n, country: "Peru" });
  const key = g.lat.toFixed(2) + "," + g.lon.toFixed(2);
  const hit = ls.get("cache.geo", {})[key];
  if (hit) return Promise.resolve(hit);
  const job = geoChain.then(async () => {
    try { // Nominatim asks for max 1 request/second
      const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${g.lat}&lon=${g.lon}`)).json();
      const a = j.address || {};
      const res = { place: a.city || a.town || a.village || a.municipality || a.county || a.state || null, country: a.country || "" };
      if (!res.place) return null;
      const c = ls.get("cache.geo", {}); c[key] = res; ls.set("cache.geo", c);
      return res;
    } catch { return null; }
    finally { await new Promise((r) => setTimeout(r, 1100)); }
  });
  geoChain = job.then(() => {}, () => {});
  return job;
}
async function resolveDayPlaces() {
  for (const k of dayKeys) {
    const g = days[k].map(gpsOf).find(Boolean);
    if (!g) { delete autoPlaces[k]; continue; }
    const r = await lookupPlace(g);
    if (r) autoPlaces[k] = r; else delete autoPlaces[k];
    document.dispatchEvent(new Event("places-ready"));
  }
}
const dayPlace = (k) => store.days[k]?.place || autoPlaces[k]?.place || "";

/* ---------- day weather summary (high / low) ---------- */
const dayWx = {}; // day -> { max, min }
async function dayWeather(k, g) {
  const key = `${k}|${g.lat.toFixed(2)},${g.lon.toFixed(2)}`;
  const c = ls.get("cache.wx", {});
  if (c[key]) return c[key];
  try {
    const j = await getJSON(`https://archive-api.open-meteo.com/v1/archive?latitude=${g.lat}&longitude=${g.lon}&start_date=${k}&end_date=${k}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    const v = { max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0] };
    if (v.max == null) return null;
    c[key] = v; ls.set("cache.wx", c);
    return v;
  } catch { return null; }
}
async function loadDayWeather() {
  for (const k of dayKeys) {
    if (k === "undated") continue;
    const g = days[k].map(gpsOf).find(Boolean);
    if (!g) { delete dayWx[k]; continue; }
    const v = await dayWeather(k, g);
    if (v) dayWx[k] = v; else delete dayWx[k];
    document.dispatchEvent(new Event("places-ready"));
  }
}
