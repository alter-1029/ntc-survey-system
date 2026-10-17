const SurveyAuthService = {
  async login(username, password, code) {
    const data = await NtcApi.apiRequest("/api/auth/survey-login", {
      method: "POST",
      body: { username, password, code },
    });
    NtcApi.setSurveySession(data.token, data.user);
    return data.user;
  },

  isLoggedIn() {
    return Boolean(NtcApi.getSurveyToken());
  },

  logout() {
    NtcApi.clearSurveySession();
  },
};

window.SurveyAuthService = SurveyAuthService;