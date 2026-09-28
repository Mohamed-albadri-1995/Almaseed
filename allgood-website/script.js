// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("nav");

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

// Tabs (partners)
document.querySelectorAll("[role=tablist]").forEach((list) => {
  const tabs = [...list.querySelectorAll("[role=tab]")];

  function selectTab(tab) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !active;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Horizontal photo rows: arrow buttons move one item; buttons dim at the ends
document.querySelectorAll("[data-gallery]").forEach((g) => {
  const track = g.querySelector(".gallery__track");
  const [prev, next] = g.querySelectorAll(".gallery__btn");

  // In Arabic (right-to-left) the row scrolls the other way
  const rtl = getComputedStyle(track).direction === "rtl";

  function update() {
    const max = track.scrollWidth - track.clientWidth - 2;
    const pos = Math.abs(track.scrollLeft);
    prev.disabled = pos <= 2;
    next.disabled = pos >= max;
  }

  g.querySelectorAll(".gallery__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = track.querySelector(".gallery__item");
      const step = item ? item.getBoundingClientRect().width + 16 : track.clientWidth;
      track.scrollBy({ left: step * Number(btn.dataset.dir) * (rtl ? -1 : 1) });
    });
  });

  track.addEventListener("scroll", update, { passive: true });
  g.addEventListener("refresh", update);
  window.addEventListener("resize", update);
  update();
});

// Project details: each card opens its own window; close with ×, Esc or a click outside
document.querySelectorAll("[data-open]").forEach((btn) => {
  const dialog = document.getElementById(btn.dataset.open);
  btn.addEventListener("click", () => {
    dialog.showModal();
    dialog.querySelectorAll("[data-gallery]").forEach((g) => g.dispatchEvent(new Event("refresh")));
  });
});

document.querySelectorAll("dialog.modal").forEach((dialog) => {
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
});
