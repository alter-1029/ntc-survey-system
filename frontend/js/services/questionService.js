const QuestionService = {
  async getCategories(options = {}) {
    return NtcApi.apiRequest("/api/categories", options);
  },

  async getQuestions(options = {}) {
    const { divisionId, ...requestOptions } = options;
    const url = divisionId === undefined
      ? "/api/questions"
      : `/api/questions?divisionId=${encodeURIComponent(divisionId)}`;
    return NtcApi.apiRequest(url, requestOptions);
  },

  /** Groups the flat question list by category, sorted, ready for rendering. */
  async getSurveyStructure(options = {}) {
    const [categories, questions] = await Promise.all([
      this.getCategories(options),
      this.getQuestions(options),
    ]);

    return categories
      .sort((a, b) => a.id - b.id)
      .map((category) => ({
        ...category,
        questions: questions
          .filter((q) => q.categoryId === category.id)
          .sort((a, b) => a.order - b.order),
      }))
      .filter((category) => category.questions.length > 0);
  },

  /** Admin only: add a new survey question. */
  async addQuestion({ categoryId, type, text, order, divisionId }) {
    return NtcApi.apiRequest("/api/questions", {
      method: "POST",
      auth: true,
      body: { categoryId, type, text, order, divisionId },
    });
  },

  /** Admin only: remove a survey question. */
  async removeQuestion(id) {
    return NtcApi.apiRequest(`/api/questions/${id}`, { method: "DELETE", auth: true });
  },
};

window.QuestionService = QuestionService;
