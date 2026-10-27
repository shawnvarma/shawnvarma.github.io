/* Minimal video controls: big play button, then play/pause, a thin seek line, time, mute and a volume slider.
   One instance per <video>; the volume you choose is remembered. */
const VideoUI = (() => {
  const prefs = ls.get("videoPrefs", { vol: 0.8, muted: false });
  const svg = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">${inner}</svg>`;
  const ICON = {
    play: svg('<path d="M8 5v14l11-7z"/>'),
    pause: svg('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
    vol: svg('<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    mute: svg('<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  };

  function attach(host, video) {
    const big = document.createElement("button");
    big.type = "button"; big.className = "vbig"; big.setAttribute("aria-label", "Play"); big.innerHTML = svg('<path d="M8 5v14l11-7z"/>').replace('width="18" height="18"', 'width="34" height="34"');
    big.hidden = true;
    const bar = document.createElement("div");
    bar.className = "vbar"; bar.hidden = true;
    bar.innerHTML =
      `<button type="button" class="vplay" aria-label="Play or pause"></button><span class="vt">0:00</span>` +
      `<input class="vseek" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="vd">0:00</span>` +
      `<button type="button" class="vmute" aria-label="Mute"></button><input class="vvol" type="range" min="0" max="1" step="0.05" aria-label="Volume">`;
    host.append(big, bar);
    const q = (s) => bar.querySelector(s);
    const playB = q(".vplay"), tEl = q(".vt"), dEl = q(".vd"), seek = q(".vseek"), muteB = q(".vmute"), volEl = q(".vvol");
    let active = false, dragging = false;
    video.playsInline = true;
    video.preload = "metadata";

    const toggle = () => { if (video.paused) video.play().catch(() => {}); else video.pause(); };
    const syncPlay = () => {
      const playing = !video.paused && !video.ended;
      playB.innerHTML = playing ? ICON.pause : ICON.play;
      big.hidden = !active || playing;
    };
    const syncVol = () => {
      muteB.innerHTML = video.muted || video.volume === 0 ? ICON.mute : ICON.vol;
      volEl.value = video.muted ? 0 : video.volume;
    };
    const syncTime = () => {
      const d = isFinite(video.duration) ? video.duration : 0;
      tEl.textContent = clock(video.currentTime);
      dEl.textContent = clock(d);
      if (!dragging) seek.value = d ? (video.currentTime / d) * 1000 : 0;
    };

    ["play", "pause", "ended"].forEach((ev) => video.addEventListener(ev, syncPlay));
    ["timeupdate", "loadedmetadata", "durationchange"].forEach((ev) => video.addEventListener(ev, syncTime));
    video.addEventListener("volumechange", () => {
      syncVol();
      prefs.vol = video.volume; prefs.muted = video.muted;
      ls.set("videoPrefs", prefs);
    });
    video.addEventListener("click", toggle);
    big.onclick = toggle;
    playB.onclick = toggle;
    muteB.onclick = () => { video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 0.5; };
    volEl.addEventListener("input", () => { const v = +volEl.value; video.muted = v === 0; video.volume = v; });
    seek.addEventListener("input", () => { dragging = true; if (isFinite(video.duration)) video.currentTime = (seek.value / 1000) * video.duration; });
    seek.addEventListener("change", () => { dragging = false; });
    // after using a slider, give the keyboard back to the page (arrows should change photo, not nudge the slider)
    [seek, volEl].forEach((el) => el.addEventListener("change", () => el.blur()));

    const api = {
      load(p) {
        active = true;
        video.hidden = false; bar.hidden = false;
        video.volume = prefs.vol; video.muted = prefs.muted;
        video.poster = p.full;
        video.src = p.video;
        video.load();
        syncVol(); syncTime(); syncPlay();
      },
      clear() {
        active = false;
        video.pause();
        video.removeAttribute("src"); video.removeAttribute("poster");
        video.load();
        video.hidden = true; bar.hidden = true; big.hidden = true;
      },
      pause() { video.pause(); },
      toggle,
    };
    syncVol(); syncPlay();
    return api;
  }
  return { attach };
})();
