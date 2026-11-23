/* Waktu Salat — client-side prayer time calculation.
 *
 * Algorithm: standard solar-position method as documented at
 * https://praytimes.org/docs/calculation (equation of time + sun declination,
 * then hour-angle for each twilight angle). Implementation written for this app.
 *
 * Method "Kemenag-param" (NOT an official Kemenag schedule):
 *   - Subuh (Fajr) when the sun is 20° below the horizon
 *   - Isya when the sun is 18° below the horizon
 *     (same angles as commonly cited for Kemenag, and also MUIS Singapore / JAKIM)
 *   - Asr using the Shafi'i shadow factor 1 (majority practice in Indonesia)
 *   - Ihtiyat +2 minutes on Subuh, Dzuhur, Ashar, Maghrib, Isya
 *   - Imsak = Subuh minus 10 minutes (common Indonesian practice; not a nationwide decree)
 *   - Times are rounded up to the next whole minute after offsets
 *   - Terbit (sunrise) and terbenam (sunset) have no +2 ihtiyat
 *
 * Times may differ from the printed masjid / official Kemenag jadwal by several
 * minutes. Always confirm with the local masjid. This app is a helper, not an authority.
 */
(function (root) {
  "use strict";

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function dsin(d) { return Math.sin(d * DEG); }
  function dcos(d) { return Math.cos(d * DEG); }
  function dtan(d) { return Math.tan(d * DEG); }
  function darcsin(x) { return Math.asin(x) * RAD; }
  function darccos(x) { return Math.acos(x) * RAD; }
  function darctan2(y, x) { return Math.atan2(y, x) * RAD; }

  function julian(year, month, day) {
    if (month <= 2) { year -= 1; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = 357.529 + 0.98560028 * D;
    var q = 280.459 + 0.98564736 * D;
    var L = q + 1.915 * dsin(g) + 0.020 * dsin(2 * g);
    var e = 23.439 - 0.00000036 * D;
    var RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
    if (RA < 0) RA += 24;
    var decl = darcsin(dsin(e) * dsin(L));
    var eqt = q / 15 - RA;
    if (eqt > 12) eqt -= 24;
    if (eqt < -12) eqt += 24;
    return { decl: decl, eqt: eqt };
  }

  function midDay(jd, lw, tz, hours) {
    var sun = sunPosition(jd + hours / 24);
    return 12 - lw / 15 - sun.eqt + tz;
  }

  function sunAngleTime(jd, lat, lw, tz, angle, hours, direction) {
    var sun = sunPosition(jd + hours / 24);
    var decl = sun.decl;
    var noon = midDay(jd, lw, tz, hours);
    var t = (1 / 15) * darccos((-dsin(angle) - dsin(decl) * dsin(lat)) /
      (dcos(decl) * dcos(lat)));
    return noon + (direction === "ccw" ? -t : t);
  }

  function asrTime(jd, lat, lw, tz, factor, hours) {
    var sun = sunPosition(jd + hours / 24);
    var decl = sun.decl;
    var angle = -darccot(factor + dtan(Math.abs(lat - decl)));
    return sunAngleTime(jd, lat, lw, tz, angle, hours, "cw");
  }

  function darccot(x) { return Math.atan(1 / x) * RAD; }

  function riseSetAngle(elevation) {
    elevation = elevation || 0;
    return 0.833 + 0.0347 * Math.sqrt(Math.max(elevation, 0));
  }

  function fixHour(h) {
    h = h - 24 * Math.floor(h / 24);
    if (h < 0) h += 24;
    return h;
  }

  function ceilMinute(h) {
    if (!isFinite(h)) return null;
    var tot = Math.ceil(h * 60 - 1e-9);
    return fixHour(tot / 60);
  }

  function addMin(h, m) {
    if (h == null) return null;
    return h + m / 60;
  }

  function formatHHmm(h) {
    if (h == null || !isFinite(h)) return "--:--";
    h = fixHour(h);
    var tot = Math.round(h * 60);
    var hh = Math.floor(tot / 60) % 24;
    var mm = tot % 60;
    return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
  }

  /**
   * @param {object} opts
   *   date: Date (local civil date components used; timezone offset given separately)
   *   lat, lon, elevation, tzHours
   */
  function compute(opts) {
    var lat = opts.lat;
    var lon = opts.lon;
    var tz = opts.tzHours;
    var elv = opts.elevation || 0;
    var d = opts.date;
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var jd = julian(y, m, day) - lon / (15 * 24);

    var times = { imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    // Two iterations as in PrayTimes, to refine solar position at each event
    for (var i = 0; i < 2; i++) {
      times.dhuhr = midDay(jd, lon, tz, times.dhuhr);
      times.sunrise = sunAngleTime(jd, lat, lon, tz, riseSetAngle(elv), times.sunrise, "ccw");
      times.sunset = sunAngleTime(jd, lat, lon, tz, riseSetAngle(elv), times.sunset, "cw");
      times.fajr = sunAngleTime(jd, lat, lon, tz, 20, times.fajr, "ccw");
      times.isha = sunAngleTime(jd, lat, lon, tz, 18, times.isha, "cw");
      times.asr = asrTime(jd, lat, lon, tz, 1, times.asr);
      times.maghrib = times.sunset;
    }

    var out = {
      imsak: ceilMinute(addMin(times.fajr, -10)),
      subuh: ceilMinute(addMin(times.fajr, 2)),
      terbit: ceilMinute(times.sunrise),
      dzuhur: ceilMinute(addMin(times.dhuhr, 2)),
      ashar: ceilMinute(addMin(times.asr, 2)),
      maghrib: ceilMinute(addMin(times.maghrib, 2)),
      isya: ceilMinute(addMin(times.isha, 2)),
    };
    return {
      hours: out,
      clock: {
        imsak: formatHHmm(out.imsak),
        subuh: formatHHmm(out.subuh),
        terbit: formatHHmm(out.terbit),
        dzuhur: formatHHmm(out.dzuhur),
        ashar: formatHHmm(out.ashar),
        maghrib: formatHHmm(out.maghrib),
        isya: formatHHmm(out.isya),
      },
      method: {
        name: "Parameter Kemenag (sudut Subuh 20°, Isya 18°)",
        fajrAngle: 20,
        ishaAngle: 18,
        asr: "Syafi'i (faktor 1)",
        ihtiyatMinutes: 2,
        imsakBeforeSubuhMinutes: 10,
        rounding: "ke atas ke menit berikutnya",
        official: false,
        notice: "Perkiraan. Bukan jadwal resmi Kemenag atau masjid setempat. Konfirmasikan ke masjid terdekat."
      }
    };
  }

  root.WaktuSalatPray = { compute: compute, formatHHmm: formatHHmm, fixHour: fixHour };
})(typeof window !== "undefined" ? window : globalThis);
