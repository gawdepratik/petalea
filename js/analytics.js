(function () {
  const CONSENT_KEY = "petalea_cookie_consent";
  const banner = document.getElementById("cookieBanner");
  const acceptButton = document.getElementById("cookieAccept");
  const declineButton = document.getElementById("cookieDecline");

  function loadGoogleAnalytics() {
    if (typeof GA_MEASUREMENT_ID === "undefined" || !GA_MEASUREMENT_ID || window.__gaLoaded) return;
    window.__gaLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);
  }

  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === "accepted") {
    loadGoogleAnalytics();
  } else if (consent !== "declined" && banner) {
    banner.hidden = false;
  }

  if (acceptButton) {
    acceptButton.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      loadGoogleAnalytics();
      banner.hidden = true;
    });
  }

  if (declineButton) {
    declineButton.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "declined");
      banner.hidden = true;
    });
  }
})();
