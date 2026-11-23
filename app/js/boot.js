/* Shared Telegram Mini App boot: theme, toast, WIB dates, canvas share cards. */
(function (root) {
  "use strict";

  var tg = root.Telegram && root.Telegram.WebApp;

  function params() {
    return new URLSearchParams(location.search);
  }

  function tgAtLeast(ver) {
    try { return !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(ver)); }
    catch (e) { return false; }
  }

  function applyTheme() {
    var docEl = document.documentElement;
    var dark = false;
    if (tg && tg.colorScheme) dark = tg.colorScheme === "dark";
    else if (root.matchMedia) dark = root.matchMedia("(prefers-color-scheme: dark)").matches;
    if (params().get("theme")) dark = params().get("theme") === "dark";
    docEl.classList.toggle("dark", dark);
    var tp = (tg && tg.themeParams) || {};
    if (tp.bg_color) docEl.style.setProperty("--tg-bg", tp.bg_color);
    if (tp.secondary_bg_color) docEl.style.setProperty("--tg-bg2", tp.secondary_bg_color);
    if (tp.text_color) docEl.style.setProperty("--tg-text", tp.text_color);
    if (tp.hint_color) docEl.style.setProperty("--tg-hint", tp.hint_color);
    if (tgAtLeast("6.1")) {
      try {
        var bg = getComputedStyle(docEl).getPropertyValue("--bg").trim();
        if (bg) { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); }
      } catch (e) {}
    }
  }

  function setupTelegram() {
    applyTheme();
    if (!tg) return;
    try { tg.ready(); tg.expand(); } catch (e) {}
    try { tg.onEvent && tg.onEvent("themeChanged", applyTheme); } catch (e) {}
  }

  function wibNow() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  }

  function wibDateISO(d) {
    d = d || wibNow();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function formatIdDate(d) {
    d = d || wibNow();
    try {
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        timeZone: "Asia/Jakarta"
      }).format(d);
    } catch (e) {
      return wibDateISO(d);
    }
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.add("hidden"); }, 2400);
  }

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function updateStreak(storageKey, todayISO) {
    var s = load(storageKey, { last: null, count: 0, best: 0 });
    if (s.last === todayISO) return s;
    var yest = new Date(todayISO + "T12:00:00+07:00");
    yest.setDate(yest.getDate() - 1);
    var yiso = wibDateISO(new Date(yest.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })));
    // Simpler: compare calendar days via Date
    var last = s.last;
    var next = 1;
    if (last) {
      var a = new Date(last + "T12:00:00+07:00");
      var b = new Date(todayISO + "T12:00:00+07:00");
      var diff = Math.round((b - a) / 86400000);
      if (diff === 1) next = (s.count || 0) + 1;
      else if (diff === 0) next = s.count || 1;
    }
    s = { last: todayISO, count: next, best: Math.max(s.best || 0, next) };
    store(storageKey, s);
    return s;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Draw an original share card (no third-party assets).
   * opts: { width, height, bg, ink, muted, accent, accentInk, title, eyebrow, lines[], footer, pips[] }
   * pips: [{color, x?}] colored squares like a Wordle grid.
   */
  function drawShareCard(opts) {
    var w = opts.width || 1080;
    var h = opts.height || 1350;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = opts.bg || "#FAF6EF";
    ctx.fillRect(0, 0, w, h);
    // original geometric wash
    ctx.fillStyle = opts.wash || "rgba(0,0,0,0.04)";
    ctx.beginPath();
    ctx.arc(w * 0.9, -h * 0.05, w * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-w * 0.1, h * 0.95, w * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = opts.accent || "#C44B1A";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.letterSpacing = "0.18em";
    ctx.fillText((opts.eyebrow || "").toUpperCase(), 80, 120);

    ctx.fillStyle = opts.ink || "#1A120C";
    ctx.font = "italic 700 84px Georgia, serif";
    ctx.letterSpacing = "0";
    wrapText(ctx, opts.title || "", 80, 230, w - 160, 92);

    var y = opts.titleY || 360;
    (opts.lines || []).forEach(function (line) {
      ctx.fillStyle = line.muted ? (opts.muted || "#6B5E52") : (opts.ink || "#1A120C");
      ctx.font = (line.big ? "700 56px system-ui, sans-serif" : "600 36px system-ui, sans-serif");
      var lines = wrapText(ctx, line.text, 80, y, w - 160, line.big ? 64 : 48);
      y += (lines || 1) * (line.big ? 64 : 48) + 16;
    });

    if (opts.pips && opts.pips.length) {
      y += 20;
      var size = 72, gap = 14;
      var row = opts.pips;
      // if array of arrays, multiple rows
      var rows = Array.isArray(row[0]) ? row : [row];
      rows.forEach(function (r) {
        r.forEach(function (p, i) {
          ctx.fillStyle = typeof p === "string" ? p : (p.color || "#ccc");
          roundRect(ctx, 80 + i * (size + gap), y, size, size, 14);
          ctx.fill();
        });
        y += size + gap;
      });
    }

    ctx.fillStyle = opts.muted || "#6B5E52";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(opts.footer || "", 80, h - 80);
    return c;
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    if (!text) return 0;
    var words = String(text).split(" ");
    var line = "";
    var n = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + n * lh);
        line = words[i];
        n++;
      } else line = test;
    }
    ctx.fillText(line, x, y + n * lh);
    return n + 1;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, "image/png");
      else {
        var data = canvas.toDataURL("image/png");
        var bin = atob(data.split(",")[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/png" }));
      }
    });
  }

  function shareCanvas(canvas, text, url) {
    return canvasToBlob(canvas).then(function (blob) {
      var file = new File([blob], "kartu.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text, url: url }).catch(function () {});
      }
      if (tg && tg.openTelegramLink) {
        var share = "https://t.me/share/url?url=" + encodeURIComponent(url || location.href) +
          "&text=" + encodeURIComponent(text || "");
        try { tg.openTelegramLink(share); return; } catch (e) {}
      }
      // download fallback
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kartu.png";
      a.click();
      if (text && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + (url ? "\n" + url : "")).catch(function () {});
      }
      toast("Kartu disimpan. Teks siap ditempel.");
    });
  }

  function shareText(text, url) {
    var full = text + (url ? "\n" + url : "");
    if (tg && tg.openTelegramLink) {
      var share = "https://t.me/share/url?url=" + encodeURIComponent(url || location.href) +
        "&text=" + encodeURIComponent(text || "");
      try { tg.openTelegramLink(share); return; } catch (e) {}
    }
    if (navigator.share) {
      navigator.share({ text: text, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(function () { toast("Tersalin."); });
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  root.MiniBoot = {
    tg: tg,
    params: params,
    setupTelegram: setupTelegram,
    applyTheme: applyTheme,
    wibNow: wibNow,
    wibDateISO: wibDateISO,
    formatIdDate: formatIdDate,
    toast: toast,
    store: store,
    load: load,
    updateStreak: updateStreak,
    drawShareCard: drawShareCard,
    shareCanvas: shareCanvas,
    shareText: shareText,
    escapeHtml: escapeHtml,
    tgAtLeast: tgAtLeast
  };
})(typeof window !== "undefined" ? window : globalThis);
