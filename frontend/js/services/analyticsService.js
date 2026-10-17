const AnalyticsService = {
  async getSummary(period = "all", { from, to, divisionId } = {}) {
    const params = new URLSearchParams({ period });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (divisionId) params.set("divisionId", divisionId);
    return NtcApi.apiRequest(`/api/analytics/summary?${params}`, { auth: true });
  },
};

window.AnalyticsService = AnalyticsService;
