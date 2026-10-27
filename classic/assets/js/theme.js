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
    var dark = theme === "dark";
    btn.setAttribute("aria-checked", dark ? "true" : "false");
    btn.setAttribute("title", dark ? "Dark mode: on" : "Dark mode: off");
  }

  apply(root.getAttribute("data-theme") === "light" ? "light" : "dark");

  if (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: still works for this visit */ }
    });
  }
})();
