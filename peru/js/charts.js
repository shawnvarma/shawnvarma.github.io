/* Elevation profile of the whole trip (feet), coloured low / medium / high. */
const ZONES = [
  { name: "LOW", from: 0, to: 8000, color: "#6bbf8a", label: "under 8,000 ft" },
  { name: "MEDIUM", from: 8000, to: 11500, color: "#e8a33d", label: "8,000–11,500 ft" },
  { name: "HIGH", from: 11500, to: Infinity, color: "#e2574c", label: "over 11,500 ft" },
];
const zoneOf = (ft) => ZONES.find((z) => ft < z.to) || ZONES[2];

function renderElevation() {
  const box = $("#elev-chart");
  const pts = photos.filter((p) => gpsOf(p) && elev[p.id]).map((p) => ({ p, m: elev[p.id].m, ft: toFt(elev[p.id].m), k: dayOf(p) }));
  if (!pts.length) {
    box.innerHTML = `<p class="chart-empty">No elevations yet. Photos need a location (GPS in the file, or pin them on the map) before the climb can be drawn.</p>`;
    return;
  }
  const W = Math.max(520, box.clientWidth - 20), H = Math.max(340, Math.min(520, window.innerHeight - 260));
  const pad = { l: 66, r: 112, t: 20, b: 58 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const top = Math.max(12000, Math.ceil(Math.max(...pts.map((x) => x.ft)) / 2000) * 2000);
  const y = (ft) => pad.t + (1 - Math.max(0, ft) / top) * ph;

  // x slots: one per photo, with extra breathing room between days
  let slot = 0;
  pts.forEach((pt, i) => { if (i && pt.k !== pts[i - 1].k) slot += 1.8; pt.slot = slot; slot += 1; });
  const total = Math.max(1, slot - 1);
  pts.forEach((pt) => (pt.x = pts.length === 1 ? pad.l + pw / 2 : pad.l + (pt.slot / total) * pw));

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Elevation profile">`;
  for (const z of ZONES) {
    const hi = Math.min(z.to, top);
    if (z.from >= top) continue;
    svg += `<rect x="${pad.l}" y="${y(hi)}" width="${pw}" height="${y(z.from) - y(hi)}" fill="${z.color}" opacity=".08"/>`;
    svg += `<text x="${pad.l + 10}" y="${y(hi) + 15}" class="zn" fill="${z.color}">${z.name} <tspan class="zr">${z.label}</tspan></text>`;
  }
  for (let ft = 0; ft <= top; ft += 2000) svg += `<line x1="${pad.l}" x2="${pad.l + pw}" y1="${y(ft)}" y2="${y(ft)}" stroke="#2f2923"/><text x="${pad.l - 10}" y="${y(ft) + 4}" text-anchor="end" class="ax">${ft.toLocaleString()} ft</text>`;
  for (const ref of [{ n: "Cusco", m: 3399 }, { n: "Machu Picchu", m: 2430 }]) {
    const r = toFt(ref.m);
    svg += `<line x1="${pad.l}" x2="${pad.l + pw}" y1="${y(r)}" y2="${y(r)}" stroke="#a39a90" stroke-dasharray="3 5" opacity=".7"/><text x="${pad.l + pw + 6}" y="${y(r) + 4}" class="ref">${ref.n}</text>`;
  }
  if (pts.length > 1) {
    const line = pts.map((pt, i) => `${i ? "L" : "M"}${pt.x.toFixed(1)},${y(pt.ft).toFixed(1)}`).join("");
    svg += `<path d="${line}L${pts[pts.length - 1].x},${y(0)}L${pts[0].x},${y(0)}Z" fill="#e8a33d" opacity=".12"/><path d="${line}" fill="none" stroke="#e8a33d" stroke-width="2.5" stroke-linejoin="round"/>`;
  }
  // day labels
  const seen = new Set();
  pts.forEach((pt) => {
    if (seen.has(pt.k)) return;
    seen.add(pt.k);
    const mine = pts.filter((q) => q.k === pt.k), cx = (mine[0].x + mine[mine.length - 1].x) / 2;
    svg += `<text x="${cx}" y="${H - 34}" text-anchor="middle" class="ax">${dayLabel(pt.k, { month: "short", day: "numeric" })}</text>`;
    const place = dayPlace(pt.k);
    if (place) svg += `<text x="${cx}" y="${H - 18}" text-anchor="middle" class="pl">${place}</text>`;
  });
  pts.forEach((pt, i) => (svg += `<circle cx="${pt.x}" cy="${y(pt.ft)}" r="5" fill="${zoneOf(pt.ft).color}" stroke="#14110f" stroke-width="2" data-i="${i}" class="pt${isEst(pt.p) ? " est" : ""}"/>`));
  svg += "</svg>";
  box.innerHTML = svg + '<div id="elev-tip" hidden></div>';
  box._pts = pts;
}

(function wireElevation() {
  const box = () => $("#elev-chart");
  document.addEventListener("mouseover", (e) => {
    const c = e.target.closest?.("#elev-chart .pt");
    if (!c) return;
    const pt = box()._pts[+c.dataset.i], tip = $("#elev-tip"), d = dt(pt.p);
    const place = dayPlace(pt.k);
    tip.innerHTML = `<img src="${pt.p.thumb}" alt=""><div><b>${pt.ft.toLocaleString()} ft</b> <span>· ${Math.round(pt.m).toLocaleString()} m</span>` +
      `<br><span>${d ? fmt(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${place ? " · " + place : ""}</span>${isEst(pt.p) ? "<br><span>≈ approximate location</span>" : ""}</div>`;
    tip.hidden = false;
    const r = c.getBoundingClientRect(), b = box().getBoundingClientRect();
    tip.style.left = Math.min(r.left - b.left + 14, b.width - 260) + "px";
    tip.style.top = Math.max(0, r.top - b.top - 80) + "px";
  });
  document.addEventListener("mouseout", (e) => { if (e.target.closest?.("#elev-chart .pt")) $("#elev-tip").hidden = true; });
  document.addEventListener("click", (e) => {
    const c = e.target.closest?.("#elev-chart .pt");
    if (c) { const pt = box()._pts[+c.dataset.i]; location.hash = `#/day/${pt.k}/${pt.p.id}`; }
  });
  window.addEventListener("resize", () => { if (!$("#elev").hidden) renderElevation(); });
})();
