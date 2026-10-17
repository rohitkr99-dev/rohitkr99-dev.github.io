/**
 * Light / dark theme toggle.
 * The initial theme is applied by a tiny inline script in <head> (no flash);
 * this file wires the button and follows the OS setting until a choice is saved.
 */
(function () {
  "use strict";

  var KEY = "rc-theme";
  var root = document.documentElement;
  var btn = document.querySelector(".theme-toggle");

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0a0e17");
    if (!btn) return;
    var toLight = theme === "dark";
    btn.setAttribute("aria-label", toLight ? "Switch to light theme" : "Switch to dark theme");
    btn.setAttribute("title", toLight ? "Light theme" : "Dark theme");
    var icon = btn.querySelector("i");
    if (icon) icon.className = "bi " + (toLight ? "bi-sun-fill" : "bi-moon-stars-fill");
  }

  apply(root.getAttribute("data-theme") === "light" ? "light" : "dark");

  if (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: still works for this visit */ }
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function (e) {
      if (!saved()) apply(e.matches ? "light" : "dark");
    });
  }
})();
