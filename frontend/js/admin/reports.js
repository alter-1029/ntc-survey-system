(function () {
  const btn = document.getElementById("btn-export");
  const errorEl = document.getElementById("reports-error");
  const divisionSelect = document.getElementById("reports-division");

  async function fetchAllResponses(divisionId) {
    const all = [];
    let page = 1;
    let totalPages = 1;

    do {
      const data = await ResponseService.list({ page, pageSize: 100, divisionId });
      all.push(...data.items);
      totalPages = data.totalPages;
      page += 1;
    } while (page <= totalPages);

    return all;
  }

  async function refreshResponseCount() {
    const data = await ResponseService.list({
      page: 1,
      pageSize: 1,
      divisionId: divisionSelect.value || undefined,
    });
    document.getElementById("reports-response-count").textContent = data.total.toLocaleString();
  }

  async function loadDivisions() {
    const divisions = await DivisionService.list({ auth: true });
    divisions.forEach((division) => {
      const option = document.createElement("option");
      option.value = division.id;
      option.textContent = division.name;
      divisionSelect.appendChild(option);
    });
  }

  function toCsvValue(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function buildCsv(responses, questions) {
    const questionMap = new Map(questions.map((q) => [q.id, q.text]));
    const header = ["ID", "Submitted At", "Division", "Overall Rating", ...questions.map((q) => q.text)];

    const rows = responses.map((r) => {
      const answerByQuestion = new Map(r.answers.map((a) => [a.questionId, a.value]));
      return [
        r.id,
        r.submittedAt,
        r.divisionName || "",
        r.overallRating ?? "",
        ...questions.map((q) => answerByQuestion.get(q.id) ?? ""),
      ];
    });

    const lines = [header, ...rows].map((row) => row.map(toCsvValue).join(","));
    return lines.join("\n");
  }

  function downloadCsv(csv) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ntc-guest-satisfaction-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  btn.addEventListener("click", async () => {
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Preparing export...";

    try {
      const [responses, questions] = await Promise.all([
        fetchAllResponses(divisionSelect.value || undefined),
        QuestionService.getQuestions({ auth: true }),
      ]);

      if (responses.length === 0) {
        throw new Error("There are no responses to export yet.");
      }

      const divisionId = Number(divisionSelect.value);
      const selectedQuestions = divisionSelect.value
        ? questions.filter((question) => question.divisionId == null || question.divisionId === divisionId)
        : questions;
      const csv = buildCsv(responses, selectedQuestions);
      downloadCsv(csv);
    } catch (err) {
      errorEl.textContent = err.message || "Could not export responses.";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Download CSV";
    }
  });

  loadDivisions()
    .then(refreshResponseCount)
    .then(() => {
      NtcLiveRefresh.markUpdated();
      NtcLiveRefresh.start(refreshResponseCount, (error) => {
        errorEl.textContent = error.message || "Live report updates are temporarily unavailable.";
        errorEl.hidden = false;
      });
    })
    .catch((error) => {
      errorEl.textContent = error.message || "Could not load the current response count.";
      errorEl.hidden = false;
    });

  divisionSelect.addEventListener("change", () => {
    refreshResponseCount().catch((error) => {
      errorEl.textContent = error.message || "Could not update the response count.";
      errorEl.hidden = false;
    });
  });
})();
