/* Gallery lightbox: photo grows out of its tile to fill the window, arrows step through every photo,
   clicking the photo zooms in (move the mouse to pan), the x button or Esc shrinks it back into the gallery.
   State lives in the hash: #/gallery/<photoId>. */
const Lightbox = (() => {
  const el = $("#gl"), img = $("#gl-img"), vid = $("#gl-video"), bg = $("#gl-bg > div");
  const glVideo = VideoUI.attach($(".gl-ui"), vid);
  let media = img; // whichever of the two is showing
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ZOOM = 2.6;
  let idx = -1, isOpen = false, anim = null, zoomed = false, base = null;
  const tile = (id) => $(`#gallery .tile[data-id="${id}"]`);

  // where the photo sits when open: centred, leaving room for arrows and the caption
  function fit(p) {
    const vw = innerWidth, vh = innerHeight, bw = Math.max(120, vw - 160), bh = Math.max(120, vh - 120);
    const s = Math.min(bw / p.w, bh / p.h), w = p.w * s, h = p.h * s;
    return { left: (vw - w) / 2, top: 28 + (bh - h) / 2, width: w, height: h };
  }
  function place(p) {
    const b = fit(p);
    Object.assign(media.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" });
    return b;
  }
  const xform = (from, to) => `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

  function resetZoom() {
    zoomed = false;
    img.classList.remove("zoomed", "panning");
    img.style.transform = "";
    img.style.transformOrigin = "0 0";
  }
  function pan(e) { // origin follows the cursor over the un-zoomed photo box, so the whole photo can be explored
    const x = Math.min(1, Math.max(0, (e.clientX - base.left) / base.width)), y = Math.min(1, Math.max(0, (e.clientY - base.top) / base.height));
    img.style.transformOrigin = `${x * 100}% ${y * 100}%`;
  }
  function toggleZoom(e) {
    if (zoomed) return resetZoom();
    anim?.cancel();
    base = fit(photos[idx]);
    zoomed = true;
    pan(e);
    img.classList.add("zoomed");
    img.style.transform = `scale(${ZOOM})`;
  }

  function caption(p) {
    const d = dt(p), place = dayPlace(dayOf(p)), note = store.notes[p.id];
    const line = [d && fmt(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) + " · " + fmt(d, { hour: "numeric", minute: "2-digit" }), place, isEst(p) && "≈ approximate location"].filter(Boolean).join(" · ");
    $("#gl-cap").innerHTML = `<b>${line || p.file}</b>${note ? `<span>${esc(note)}</span>` : ""}`;
    $("#gl-count").textContent = `${idx + 1} / ${photos.length}`;
    $("#gl-details").href = `#/day/${dayOf(p)}/${p.id}`;
  }

  function show(id) {
    const i = photos.findIndex((p) => p.id === id);
    if (i < 0) return;
    const p = photos[i], first = !isOpen;
    idx = i;
    anim?.cancel();
    resetZoom();
    el.hidden = false;
    if (first) { el.classList.add("closing"); void el.offsetWidth; el.classList.remove("closing"); }
    media = isVideo(p) ? vid : img;
    img.hidden = isVideo(p);
    if (isVideo(p)) glVideo.load(p); else glVideo.clear();
    const box = place(p);
    if (!isVideo(p)) img.src = p.thumb; // already cached from the gallery; full size swaps in below
    bg.style.backgroundImage = `url('${p.thumb}')`;
    caption(p);
    const t = first && tile(id);
    if (t && !still) {
      anim = media.animate([{ transform: xform(t.getBoundingClientRect(), box) }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
    } else if (!first && !still) {
      anim = media.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    }
    isOpen = true;
    const f = new Image();
    f.onload = () => { if (photos[idx] === p && !isVideo(p)) img.src = p.full; };
    f.src = p.full;
    const next = photos[(i + 1) % photos.length];
    new Image().src = next.full;
  }

  function hide() {
    if (!isOpen) return;
    isOpen = false;
    const p = photos[idx], t = tile(p.id);
    resetZoom();
    glVideo.pause();
    anim?.cancel();
    el.classList.add("closing");
    let done = false;
    const finish = () => { if (done) return; done = true; glVideo.clear(); el.hidden = true; };
    if (!t || still) return finish();
    let r = t.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) { t.scrollIntoView({ block: "center", behavior: "instant" }); r = t.getBoundingClientRect(); }
    anim = media.animate([{ transform: "none" }, { transform: xform(r, fit(p)) }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
    anim.onfinish = finish;
    setTimeout(finish, 450); // animations pause in hidden tabs; never leave the viewer stuck open
  }

  // arrows swap in place (replaceState, so Back still leaves the lightbox in one step)
  function step(d) {
    if (!isOpen) return;
    const p = photos[(idx + d + photos.length) % photos.length];
    history.replaceState(null, "", `#/gallery/${p.id}`);
    show(p.id);
  }
  const close = () => { location.hash = "#/gallery"; };

  // called by the router with the photo id from the hash, or null
  const sync = (id) => { if (id) show(id); else hide(); };

  img.addEventListener("click", toggleZoom);
  el.addEventListener("mousemove", (e) => { if (zoomed) { img.classList.add("panning"); pan(e); } });
  $("#gl-prev").onclick = () => step(-1);
  $("#gl-next").onclick = () => step(1);
  $("#gl-close").onclick = close;
  el.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("resize", () => { if (isOpen) { resetZoom(); place(photos[idx]); } });
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") { if (zoomed) resetZoom(); else close(); }
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === " " && media === vid) glVideo.toggle();
    else return;
    e.preventDefault();
  });
  return { sync };
})();
