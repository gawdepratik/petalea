(function () {
  if (typeof GA_MEASUREMENT_ID === "undefined" || !GA_MEASUREMENT_ID) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
})();
