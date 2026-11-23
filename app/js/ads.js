/* Shared monetization helper.
 * Loads Adsgram / Monetag ONLY when a block id is present in ads.json.
 * Empty ids → slots stay hidden, no third-party script, no console errors.
 * Interstitial: at most once per interstitialMinIntervalMs (default 180000).
 * Stars / affiliate hooks stay disabled until configured.
 */
(function (root) {
  "use strict";

  var cfg = null;
  var lastInterstitialAt = 0;
  var sdkPromise = null;
  var controllers = {};

  function $(sel, parent) {
    return (parent || document).querySelector(sel);
  }
  function $all(sel, parent) {
    return Array.prototype.slice.call((parent || document).querySelectorAll(sel));
  }

  function hasText(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function adsDisabledByStars() {
    try {
      return localStorage.getItem("miniapp-ads-removed") === "1";
    } catch (e) {
      return false;
    }
  }

  function isConfigured() {
    if (!cfg) return false;
    var ids = cfg.blockIds || {};
    return hasText(ids.banner) || hasText(ids.interstitial) || hasText(ids.rewarded);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!src) return reject(new Error("no sdk src"));
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute("data-loaded") === "1") return resolve();
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("sdk")); });
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { s.setAttribute("data-loaded", "1"); resolve(); };
      s.onerror = function () { reject(new Error("sdk")); };
      document.head.appendChild(s);
    });
  }

  function ensureSdk() {
    if (sdkPromise) return sdkPromise;
    if (!cfg || !isConfigured()) {
      return Promise.resolve(false);
    }
    var provider = (cfg.provider || "adsgram").toLowerCase();
    var src = (cfg.sdk && cfg.sdk[provider]) || "";
    if (!hasText(src)) {
      if (provider === "adsgram") src = "https://sad.adsgram.ai/js/sad.min.js";
      else return Promise.resolve(false);
    }
    sdkPromise = loadScript(src).then(function () { return true; }).catch(function () {
      sdkPromise = null;
      return false;
    });
    return sdkPromise;
  }

  function adsgramController(blockId) {
    if (!blockId || !root.Adsgram || !root.Adsgram.init) return null;
    if (controllers[blockId]) return controllers[blockId];
    try {
      controllers[blockId] = root.Adsgram.init({ blockId: blockId });
      return controllers[blockId];
    } catch (e) {
      return null;
    }
  }

  function hideSlots(scope) {
    $all("[data-ad-slot]", scope).forEach(function (el) {
      el.hidden = true;
      el.classList.add("is-empty");
    });
    $all("[data-affiliate]", scope).forEach(function (el) {
      var key = el.getAttribute("data-affiliate");
      var item = cfg && cfg.affiliates && cfg.affiliates[key];
      if (!item || !item.enabled || !hasText(item.url)) {
        el.hidden = true;
      }
    });
    $all("[data-stars]").forEach(function (el) {
      if (!cfg || !cfg.stars || !cfg.stars.enabled || !hasText(cfg.stars.sku)) {
        el.hidden = true;
      }
    });
  }

  function renderAffiliates(scope) {
    if (!cfg || !cfg.affiliates) return;
    Object.keys(cfg.affiliates).forEach(function (key) {
      var item = cfg.affiliates[key];
      $all('[data-affiliate="' + key + '"]', scope).forEach(function (el) {
        if (!item || !item.enabled || !hasText(item.url)) {
          el.hidden = true;
          return;
        }
        el.hidden = false;
        var a = el.querySelector("a") || el;
        if (a.tagName === "A") {
          a.href = item.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer sponsored";
        }
        var label = el.querySelector("[data-affiliate-label]");
        if (label && item.label) label.textContent = item.label;
      });
    });
  }

  function renderStars() {
    var stars = cfg && cfg.stars;
    var enabled = stars && stars.enabled && hasText(stars.sku) && !adsDisabledByStars();
    $all("[data-stars]").forEach(function (el) {
      el.hidden = !enabled;
      var lab = el.querySelector("[data-stars-label]");
      if (lab && stars && stars.label) lab.textContent = stars.label;
    });
  }

  function renderBanners(scope) {
    var id = cfg && cfg.blockIds && cfg.blockIds.banner;
    var show = hasText(id) && !adsDisabledByStars();
    $all('[data-ad-slot="banner"]', scope).forEach(function (el) {
      el.hidden = !show;
      el.classList.toggle("is-empty", !show);
      if (show) el.setAttribute("data-ad-block", id);
    });
    if (!show) return Promise.resolve();
    return ensureSdk().then(function (ok) {
      if (!ok) return;
      // Adsgram rewarded/interstitial are fullscreen; a banner block is reserved
      // for a future unit. We only mark the slot; we do not init with an empty id.
    });
  }

  function maybeInterstitial() {
    if (adsDisabledByStars()) return Promise.resolve(false);
    var id = cfg && cfg.blockIds && cfg.blockIds.interstitial;
    if (!hasText(id)) return Promise.resolve(false);
    var gap = (cfg.interstitialMinIntervalMs != null) ? cfg.interstitialMinIntervalMs : 180000;
    var now = Date.now();
    if (now - lastInterstitialAt < gap) return Promise.resolve(false);
    return ensureSdk().then(function (ok) {
      if (!ok) return false;
      var provider = (cfg.provider || "adsgram").toLowerCase();
      if (provider !== "adsgram") return false;
      var ad = adsgramController(id);
      if (!ad || !ad.show) return false;
      lastInterstitialAt = Date.now();
      return ad.show().then(function () { return true; }).catch(function () { return false; });
    });
  }

  function showRewarded() {
    if (adsDisabledByStars()) return Promise.resolve({ ok: false, reason: "removed" });
    var id = cfg && cfg.blockIds && cfg.blockIds.rewarded;
    if (!hasText(id)) return Promise.resolve({ ok: false, reason: "unconfigured" });
    return ensureSdk().then(function (ok) {
      if (!ok) return { ok: false, reason: "sdk" };
      var provider = (cfg.provider || "adsgram").toLowerCase();
      if (provider !== "adsgram") return { ok: false, reason: "provider" };
      var ad = adsgramController(id);
      if (!ad || !ad.show) return { ok: false, reason: "sdk" };
      return new Promise(function (resolve) {
        var rewarded = false;
        try {
          if (ad.addEventListener) {
            ad.addEventListener("onReward", function () { rewarded = true; });
          }
        } catch (e) {}
        ad.show().then(function (result) {
          var done = rewarded || (result && result.done);
          resolve({ ok: !!done, reason: done ? "ok" : "incomplete" });
        }).catch(function () {
          resolve({ ok: false, reason: "error" });
        });
      });
    });
  }

  function rewardedAvailable() {
    return !!(cfg && cfg.blockIds && hasText(cfg.blockIds.rewarded) && !adsDisabledByStars());
  }

  function openStars() {
    var stars = cfg && cfg.stars;
    if (!stars || !stars.enabled || !hasText(stars.sku)) return;
    var tg = root.Telegram && root.Telegram.WebApp;
    try {
      if (tg && tg.openInvoice) {
        tg.openInvoice(stars.sku, function (status) {
          if (status === "paid") {
            try { localStorage.setItem("miniapp-ads-removed", "1"); } catch (e) {}
            hideSlots();
            renderStars();
          }
        });
      }
    } catch (e) {}
  }

  function bind() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-stars]");
      if (t) {
        ev.preventDefault();
        openStars();
      }
    });
  }

  function apply(scope) {
    hideSlots(scope);
    renderAffiliates(scope);
    renderStars();
    return renderBanners(scope);
  }

  function init(json) {
    cfg = json || {};
    bind();
    apply(document);
    return cfg;
  }

  function load(url) {
    url = url || "data/ads.json";
    return fetch(url).then(function (r) {
      if (!r.ok) return {};
      return r.json();
    }).catch(function () { return {}; }).then(init);
  }

  root.MiniAds = {
    load: load,
    init: init,
    apply: apply,
    maybeInterstitial: maybeInterstitial,
    showRewarded: showRewarded,
    rewardedAvailable: rewardedAvailable,
    isConfigured: isConfigured,
    adsRemoved: adsDisabledByStars,
    config: function () { return cfg; }
  };
})(typeof window !== "undefined" ? window : globalThis);
