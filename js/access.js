/* access.js — modo invitado local, sin autenticación.
   El invitado solo puede ver el panel "Hoy". El estado se guarda en
   localStorage para sobrevivir recargas y se publica como window.AD.access. */
(function () {
  "use strict";

  var AD = window.AD = window.AD || {};
  var KEY = "futbolityx:guest";
  var guest = false;
  var listeners = [];

  try { guest = localStorage.getItem(KEY) === "1"; } catch (e) { guest = false; }

  function apply() {
    try {
      document.body.classList.toggle("guest-mode", guest);
    } catch (e) {}
  }

  function isGuest() { return guest; }

  function setGuest(value) {
    guest = !!value;
    try {
      if (guest) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch (e) {}

    apply();

    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](guest); } catch (e) {}
    }
  }

  function onChange(callback) {
    if (typeof callback === "function") listeners.push(callback);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  AD.access = {
    KEY: KEY,
    isGuest: isGuest,
    setGuest: setGuest,
    enter: function () { setGuest(true); },
    exit: function () { setGuest(false); },
    onChange: onChange
  };
})();
