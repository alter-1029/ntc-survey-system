const ResponseService = {
  /** Signed-in survey user submits a completed response. */
  async submit(answers, divisionId) {
    return NtcApi.apiRequest("/api/responses", {
      method: "POST",
      surveyAuth: true,
      body: { answers, divisionId },
    });
  },

  /** Admin: paginated list of submissions, newest first. */
  async list({ page = 1, pageSize = 10, divisionId } = {}) {
    const params = new URLSearchParams({ page, pageSize });
    if (divisionId) params.set("divisionId", divisionId);
    return NtcApi.apiRequest(`/api/responses?${params}`, {
      auth: true,
    });
  },

  async getById(id) {
    return NtcApi.apiRequest(`/api/responses/${id}`, { auth: true });
  },

  async remove(id) {
    return NtcApi.apiRequest(`/api/responses/${id}`, { method: "DELETE", auth: true });
  },
};

window.ResponseService = ResponseService;
