(function () {
  const loadingEl = document.getElementById("feedback-loading");
  const errorEl = document.getElementById("feedback-error");
  const divisionSelect = document.getElementById("feedback-division");
  const filterSummaryEl = document.getElementById("feedback-filter-summary");
  const tableEl = document.getElementById("feedback-table");
  const tbody = document.getElementById("feedback-tbody");
  const emptyEl = document.getElementById("feedback-empty");
  const paginationEl = document.getElementById("feedback-pagination");
  const summaryEl = document.getElementById("pagination-summary");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const detailDialog = document.getElementById("feedback-detail-dialog");
  const detailAnswers = document.getElementById("feedback-detail-answers");

  let currentPage = 1;
  let currentDivisionId = "";
  const pageSize = 10;

  function selectedDivisionName() {
    return divisionSelect.options[divisionSelect.selectedIndex].textContent;
  }

  function ratingBadgeClass(rating) {
    if (rating === null || rating === undefined) return "badge-info";
    if (rating >= 4) return "badge-success";
    if (rating >= 2.5) return "badge-warning";
    return "badge-danger";
  }

  function extractComment(response) {
    const textAnswer = response.answers.find((a) => typeof a.value === "string" && a.value.trim());
    return textAnswer ? textAnswer.value : "\u2014";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderRows(items) {
    tbody.innerHTML = "";
    items.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${r.id}</td>
        <td>${formatDate(r.submittedAt)}</td>
        <td>${escapeHtml(r.divisionName || "Not recorded")}</td>
        <td><span class="badge ${ratingBadgeClass(r.overallRating)}">${
        r.overallRating !== null ? r.overallRating.toFixed(2) : "N/A"
      }</span></td>
        <td>${escapeHtml(extractComment(r))}</td>
        <td>
          <div class="feedback-row-actions">
            <button type="button" class="btn btn-secondary" data-view="${r.id}">View</button>
            <button type="button" class="btn btn-secondary" data-delete="${r.id}">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => handleDelete(Number(btn.dataset.delete)));
    });
    tbody.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => handleView(Number(btn.dataset.view)));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function handleDelete(id) {
    if (!confirm(`Delete response #${id}? This cannot be undone.`)) return;
    try {
      await ResponseService.remove(id);
      await load(currentPage);
    } catch (err) {
      errorEl.textContent = err.message || "Could not delete response.";
      errorEl.hidden = false;
    }
  }

  async function handleView(id) {
    errorEl.hidden = true;
    try {
      const [response, questions] = await Promise.all([
        ResponseService.getById(id),
        QuestionService.getQuestions({ auth: true }),
      ]);
      document.getElementById("feedback-detail-title").textContent = `Response #${response.id}`;
      document.getElementById("detail-submitted").textContent = new Date(response.submittedAt).toLocaleString();
      document.getElementById("detail-division").textContent = response.divisionName || "Not recorded";
      document.getElementById("detail-rating").textContent = typeof response.overallRating === "number"
        ? `${response.overallRating.toFixed(2)} / 5`
        : "No numeric rating";

      const questionMap = new Map(questions.map((question) => [question.id, question.text]));
      detailAnswers.replaceChildren();
      response.answers.forEach((answer) => {
        const item = document.createElement("div");
        item.className = "feedback-detail-answer";
        const question = document.createElement("strong");
        question.textContent = questionMap.get(answer.questionId) || `Question ${answer.questionId}`;
        const value = document.createElement("p");
        value.textContent = answer.value === "na"
          ? "Not applicable"
          : typeof answer.value === "number"
            ? `${answer.value} / 5`
            : String(answer.value || "No comment provided");
        item.append(question, value);
        detailAnswers.appendChild(item);
      });
      detailDialog.showModal();
    } catch (err) {
      errorEl.textContent = err.message || "Could not load response details.";
      errorEl.hidden = false;
    }
  }

  async function load(page, { silent = false } = {}) {
    if (!silent) {
      loadingEl.hidden = false;
      tableEl.hidden = true;
      emptyEl.hidden = true;
      paginationEl.hidden = true;
    }
    errorEl.hidden = true;

    try {
      const data = await ResponseService.list({
        page,
        pageSize,
        divisionId: currentDivisionId || undefined,
      });
      currentPage = data.page;
      NtcLiveRefresh.markUpdated();
      filterSummaryEl.textContent = currentDivisionId
        ? `${data.total.toLocaleString()} responses for ${selectedDivisionName()}`
        : `${data.total.toLocaleString()} responses across all divisions`;

      loadingEl.hidden = true;

      if (data.items.length === 0) {
        tableEl.hidden = true;
        paginationEl.hidden = true;
        emptyEl.textContent = currentDivisionId
          ? `No responses recorded for ${selectedDivisionName()} yet.`
          : "No feedback submitted yet.";
        emptyEl.hidden = false;
        return;
      }

      renderRows(data.items);
      tableEl.hidden = false;

      paginationEl.hidden = false;
      const start = (data.page - 1) * data.pageSize + 1;
      const end = Math.min(data.page * data.pageSize, data.total);
      summaryEl.textContent = `Showing ${start}\u2013${end} of ${data.total} responses`;
      btnPrev.disabled = data.page <= 1;
      btnNext.disabled = data.page >= data.totalPages;
    } catch (err) {
      loadingEl.hidden = true;
      errorEl.textContent = err.message || "Could not load feedback.";
      errorEl.hidden = false;
      if (silent) throw err;
    }
  }

  btnPrev.addEventListener("click", () => load(currentPage - 1));
  btnNext.addEventListener("click", () => load(currentPage + 1));
  document.getElementById("close-feedback-detail").addEventListener("click", () => detailDialog.close());
  divisionSelect.addEventListener("change", () => {
    currentDivisionId = divisionSelect.value;
    load(1);
  });

  async function init() {
    try {
      const divisions = await DivisionService.list({ auth: true });
      divisions.forEach((division) => {
        const option = document.createElement("option");
        option.value = division.id;
        option.textContent = division.name;
        divisionSelect.appendChild(option);
      });
    } catch (error) {
      errorEl.textContent = error.message || "Could not load Region 2 divisions.";
      errorEl.hidden = false;
    }
    await load(1);
    NtcLiveRefresh.start(
      () => load(currentPage, { silent: true }),
      (error) => {
        errorEl.textContent = error.message || "Live feedback updates are temporarily unavailable.";
        errorEl.hidden = false;
      }
    );
    NtcLiveRefresh.start(
      () => load(currentPage, { silent: true }),
      (error) => {
        errorEl.textContent = error.message || "Live updates are temporarily unavailable.";
        errorEl.hidden = false;
      }
    );
  }

  init();
})();
