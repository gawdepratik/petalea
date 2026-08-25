const { BetaAnalyticsDataClient } = require("@google-analytics/data");

let client;
function getClient() {
  if (!client) {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n")
      }
    });
  }
  return client;
}

async function getAnalyticsSummary() {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId || !process.env.GA_SERVICE_ACCOUNT_EMAIL) {
    throw new Error("Google Analytics is not configured on this server");
  }

  const analyticsDataClient = getClient();
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: "7daysAgo", endDate: "today" }];

  const [[totals], [topPages], [topLocations]] = await Promise.all([
    analyticsDataClient.runReport({
      property,
      dateRanges,
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }]
    }),
    analyticsDataClient.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 8
    }),
    analyticsDataClient.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "city" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8
    })
  ]);

  const totalValues = totals.rows?.[0]?.metricValues || [];

  return {
    activeUsers7d: Number(totalValues[0]?.value || 0),
    sessions7d: Number(totalValues[1]?.value || 0),
    pageViews7d: Number(totalValues[2]?.value || 0),
    topPages: (topPages.rows || []).map((r) => ({
      title: r.dimensionValues[0].value,
      views: Number(r.metricValues[0].value)
    })),
    topLocations: (topLocations.rows || []).map((r) => ({
      label: r.dimensionValues[0].value,
      activeUsers: Number(r.metricValues[0].value)
    }))
  };
}

module.exports = { getAnalyticsSummary };
