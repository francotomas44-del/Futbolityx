/* legal.js — carga y renderiza los documentos legales de docs/legal/*.md
   Sin dependencias. Fuente única: los archivos Markdown del repositorio. */
(function () {
  "use strict";

  var DOCS = [
    { id: "indice", file: "docs/legal/README.md", title: "Índice y versión" },
    { id: "terminos", file: "docs/legal/terminos-y-condiciones.md", title: "Términos y Condiciones" },
    { id: "pagos", file: "docs/legal/pagos-suscripciones-reembolsos.md", title: "Pagos y Reembolsos" },
    { id: "privacidad", file: "docs/legal/politica-de-privacidad.md", title: "Política de Privacidad" },
    { id: "cookies", file: "docs/legal/politica-de-cookies.md", title: "Política de Cookies" },
    { id: "descargo", file: "docs/legal/descargo-de-responsabilidad.md", title: "Descargo de Responsabilidad" },
    { id: "aviso", file: "docs/legal/aviso-legal.md", title: "Aviso Legal" },
    { id: "juego", file: "docs/legal/juego-responsable.md", title: "Juego Responsable (+18)" },
    { id: "propiedad", file: "docs/legal/propiedad-intelectual.md", title: "Propiedad Intelectual" },
    { id: "filosofia", file: "docs/legal/filosofia.md", title: "Filosofía" }
  ];

  var byFile = {};
  DOCS.forEach(function (d) {
    byFile[d.file.split("/").pop().toLowerCase()] = d;
  });

  var content = document.getElementById("legal-content");
  var nav = document.getElementById("legal-nav");
  if (!content || !nav) return;

  /* ---------- utilidades ---------- */

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slug(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function plain(s) {
    return String(s)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*`]/g, "")
      .trim();
  }

  function resolveHref(href, docId) {
    if (!href) return "#";
    var hashIdx = href.indexOf("#");
    var path = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    var frag = hashIdx >= 0 ? href.slice(hashIdx + 1) : "";

    if (!path) {
      return "#doc-" + docId + (frag ? "--" + frag : "");
    }

    if (path.indexOf("../../") === 0) {
      path = path.slice(6);
    } else if (path.indexOf("../") === 0) {
      path = "docs/" + path.slice(3);
    } else {
      var base = path.split("/").pop().toLowerCase();
      var d = byFile[base];
      if (d) {
        return "#doc-" + d.id + (frag ? "--" + frag : "");
      }
    }

    return path + (frag ? "#" + frag : "");
  }

  function inline(s, docId) {
    s = esc(s);

    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, href) {
      var h = resolveHref(href, docId);
      var external = /^https?:\/\//i.test(h);
      var attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return '<a href="' + esc(h) + '"' + attrs + ">" + text + "</a>";
    });

    return s;
  }

  function render(md, docId) {
    var lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var para = [];
    var i = 0;

    function flushPara() {
      if (!para.length) return;
      out.push("<p>" + inline(para.join(" "), docId) + "</p>");
      para = [];
    }

    while (i < lines.length) {
      var line = lines[i];
      var m;

      if (/^\s*$/.test(line)) {
        flushPara();
        i++;
        continue;
      }

      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        flushPara();
        var level = Math.min(6, m[1].length + 1); // h1 del .md -> h2 de la página
        var text = m[2].trim();
        var id = "doc-" + docId + "--" + slug(plain(text));
        out.push(
          "<h" + level + ' id="' + id + '">' + inline(text, docId) + "</h" + level + ">"
        );
        i++;
        continue;
      }

      if (/^\s*---+\s*$/.test(line)) {
        flushPara();
        out.push("<hr />");
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        flushPara();
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + render(quote.join("\n"), docId) + "</blockquote>");
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        flushPara();
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i++;
        }
        out.push(
          "<ul>" +
            items
              .map(function (t) {
                return "<li>" + inline(t, docId) + "</li>";
              })
              .join("") +
            "</ul>"
        );
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        flushPara();
        var oitems = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          oitems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i++;
        }
        out.push(
          "<ol>" +
            oitems
              .map(function (t) {
                return "<li>" + inline(t, docId) + "</li>";
              })
              .join("") +
            "</ol>"
        );
        continue;
      }

      para.push(line.trim());
      i++;
    }

    flushPara();
    return out.join("\n");
  }

  /* ---------- navegación ---------- */

  function buildNav() {
    nav.innerHTML = "";
    var title = document.createElement("p");
    title.className = "legal-nav-title";
    title.textContent = "Documentos";
    nav.appendChild(title);

    DOCS.forEach(function (d) {
      var a = document.createElement("a");
      a.href = "#doc-" + d.id;
      a.textContent = d.title;
      a.setAttribute("data-doc", d.id);
      nav.appendChild(a);
    });
  }

  function setActive(id) {
    var links = nav.querySelectorAll("a[data-doc]");
    for (var k = 0; k < links.length; k++) {
      links[k].classList.toggle("is-active", links[k].getAttribute("data-doc") === id);
    }
  }

  function trackActive() {
    var sections = content.querySelectorAll(".legal-doc");
    if (!sections.length) return;

    function onScroll() {
      var current = sections[0].id.replace(/^doc-/, "");
      var offset = 140;
      for (var k = 0; k < sections.length; k++) {
        if (sections[k].getBoundingClientRect().top <= offset) {
          current = sections[k].id.replace(/^doc-/, "");
        }
      }
      setActive(current);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- carga ---------- */

  buildNav();

  var loading = content.querySelector(".legal-loading");
  if (loading) loading.parentNode.removeChild(loading);

  var pending = DOCS.map(function (d) {
    return fetch(d.file)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (md) {
        return { doc: d, md: md };
      })
      .catch(function (err) {
        return { doc: d, error: err };
      });
  });

  Promise.all(pending).then(function (results) {
    var frag = document.createDocumentFragment();

    results.forEach(function (r) {
      var section = document.createElement("section");
      section.className = "legal-doc";
      section.id = "doc-" + r.doc.id;

      if (r.error) {
        section.innerHTML =
          '<p class="legal-error">No se pudo cargar <strong>' +
          esc(r.doc.title) +
          "</strong> (" +
          esc(r.error.message || "error") +
          "). Podés abrirlo en el repositorio: " +
          '<a href="' +
          esc(r.doc.file) +
          '">' +
          esc(r.doc.file) +
          "</a>.</p>";
      } else {
        section.innerHTML =
          render(r.md, r.doc.id) +
          '<p class="legal-top-link"><a href="#legal-top">↑ Volver arriba</a></p>';
      }

      frag.appendChild(section);
    });

    content.appendChild(frag);
    trackActive();

    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView();
        var docId = location.hash.slice(1).replace(/^doc-/, "").split("--")[0];
        setActive(docId);
      }
    }
  });
})();
