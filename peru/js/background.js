/* Rotating page background: cross-fades through the photos listed in assets/backgrounds.json. */
(async function background() {
  const bg = $(".bg");
  let slides = [];
  try { slides = await (await fetch("assets/backgrounds.json", { cache: "no-store" })).json(); } catch {}
  if (!slides.length) return;
  const INTERVAL = 9000;
  slides.forEach((s) => { new Image().src = s.blur; new Image().src = s.sharp; });

  const slots = [0, 1].map(() => {
    const el = document.createElement("div");
    el.className = "slide";
    el.innerHTML = '<div class="wash"></div><div class="leaves"></div>';
    bg.appendChild(el);
    return el;
  });
  let i = Math.floor(Math.random() * slides.length), slot = 0;

  function show(n) {
    const s = slides[n], el = slots[slot];
    $(".wash", el).style.backgroundImage = `url('${s.blur}')`;
    $(".leaves", el).style.backgroundImage = `url('${s.sharp}')`;
    el.classList.add("on");
    slots[1 - slot].classList.remove("on");
    slot = 1 - slot;
  }
  show(i);
  if (slides.length > 1) {
    setInterval(() => { if (!document.hidden) { i = (i + 1) % slides.length; show(i); } }, INTERVAL);
  }
})();
