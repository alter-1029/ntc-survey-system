(function () {
  const loadingEl = document.getElementById("questions-loading");
  const listEl = document.getElementById("questions-list");
  const errorEl = document.getElementById("questions-error");
  const categorySelect = document.getElementById("q-category");
  const divisionSelect = document.getElementById("q-division");
  const form = document.getElementById("question-form");

  let structure = [];
  let divisions = [];

  function renderList() {
    listEl.innerHTML = "";
    structure.forEach((category) => {
      const group = document.createElement("div");
      group.style.marginBottom = "1.25rem";

      const heading = document.createElement("h4");
      heading.textContent = category.name;
      heading.style.marginBottom = "0.5rem";
      heading.style.fontSize = "0.95rem";
      group.appendChild(heading);

      const ul = document.createElement("ul");
      category.questions.forEach((q) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "0.5rem 0";
        li.style.borderBottom = "1px solid var(--border-color)";
        li.style.fontSize = "0.9rem";

        const label = document.createElement("span");
        label.textContent = `${q.text} `;
        const badge = document.createElement("span");
        badge.className = "badge badge-info";
        badge.textContent = q.type === "rating" ? "Rating" : "Text";

        const scope = document.createElement("span");
        scope.className = q.divisionId ? "badge badge-warning" : "badge badge-info";
        const division = divisions.find((entry) => entry.id === q.divisionId);
        scope.textContent = division ? division.name : "All divisions";

        const wrap = document.createElement("span");
        wrap.appendChild(label);
        wrap.appendChild(badge);
        wrap.appendChild(scope);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-secondary";
        delBtn.textContent = "Remove";
        delBtn.style.padding = "0.35rem 0.7rem";
        delBtn.style.fontSize = "0.8rem";
        delBtn.addEventListener("click", () => handleRemove(q.id));

        li.appendChild(wrap);
        li.appendChild(delBtn);
        ul.appendChild(li);
      });

      group.appendChild(ul);
      listEl.appendChild(group);
    });
  }

  function populateCategorySelect() {
    categorySelect.innerHTML = "";
    structure.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      categorySelect.appendChild(opt);
    });
  }

  async function load() {
    try {
      [structure, divisions] = await Promise.all([
        QuestionService.getSurveyStructure({ auth: true }),
        NtcApi.apiRequest("/api/divisions", { auth: true }),
      ]);
      loadingEl.hidden = true;
      renderList();
      populateCategorySelect();
      populateDivisionSelect();
    } catch (err) {
      loadingEl.hidden = true;
      errorEl.textContent = err.message || "Could not load questions.";
      errorEl.hidden = false;
    }
  }

  function populateDivisionSelect() {
    const shared = divisionSelect.firstElementChild;
    divisionSelect.replaceChildren(shared);
    divisions.forEach((division) => {
      const option = document.createElement("option");
      option.value = division.id;
      option.textContent = division.name;
      divisionSelect.appendChild(option);
    });
  }

  async function handleRemove(id) {
    if (!confirm("Remove this question from the survey?")) return;
    try {
      await QuestionService.removeQuestion(id);
      await load();
    } catch (err) {
      errorEl.textContent = err.message || "Could not remove question.";
      errorEl.hidden = false;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const categoryId = Number(categorySelect.value);
    const divisionId = divisionSelect.value ? Number(divisionSelect.value) : null;
    const type = document.getElementById("q-type").value;
    const text = document.getElementById("q-text").value.trim();

    if (!text) return;

    const category = structure.find((c) => c.id === categoryId);
    const scopedQuestions = category
      ? category.questions.filter((question) => (question.divisionId || null) === divisionId)
      : [];
    const nextOrder = scopedQuestions.length + 1;

    try {
      await QuestionService.addQuestion({ categoryId, type, text, order: nextOrder, divisionId });
      document.getElementById("q-text").value = "";
      await load();
    } catch (err) {
      errorEl.textContent = err.message || "Could not add question.";
      errorEl.hidden = false;
    }
  });

  load();
})();
