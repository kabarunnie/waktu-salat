(function () {
  const B = MiniBoot;
  const root = document.getElementById("screen");
  const CITY_KEY = "waktu-salat-city";
  const LOG_KEY = "waktu-salat-log";
  let cities = [];
  let view = "jadwal";
  let q = "";
  let tick = null;

  function city() {
    var saved = B.load(CITY_KEY, null);
    return saved || cities[0];
  }
  function tzDate(c) {
    var map = { 7: "Asia/Jakarta", 8: "Asia/Makassar", 9: "Asia/Jayapura" };
    var tz = map[c.tzHours] || "Asia/Jakarta";
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  }
  function isoFor(c) { return B.wibDateISO(tzDate(c)); } // still YYYY-MM-DD of local tz date object
  function times(c, date) {
    return WaktuSalatPray.compute({ date: date || tzDate(c), lat: c.lat, lon: c.lon, tzHours: c.tzHours, elevation: c.elevation || 0 });
  }
  function log() { return B.load(LOG_KEY, {}); }
  function setLog(d) { B.store(LOG_KEY, d); }
  function prayers() {
    return [
      { id: "subuh", name: "Subuh" },
      { id: "dzuhur", name: "Dzuhur" },
      { id: "ashar", name: "Ashar" },
      { id: "maghrib", name: "Maghrib" },
      { id: "isya", name: "Isya" }
    ];
  }
  function nextPrayer(t, date) {
    var now = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    var list = prayers();
    for (var i = 0; i < list.length; i++) {
      if (t.hours[list[i].id] > now) return list[i];
    }
    return { id: "subuh", name: "Subuh (besok)" };
  }
  function countdown(t, date, nxt) {
    var now = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    var hid = nxt.id.replace(/ \(besok\)/, "");
    var target = t.hours[hid] ;
    if (nxt.name && nxt.name.indexOf("besok") >= 0) target += 24;
    var m = Math.max(0, Math.round((target - now) * 60));
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }
  // Approx civil-to-hijri (tabular/Kuwaiti-style). Marked as perkiraan.
  function hijriApprox(date) {
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    var jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) +
      Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) -
      Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) + d - 32075;
    var l = jd - 1948440 + 10632;
    var n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = (Math.floor((10985 - l) / 5316)) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    var hm = Math.floor((24 * l) / 709);
    var hd = l - Math.floor((709 * hm) / 24);
    var hy = 30 * n + j - 30;
    var names = ["Muharam","Safar","Rabiulawal","Rabiulakhir","Jumadilawal","Jumadilakhir","Rajab","Syakban","Ramadan","Syawal","Zulkaidah","Zulhijah"];
    return { d: hd, m: hm, y: hy, name: names[Math.max(0, Math.min(11, hm - 1))] };
  }

  function render() {
    var c = city();
    var d = tzDate(c);
    var t = times(c, d);
    var iso = B.wibDateISO(d);
    var L = log();
    var todayLog = L[iso] || { checks: {} };
    var nxt = nextPrayer(t, d);
    var left = countdown(t, d, nxt);
    var h = hijriApprox(d);
    var html = '<div class="screen-fade">';
    html += '<div class="top"><div><div class="eyebrow">Perkiraan waktu salat</div><h1>Waktu Salat</h1></div>';
    html += '<div class="date-chip">' + B.escapeHtml(c.tzNote + " · " + B.formatIdDate(d)) + "</div></div>";

    html += '<div class="tabbar" style="position:relative;border-radius:16px;margin-bottom:14px">';
    [["jadwal","Jadwal"],["catat","Catatan"],["metode","Metode"]].forEach(function (x) {
      html += '<button class="' + (view === x[0] ? "on" : "") + '" data-view="' + x[0] + '">' + x[1] + "</button>";
    });
    html += "</div>";

    if (view === "jadwal") {
      html += '<label class="field">Kota</label><input class="search" id="q" type="search" placeholder="Cari kota…" value="' + B.escapeHtml(q) + '">';
      if (q) {
        var hits = cities.filter(function (x) {
          var s = (x.name + " " + x.province).toLowerCase();
          return s.indexOf(q.toLowerCase()) !== -1;
        }).slice(0, 8);
        html += '<div class="list card" style="margin-bottom:12px">' + hits.map(function (x) {
          return '<button class="row" data-city="' + B.escapeHtml(x.name) + '" style="width:100%;text-align:left"><span>' + B.escapeHtml(x.name) + '</span><span class="muted">' + B.escapeHtml(x.province) + "</span></button>";
        }).join("") + "</div>";
      }
      html += '<div class="card">';
      html += '<p class="muted">' + B.escapeHtml(c.name + " · " + c.province) + "</p>";
      html += '<p class="eyebrow" style="margin-top:8px">Menuju ' + B.escapeHtml(nxt.name) + "</p>";
      html += '<p class="clock" id="cd">' + left + "</p>";
      html += '<p class="muted">Kalender Hijriah (perkiraan, bukan isbat): ' + h.d + " " + h.name + " " + h.y + " H</p>";
      html += '<div class="list">';
      [["imsak","Imsak"],["subuh","Subuh"],["terbit","Terbit"],["dzuhur","Dzuhur"],["ashar","Ashar"],["maghrib","Maghrib"],["isya","Isya"]].forEach(function (row) {
        html += '<div class="row"><span>' + row[1] + (row[0]==="imsak" ? ' <span class="muted">−10 mnt</span>' : "") + '</span><span class="kpi">' + t.clock[row[0]] + "</span></div>";
      });
      html += "</div></div>";
      html += '<div class="warn-banner">Perkiraan dengan parameter sudut Kemenag (Subuh 20°, Isya 18°, ihtiyat +2 menit). Bukan jadwal resmi Kemenag atau masjid. Konfirmasikan ke masjid setempat.</div>';
      html += '<div class="card" style="margin-top:12px"><p class="lead">Ramadan 1448</p><p class="muted">Perkiraan media berdasarkan Kalender Hijriah Indonesia: 1 Ramadan sekitar 8 Februari 2027. <strong>Belum isbat Kemenag</strong> — tanggal resmi bisa berbeda.</p></div>';
      html += '<div class="btn-row"><button class="btn" id="share">Bagikan jadwal hari ini</button></div>';
      html += '<div data-ad-slot="banner" hidden></div>';
      html += '<div class="affiliate-row"><div data-affiliate="shopee" hidden><a href="#"><span data-affiliate-label>Shopee</span></a></div><div data-affiliate="tokopedia" hidden><a href="#"><span data-affiliate-label>Tokopedia</span></a></div></div>';
    } else if (view === "catat") {
      html += '<div class="card"><p class="lead">Tandai salat hari ini</p><p class="muted">Tersimpan hanya di perangkat ini.</p>';
      prayers().forEach(function (p) {
        var on = !!todayLog.checks[p.id];
        html += '<button class="choice ' + (on ? "correct" : "") + '" data-check="' + p.id + '">' + p.name + " · " + t.clock[p.id] + (on ? " ✓" : "") + "</button>";
      });
      var n = prayers().filter(function (p) { return todayLog.checks[p.id]; }).length;
      var streak = B.load("waktu-salat-streak", { count: 0, best: 0 });
      html += '<p class="muted" style="margin-top:12px">Hari ini ' + n + "/5 · beruntun " + (streak.count || 0) + " hari (hari dengan 5 tanda).</p></div>";
    } else {
      html += '<div class="card"><p class="lead">Metode perhitungan</p>';
      html += "<p class='muted' style='margin-top:8px'>Waktu dihitung di perangkatmu dari koordinat kota, tanggal, dan zona waktu. Rumus posisi matahari mengikuti metode yang didokumentasikan di praytimes.org.</p>";
      html += "<ul class='muted' style='margin:12px 0 0 18px;line-height:1.6'><li>Sudut Subuh 20°, Isya 18° (parameter yang sering dikaitkan dengan Kemenag; sudut yang sama juga dipakai MUIS dan JAKIM).</li><li>Ashar: mazhab Syafi'i (faktor bayangan 1).</li><li>Ihtiyat +2 menit pada Subuh, Dzuhur, Ashar, Maghrib, Isya.</li><li>Imsak = 10 menit sebelum Subuh (kebiasaan yang umum, bukan keputusan tunggal untuk semua daerah).</li><li>Pembulatan ke atas ke menit berikutnya.</li><li>Koordinat adalah perkiraan pusat kota, bukan titik masjid.</li></ul>";
      html += "<p class='note'>Ini bukan jadwal resmi. Perbedaan beberapa menit terhadap masjid setempat adalah hal biasa.</p></div>";
    }
    html += '<p class="footer-links">Aplikasi mandiri, tanpa saluran Telegram terpisah. Tidak ada nama orang atau lembaga pengelola di antarmuka.</p></div>';
    root.innerHTML = html;
    if (MiniAds && MiniAds.apply) MiniAds.apply(root);
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
      b.onclick = function () { view = b.getAttribute("data-view"); render(); };
    });
    var inp = document.getElementById("q");
    if (inp) {
      inp.oninput = function () { q = inp.value; render(); var n = document.getElementById("q"); if (n) { n.focus(); n.value = q; n.setSelectionRange(q.length, q.length); } };
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-city]"), function (b) {
      b.onclick = function () {
        var name = b.getAttribute("data-city");
        var found = cities.filter(function (x) { return x.name === name; })[0];
        if (found) { B.store(CITY_KEY, found); q = ""; render(); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-check]"), function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-check");
        var all = log();
        all[iso] = all[iso] || { checks: {} };
        all[iso].checks[id] = !all[iso].checks[id];
        setLog(all);
        var n = prayers().filter(function (p) { return all[iso].checks[p.id]; }).length;
        if (n === 5) B.updateStreak("waktu-salat-streak", iso);
        render();
      };
    });
    var sh = document.getElementById("share");
    if (sh) sh.onclick = function () {
      var lines = prayers().map(function (p) { return { text: p.name + "  " + t.clock[p.id], big: false }; });
      lines.unshift({ text: c.name + " · " + B.formatIdDate(d), muted: true });
      lines.push({ text: "Perkiraan, bukan jadwal resmi", muted: true });
      var card = B.drawShareCard({
        bg: "#0E1C1A", ink: "#F6F0E4", muted: "#C9B896", accent: "#E3C07A", wash: "rgba(227,192,122,0.12)",
        eyebrow: "Waktu Salat", title: "Hari ini",
        lines: lines,
        footer: "kabarunnie.github.io/waktu-salat"
      });
      var text = "Waktu Salat — " + c.name + "\n" + prayers().map(function (p) { return p.name + " " + t.clock[p.id]; }).join("\n") + "\nPerkiraan, bukan jadwal resmi.";
      B.shareCanvas(card, text, "https://kabarunnie.github.io/waktu-salat/");
    };
  }

  B.setupTelegram();
  Promise.all([
    fetch("data/cities.json").then(function (r) { return r.json(); }),
    MiniAds.load("data/ads.json")
  ]).then(function (res) {
    cities = res[0];
    render();
    clearInterval(tick);
    tick = setInterval(function () {
      var el = document.getElementById("cd");
      if (!el) return;
      var c = city(); var d = tzDate(c); var t = times(c, d);
      el.textContent = countdown(t, d, nextPrayer(t, d));
    }, 1000);
  }).catch(function () {
    root.innerHTML = '<p class="warn-banner">Gagal memuat daftar kota.</p>';
  });
})();
