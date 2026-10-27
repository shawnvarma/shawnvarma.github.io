/* App shell: routing, timeline, day cards, day page + viewer, notes, zoom. */
let backTo = "#/"; // where Esc returns to (list, gallery, map...)
let photos = [], days = {}, dayKeys = [], dayPhotos = [], cur = 0, curDay = null, view = "single";

function groupDays() {
  days = {};
  photos.forEach((p) => (days[dayOf(p)] ||= []).push(p));
  dayKeys = Object.keys(days).sort();
}
const stat = (k, v, cls = "") => `<div class="stat ${cls}"><b>${k}</b><span>${v}</span></div>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- routing: #/  #/map  #/elev  #/day/YYYY-MM-DD[/photoId] ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const mode = parts[0] === "day" && days[parts[1]] ? "day" : ["map", "elev", "gallery"].includes(parts[0]) ? parts[0] : "days";
  if (mode !== "day") backTo = mode === "gallery" ? "#/gallery" : location.hash || "#/";
  $("#days").hidden = mode !== "days";
  $("#gallery").hidden = mode !== "gallery";
  $("#tripmap").hidden = mode !== "map";
  $("#elev").hidden = mode !== "elev";
  $("#day").hidden = mode !== "day";
  $("#tab-days").className = mode === "days" || mode === "day" ? "on" : "";
  $("#tab-gallery").className = mode === "gallery" ? "on" : "";
  $("#tab-map").className = mode === "map" ? "on" : "";
  $("#tab-elev").className = mode === "elev" ? "on" : "";
  $("#viewtoggle").hidden = mode !== "day";
  if (mode !== "day") dayVideo.pause();
  document.documentElement.classList.toggle("no-tl", mode === "map" || mode === "elev" || mode === "gallery"); // these pages get the full height
  setTimelineActive(mode === "day" ? parts[1] : null);
  if (typeof Lightbox !== "undefined") Lightbox.sync(mode === "gallery" ? parts[1] : null);
  if (mode === "days") updateCards();
  if (mode === "map") renderBigMap();
  if (mode === "elev") renderElevation();
  if (mode === "day") {
    if (curDay !== parts[1]) { curDay = parts[1]; dayPhotos = days[curDay]; renderDayShell(); }
    cur = Math.max(0, dayPhotos.findIndex((p) => p.id === parts[2]));
    setView(parts[2] ? "single" : view);
    if (view === "single") showPhoto();
  } else curDay = null;
}
const go = (i) => { location.hash = `#/day/${curDay}/${dayPhotos[(i + dayPhotos.length) % dayPhotos.length].id}`; };

/* ---------- trip timeline ---------- */
function renderTimeline() {
  const el = $("#timeline"), ks = dayKeys.filter((k) => k !== "undated");
  el.hidden = !ks.length;
  const day = 864e5;
  let html = "", prev = null, lastMonth = "";
  const tick = (k, n) => {
    const d = new Date(k + "T00:00:00Z"), mo = fmt(d, { month: "short", year: "2-digit" }).replace(" ", " ’");
    const label = mo !== lastMonth ? `<i>${mo}</i>` : "";
    lastMonth = mo;
    const dots = "•".repeat(Math.min(n, 4));
    const tip = `${fmt(d, { weekday: "short", month: "short", day: "numeric" })}${n ? ` · ${countLabel(days[k])}` : ""}`;
    return n ? `<button class="tick" data-k="${k}" title="${tip}">${label}<b>${d.getUTCDate()}</b><s>${dots}</s></button>`
      : `<span class="tick empty" title="${tip}">${label}<b>${d.getUTCDate()}</b></span>`;
  };
  ks.forEach((k) => {
    if (prev) {
      const gap = (Date.parse(k) - Date.parse(prev)) / day;
      if (gap > 11) { html += '<span class="tgap">⋯</span>'; lastMonth = ""; }
      else for (let n = 1; n < gap; n++) html += tick(new Date(Date.parse(prev) + n * day).toISOString().slice(0, 10), 0);
    }
    html += tick(k, days[k].length);
    prev = k;
  });
  el.innerHTML = html;
  setTimelineActive(curDay);
}
function setTimelineActive(k) {
  $$("#timeline .tick").forEach((t) => t.classList.toggle("on", t.dataset.k === k));
  const on = $("#timeline .tick.on");
  if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
}

/* ---------- days overview ---------- */
function renderDays() {
  $("#days").innerHTML = dayKeys.map((k) => {
    const ps = days[k];
    return `<a class="daycard" data-k="${k}" href="#/day/${k}"><div class="cover" style="background-image:url('${ps[0].thumb}')"><div class="shade"></div>` +
      `<span class="count">${countLabel(ps)}</span><div class="place"></div></div>` +
      `<div class="meta"><b>${dayLabel(k, { weekday: "long", month: "long", day: "numeric" })}</b><span class="sub">${dayLabel(k, { year: "numeric" })}</span>` +
      `<div class="chips"></div><p class="story"></p></div></a>`;
  }).join("");
  updateCards();
}
function updateCards() {
  $$(".daycard").forEach((c) => {
    const k = c.dataset.k, ps = days[k], located = ps.some(gpsOf);
    const place = dayPlace(k);
    const pl = $(".place", c);
    pl.textContent = place || (located ? "…" : "＋ add a place");
    pl.classList.toggle("empty", !place);
    const chips = [];
    if (dayWx[k]) chips.push(`<span class="chip">🌡 ${toF(dayWx[k].min)}°–${toF(dayWx[k].max)}°F</span>`);
    const ms = ps.map((p) => elev[p.id]?.m).filter((m) => m != null);
    if (ms.length) {
      chips.push(`<span class="chip">▲ ${toFt(Math.max(...ms)).toLocaleString()} ft</span>`);
    }
    const ne = ps.filter(isEst).length;
    if (ne) chips.push(`<span class="chip dim" title="Estimated from nearby photos">≈ ${ne} approx. location${ne > 1 ? "s" : ""}</span>`);
    if (!located) chips.push('<span class="chip dim">no location yet</span>');
    $(".chips", c).innerHTML = chips.join("");
    const st = store.days[k]?.story;
    $(".story", c).textContent = st || "";
    $(".story", c).hidden = !st;
  });
}

/* ---------- gallery mode: every photo, Flickr-style justified rows ---------- */
function renderGallery() {
  $("#gallery").innerHTML = photos.map((p) => {
    const d = dt(p);
    return `<a class="tile" data-id="${p.id}" href="#/gallery/${p.id}" style="--ar:${p.w / p.h}"><img loading="lazy" src="${p.thumb}" alt="">` +
      (gpsOf(p) ? (isEst(p) ? '<span class="pin est" title="Approximate location">≈</span>' : '<span class="pin">📍</span>') : "") + (isVideo(p) ? `<span class="vbadge">▶ ${clock(p.duration)}</span>` : "") +
      (d ? `<span class="when">${fmt(d, { month: "short", day: "numeric", year: "numeric" })}</span>` : "") + "</a>";
  }).join("");
}

/* ---------- day page ---------- */
function renderDayShell() {
  $("#strip").innerHTML = dayPhotos.map((p, i) => `<span class="st" data-i="${i}"><img src="${p.thumb}" alt="">${isVideo(p) ? '<i class="vb">▶</i>' : ""}</span>`).join("");
  $("#grid").innerHTML = dayPhotos.map((p, i) => `<div class="tile" data-i="${i}" style="--ar:${p.w / p.h}"><img src="${p.thumb}" alt="">${gpsOf(p) ? (isEst(p) ? '<span class="pin est" title="Approximate location">≈</span>' : '<span class="pin">📍</span>') : ""}${isVideo(p) ? `<span class="vbadge">▶ ${clock(p.duration)}</span>` : ""}</div>`).join("");
}
function setView(v) {
  view = v;
  $("#single").hidden = v !== "single";
  $("#grid").hidden = v !== "grid";
  $("#v-single").className = v === "single" ? "on" : "";
  $("#v-grid").className = v === "grid" ? "on" : "";
}
/* ---------- single photo viewer ---------- */
const stage = $("#stage"), img = $("#lb-img");
const dayVideo = VideoUI.attach(stage, $("#lb-video"));
function showPhoto() {
  const p = dayPhotos[cur];
  resetZoom();
  $("#b-zoom").hidden = isVideo(p);
  if (isVideo(p)) { img.hidden = true; dayVideo.load(p); }
  else { dayVideo.clear(); img.hidden = false; img.src = p.full; }
  document.documentElement.style.setProperty("--tint", p.color || "#14110f");
  $$("#strip .st").forEach((el, i) => {
    el.classList.toggle("on", i === cur);
    if (i === cur) el.scrollIntoView({ inline: "center", block: "nearest" });
  });
  const d = dt(p);
  $("#i-when").textContent = d ? fmt(d, { hour: "numeric", minute: "2-digit" }) + " · " + timeOfDay(d.getUTCHours()) : p.file;
  $("#i-sub").textContent = d ? `${fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${p.offset ? " · UTC" + p.offset : ""}` : "No timestamp in EXIF";
  const cam = [p.camera, p.lens, p.focal && `${Math.round(p.focal)}mm`, p.fnumber && `f/${p.fnumber}`, p.shutter, p.iso && `ISO ${p.iso}`].filter(Boolean);
  $("#i-cam").textContent = cam.join(" · ") || "—";
  $("#note").value = store.notes[p.id] || "";
  if (siteConfig.readonly) { $("#note").readOnly = true; $("#note-wrap").hidden = !store.notes[p.id]; }
  $("#i-stats").innerHTML = "";
  const g = gpsOf(p);
  setupMiniMap(p, g);
  renderPanelElev(p);
  if (g && d) loadWeather(p, g, d);
}

function renderPanelElev(p) {
  $$("#i-stats .elevstat").forEach((e) => e.remove());
  const c = $("#i-callout"), g = gpsOf(p), e = elev[p.id];
  c.innerHTML = "";
  if (!g) return;
  if (e) {
    $("#i-stats").insertAdjacentHTML("afterbegin", stat(e.src === "GPS" ? "Altitude (GPS)" : "Elevation", `${toFt(e.m).toLocaleString()} ft · ${Math.round(e.m).toLocaleString()} m`, "elevstat"));
  }
  if (g.est) c.insertAdjacentHTML("afterbegin", `<p class="hint est">≈ ${estNote(g)}</p>`);
  const lm = nearestLandmark(g, 12);
  if (lm) c.insertAdjacentHTML("beforeend", `<p class="hint">📍 ${lm.km < 1 ? Math.round(lm.km * 1000) + " m" : lm.km.toFixed(1) + " km"} from ${lm.n} (${toFt(lm.m).toLocaleString()} ft)</p>`);
}

// Temperature at the photo's hour plus the day's high/low (Open-Meteo historical weather: a model estimate for the area).
const toF = (c) => Math.round((c * 9) / 5 + 32);
async function loadWeather(p, g, d) {
  const day = p.taken.slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${g.lat}&longitude=${g.lon}&start_date=${day}&end_date=${day}` +
    `&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
  try {
    const j = await getJSON(url);
    if (dayPhotos[cur] !== p) return;
    const t = j.hourly.temperature_2m[Math.min(d.getUTCHours() + (d.getUTCMinutes() >= 30 ? 1 : 0), 23)];
    if (t == null) return;
    const hi = j.daily.temperature_2m_max[0], lo = j.daily.temperature_2m_min[0];
    $("#i-stats").insertAdjacentHTML("beforeend", stat("Temperature", `${toF(t)}°F` + (hi != null && lo != null ? ` <small>(H ${toF(hi)}° / L ${toF(lo)}°)</small>` : "")));
  } catch {}
}

/* ---------- mini map (with fly-to between photos, click to pin) ---------- */
let miniMap, miniMarker, miniPos = null;
function setupMiniMap(p, g) {
  if (!miniMap) {
    miniMap = L.map("i-map");
    tiles().addTo(miniMap);
    miniMap.on("click", (e) => {
      const q = dayPhotos[cur];
      if (siteConfig.readonly) return;
      if (gpsOf(q) && !gpsOf(q).manual && !gpsOf(q).est) return; // never override real EXIF GPS (estimates are fair game)
      store.pins[q.id] = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
      saveStore("pins");
      afterPinChange();
    });
  }
  if (view === "single") miniMap.invalidateSize();
  if (miniMarker) { miniMarker.remove(); miniMarker = null; }
  const links = $("#i-links");
  if (g) {
    const ll = [g.lat, g.lon];
    if (miniPos && haversine(miniPos[0], miniPos[1], g.lat, g.lon) > 0.2 && view === "single") miniMap.flyTo(ll, 14, { duration: 1.1 });
    else miniMap.setView(ll, 14);
    miniPos = ll;
    miniMarker = L.marker(ll, { icon: pinIcon(true, g.est) }).addTo(miniMap);
    $("#i-maphint").classList.toggle("est", !!g.est);
    $("#i-maphint").textContent = g.est ? (siteConfig.readonly ? "≈ approximate" : "≈ approximate. Click the map to set the exact spot.")
      : siteConfig.readonly ? "" : g.manual ? "Pinned manually — click the map to move it." : `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)} (from EXIF)`;
    links.innerHTML = `<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lon}">Open in Google Maps</a>` +
      `<a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${g.lat},${g.lon}">Street View</a>` +
      (g.manual && !siteConfig.readonly ? `<a href="#" id="clearpin">Remove pin</a>` : "");
    const c = $("#clearpin");
    if (c) c.onclick = (ev) => { ev.preventDefault(); delete store.pins[p.id]; saveStore("pins"); afterPinChange(); };
  } else {
    miniMap.setView([0, 0], 1);
    miniPos = null;
    $("#i-maphint").textContent = siteConfig.readonly ? "No location for this photo." : "No GPS data in this photo. Click the map to pin where it was taken.";
    links.innerHTML = "";
  }
}
async function afterPinChange() {
  renderDays();
  renderGallery();
  renderDayShell();
  renderTimeline();
  showPhoto();
  await loadElevations();
  resolveDayPlaces();
  loadDayWeather();
}

/* ---------- zoom + fullscreen ---------- */
const ZOOM = 2.6;
let base; // image box measured before zooming, so panning maps cursor -> origin without feedback
function resetZoom() { stage.classList.remove("zoomed", "panning"); $("#b-zoom").classList.remove("on"); img.style.transformOrigin = ""; }
function panTo(e) {
  const x = Math.min(100, Math.max(0, ((e.clientX - base.left) / base.width) * 100));
  const y = Math.min(100, Math.max(0, ((e.clientY - base.top) / base.height) * 100));
  img.style.transformOrigin = `${x}% ${y}%`;
}
function toggleZoom(e) {
  if (stage.classList.contains("zoomed")) return resetZoom();
  base = img.getBoundingClientRect();
  if (e && e.clientX != null) panTo(e); else img.style.transformOrigin = "50% 50%";
  stage.classList.add("zoomed");
  $("#b-zoom").classList.add("on");
}
img.addEventListener("click", toggleZoom);
$("#b-zoom").onclick = () => toggleZoom();
stage.addEventListener("mousemove", (e) => { if (stage.classList.contains("zoomed") && e.target === img) { stage.classList.add("panning"); panTo(e); } });
$("#b-full").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen());
document.addEventListener("fullscreenchange", resetZoom);

/* ---------- wiring ---------- */
const typing = (e) => ["TEXTAREA", "INPUT"].includes(e.target.tagName);
document.addEventListener("keydown", (e) => {
  if ($("#day").hidden || typing(e)) return;
  if (e.key === "Escape") {
    if (stage.classList.contains("zoomed")) resetZoom();
    else if (!document.fullscreenElement) location.hash = backTo;
    return;
  }
  if (view !== "single") return;
  if (e.key === " " && isVideo(dayPhotos[cur])) { e.preventDefault(); dayVideo.toggle(); return; }
  if (e.key === "ArrowRight") go(cur + 1);
  if (e.key === "ArrowLeft") go(cur - 1);
  if (e.key === "z") toggleZoom();
  if (e.key === "f") $("#b-full").click();
});
$(".prev").onclick = () => go(cur - 1);
$(".next").onclick = () => go(cur + 1);
$("#strip").onclick = (e) => { const t = e.target.closest(".st"); if (t) go(+t.dataset.i); };
$("#grid").onclick = (e) => { const t = e.target.closest(".tile"); if (t) go(+t.dataset.i); };
$("#v-single").onclick = () => { setView("single"); showPhoto(); };
$("#v-grid").onclick = () => setView("grid");
$("#tab-days").onclick = () => (location.hash = "#/");
$("#tab-gallery").onclick = () => (location.hash = "#/gallery");
$("#tab-map").onclick = () => (location.hash = "#/map");
$("#tab-elev").onclick = () => (location.hash = "#/elev");
$("#timeline").onclick = (e) => { const t = e.target.closest(".tick[data-k]"); if (t) location.hash = `#/day/${t.dataset.k}`; };
$("#note").addEventListener("input", () => {
  const p = dayPhotos[cur], v = $("#note").value;
  if (!p) return;
  if (v.trim()) store.notes[p.id] = v; else delete store.notes[p.id];
  saveStore("notes");
});
window.addEventListener("hashchange", route);
document.addEventListener("elev-ready", () => {
  updateCards();
  if (!$("#day").hidden && dayPhotos[cur]) renderPanelElev(dayPhotos[cur]);
  if (!$("#elev").hidden) renderElevation();
});
document.addEventListener("places-ready", () => {
  updateCards();
  if (!$("#elev").hidden) renderElevation();
});

(async function init() {
  await loadStore();
  photos = await (await fetch("data/photos.json", { cache: "no-store" })).json();
  groupDays();
  renderTimeline();
  renderDays();
  renderGallery();
  route();
  loadElevations();
  resolveDayPlaces();
  loadDayWeather();
})();
