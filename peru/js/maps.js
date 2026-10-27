/* Trip map (clustered thumbnails + fly-to) and shared map helpers. */
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tiles = () => L.tileLayer(TILES, { maxZoom: 19, attribution: "© OpenStreetMap" });

function pinIcon(drop, est) {
  const body = est
    ? `<path d="M12 1C5.9 1 1 5.8 1 11.7 1 19.4 12 31 12 31s11-11.6 11-19.3C23 5.8 18.1 1 12 1z" fill="rgba(232,163,61,.2)" stroke="#e8a33d" stroke-width="2" stroke-dasharray="3.5 2.5"/><circle cx="12" cy="11.5" r="4" fill="none" stroke="#e8a33d" stroke-width="2"/>`
    : `<path d="M12 0C5.4 0 0 5.2 0 11.7 0 20 12 32 12 32s12-12 12-20.3C24 5.2 18.6 0 12 0z" fill="#e8a33d" stroke="#14110f" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4.5" fill="#14110f"/>`;
  return L.divIcon({
    className: "",
    html: `<div class="pinwrap${drop ? " drop" : ""}"><svg viewBox="0 0 24 32" width="28" height="38">${body}</svg></div>`,
    iconSize: [28, 38], iconAnchor: [14, 38],
  });
}

/* ---------- trip map ---------- */
let bigMap, bigCluster, bigFitted = false, flying = false;
const thumbIcon = (p) => {
  const est = isEst(p);
  return L.divIcon({ className: "tp", html: `<img class="thumbpin${est ? " est" : ""}" src="${p.thumb}" alt="">${est ? '<i class="estb" title="Approximate location">≈</i>' : ""}`, iconSize: [54, 54], iconAnchor: [27, 27] });
};

function renderBigMap() {
  if (!bigMap) {
    bigMap = L.map("bigmap");
    tiles().addTo(bigMap);
    bigCluster = L.markerClusterGroup({
      maxClusterRadius: (z) => (z <= 6 ? 85 : z <= 10 ? 66 : 52), showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const first = c.getAllChildMarkers()[0].options.photo;
        return L.divIcon({ className: "", html: `<div class="cluster"><img src="${first.thumb}" alt=""><b>${c.getChildCount()}</b></div>`, iconSize: [58, 58], iconAnchor: [29, 29] });
      },
    });
    bigMap.addLayer(bigCluster);
    bigMap.setView([0, 0], 2);
    const sizePins = () => { const z = bigMap.getZoom(); $("#bigmap").style.setProperty("--pin", (z <= 5 ? 24 : z <= 8 ? 32 : z <= 11 ? 42 : 54) + "px"); };
    bigMap.on("zoomend", sizePins);
    sizePins();
  }
  bigCluster.clearLayers();
  const pts = [];
  photos.forEach((p) => {
    const g = gpsOf(p);
    if (!g) return;
    pts.push([g.lat, g.lon]);
    const m = L.marker([g.lat, g.lon], { icon: thumbIcon(p), photo: p });
    wireHover(m, p, [g.lat, g.lon]);
    bigCluster.addLayer(m);
  });
  setTimeout(() => {
    bigMap.invalidateSize();
    if (!bigFitted && pts.length) { bigMap.fitBounds(pts, { padding: [60, 60], maxZoom: 14 }); bigFitted = true; }
  }, 50);
}

// Hover: pin grows and a preview card opens above it (stays open while the pointer is on the card).
let popTimer, openPop = null;
function popupHTML(p) {
  const d = dt(p), place = dayPlace(dayOf(p)), note = store.notes[p.id], e = elev[p.id];
  const line = [d && fmt(d, { month: "short", day: "numeric", year: "numeric" }), place, isVideo(p) && "▶ video " + clock(p.duration), isEst(p) && "≈ approximate location"].filter(Boolean).join(" · ");
  return `<img src="${p.thumb}" alt=""><div class="pp-meta"><b>${d ? fmt(d, { hour: "numeric", minute: "2-digit" }) + " · " + timeOfDay(d.getUTCHours()) : p.file}</b>` +
    `<span>${line}${e ? ` · ▲ ${toFt(e.m).toLocaleString()} ft` : ""}</span>` +
    (note ? `<em>${note.length > 90 ? note.slice(0, 90).replace(/[<>&]/g, "") + "…" : note.replace(/[<>&]/g, "")}</em>` : "") +
    `<button type="button">Open photo →</button></div>`;
}
function wireHover(m, p, ll) {
  const hold = () => clearTimeout(popTimer);
  const release = () => { clearTimeout(popTimer); popTimer = setTimeout(() => { if (openPop) bigMap.closePopup(openPop); }, 280); };
  m.on("mouseover", () => {
    hold();
    if (openPop) bigMap.closePopup(openPop);
    const pop = L.popup({ closeButton: false, autoPan: false, offset: [0, -42], className: "photo-pop", minWidth: 240, maxWidth: 240 }).setLatLng(ll).setContent(popupHTML(p));
    pop.openOn(bigMap);
    openPop = pop;
    m.setZIndexOffset(1500);
    m._icon && m._icon.classList.add("hot");
    const el = pop.getElement();
    el.addEventListener("mouseenter", hold);
    el.addEventListener("mouseleave", release);
    el.addEventListener("click", () => openPhoto(p, ll));
    pop.once("remove", () => { m.setZIndexOffset(0); m._icon && m._icon.classList.remove("hot"); if (openPop === pop) openPop = null; });
  });
  m.on("mouseout", release);
  m.on("click", () => openPhoto(p, ll));
}

// Short fly-over to the spot, then straight into the photo.
function openPhoto(p, ll) {
  if (flying) return;
  flying = true;
  let done = false;
  const nav = () => { if (done) return; done = true; flying = false; location.hash = `#/day/${dayOf(p)}/${p.id}`; };
  const near = bigMap.getZoom() >= 14 && bigMap.getCenter().distanceTo(ll) < 400;
  if (near) return nav();
  bigMap.once("moveend", nav);
  setTimeout(nav, 1300);
  bigMap.flyTo(ll, Math.max(bigMap.getZoom(), 14), { duration: 0.7 });
}
