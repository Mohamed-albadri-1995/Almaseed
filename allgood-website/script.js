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

// Tabs (products and partners); each tab list works on its own
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
