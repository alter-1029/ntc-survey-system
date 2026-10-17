const DivisionService = {
  async list({ auth = false } = {}) {
    return NtcApi.apiRequest("/api/divisions", auth ? { auth: true } : { surveyAuth: true });
  },
};

window.DivisionService = DivisionService;
