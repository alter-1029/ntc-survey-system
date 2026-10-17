(function () {
  const loginEl = document.getElementById("survey-login");
  const loginForm = document.getElementById("survey-signin-form");
  const loginErrorEl = document.getElementById("survey-login-error");
  const loginButton = document.getElementById("survey-signin-button");
  const loginCodeInput = document.getElementById("survey-login-code");
  const loginCodeField = document.getElementById("survey-qr-field");
  const loginCodeStatus = document.getElementById("survey-qr-status");
  const divisionStepEl = document.getElementById("survey-division-step");
  const divisionForm = document.getElementById("survey-division-form");
  const divisionErrorEl = document.getElementById("survey-division-error");
  const divisionSelect = document.getElementById("survey-division-select");
  const divisionDescription = document.getElementById("survey-division-description");
  const divisionButton = document.getElementById("survey-division-continue");
  const loadingEl = document.getElementById("survey-loading");
  const errorEl = document.getElementById("survey-error");
  const formEl = document.getElementById("survey-form");
  const progressEl = document.getElementById("survey-progress");
  const stepLabelEl = document.getElementById("survey-step-label");
  const questionContainer = document.getElementById("survey-question-container");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const divisionLabel = document.getElementById("survey-division-label");

  let structure = []; // categories with nested questions (each category = one step)
  let divisions = [];
  let selectedDivision = null;
  let currentStep = 0;
  const answers = {}; // questionId -> value

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function showLoginError(message) {
    loginErrorEl.textContent = message;
    loginErrorEl.hidden = false;
  }

  function renderProgress() {
    progressEl.innerHTML = "";
    for (let i = 0; i <= structure.length; i += 1) {
      const step = document.createElement("div");
      step.className =
        "survey-progress__step " +
        (i < currentStep ? "done" : i === currentStep ? "current" : "");
      progressEl.appendChild(step);
    }
    stepLabelEl.textContent = currentStep === structure.length
      ? "Review your answers"
      : `Section ${currentStep + 1} of ${structure.length} - ${structure[currentStep].name}`;
  }

  function renderReviewStep() {
    questionContainer.replaceChildren();

    const heading = document.createElement("h2");
    heading.className = "survey-review-title";
    heading.textContent = "Review your answers";
    const intro = document.createElement("p");
    intro.className = "survey-review-intro";
    intro.textContent = "Check your responses before submitting.";
    questionContainer.append(heading, intro);

    structure.forEach((category, index) => {
      const section = document.createElement("section");
      section.className = "survey-review-section";

      const sectionHeader = document.createElement("div");
      sectionHeader.className = "survey-review-section__header";
      const sectionTitle = document.createElement("h3");
      sectionTitle.textContent = category.name;
      const editButton = document.createElement("button");
      editButton.className = "btn btn-secondary survey-review-edit";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.setAttribute("aria-label", `Edit ${category.name} answers`);
      editButton.addEventListener("click", () => {
        currentStep = index;
        renderStep();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      sectionHeader.append(sectionTitle, editButton);
      section.appendChild(sectionHeader);

      category.questions.forEach((question) => {
        const row = document.createElement("div");
        row.className = "survey-review-answer";
        const questionText = document.createElement("span");
        questionText.textContent = question.text;
        const answerText = document.createElement("strong");
        const answer = answers[question.id];
        answerText.textContent = answer === "na"
          ? "Not applicable"
          : question.type === "rating"
            ? `${answer} / 5`
            : String(answer || "No comment provided");
        row.append(questionText, answerText);
        section.appendChild(row);
      });

      questionContainer.appendChild(section);
    });

    btnBack.hidden = false;
    btnBack.textContent = "Back to survey";
    btnNext.textContent = "Submit response";
    renderProgress();
  }

  function renderStep() {
    if (currentStep === structure.length) {
      renderReviewStep();
      return;
    }

    const category = structure[currentStep];
    questionContainer.innerHTML = "";
    divisionLabel.textContent = `Survey for ${selectedDivision.name}`;
    divisionLabel.hidden = false;

    const heading = document.createElement("h3");
    heading.textContent = category.name;
    heading.style.marginBottom = "0.25rem";
    questionContainer.appendChild(heading);

    if (category.description) {
      const desc = document.createElement("p");
      desc.style.color = "var(--text-muted)";
      desc.style.fontSize = "0.9rem";
      desc.style.marginBottom = "1.25rem";
      desc.textContent = category.description;
      questionContainer.appendChild(desc);
    }

    category.questions.forEach((q) => {
      const wrap = document.createElement("div");
      wrap.className = "survey-question";

      const label = document.createElement("h3");
      label.textContent = q.text;
      wrap.appendChild(label);

      if (q.type === "rating") {
        wrap.appendChild(buildRatingInput(q));
      } else {
        wrap.appendChild(buildTextInput(q));
      }

      questionContainer.appendChild(wrap);
    });

    btnBack.hidden = false;
    btnBack.textContent = currentStep === 0 ? "Change division" : "\u2190 Back";
    btnNext.textContent = currentStep === structure.length - 1 ? "Review answers" : "Next \u2192";
    renderProgress();
  }

  function buildRatingInput(question) {
    const scale = document.createElement("div");
    scale.className = "rating-scale";
    const labels = ["1", "2", "3", "4", "5", "N/A"];

    labels.forEach((val) => {
      const option = document.createElement("div");
      option.className = "rating-scale__option";
      option.style.position = "relative";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q_${question.id}`;
      input.id = `q_${question.id}_${val}`;
      const value = val === "N/A" ? "na" : Number(val);
      input.value = value;
      input.setAttribute("aria-label", val === "N/A" ? "Not applicable" : `${val} out of 5`);
      input.required = true;
      if (answers[question.id] === value) input.checked = true;
      input.addEventListener("change", () => {
        answers[question.id] = value;
      });

      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = val;

      option.appendChild(input);
      option.appendChild(label);
      scale.appendChild(option);
    });

    const key = document.createElement("div");
    key.className = "survey-rating-key";
    const low = document.createElement("span");
    low.textContent = "1 - Needs improvement";
    const high = document.createElement("span");
    high.textContent = "5 - Excellent";
    key.append(low, high);

    const group = document.createElement("div");
    group.className = "survey-rating-group";
    group.append(scale, key);
    return group;
  }

  function buildTextInput(question) {
    const field = document.createElement("div");
    field.className = "field";
    const textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.placeholder = "Type your answer (optional)...";
    textarea.value = answers[question.id] || "";
    textarea.addEventListener("input", () => {
      answers[question.id] = textarea.value;
    });
    field.appendChild(textarea);
    return field;
  }

  function currentStepIsComplete() {
    if (currentStep === structure.length) return true;
    const category = structure[currentStep];
    return category.questions.every((q) => {
      if (q.type !== "rating") return true; // text answers are optional
      return typeof answers[q.id] === "number" || answers[q.id] === "na";
    });
  }

  async function handleSubmitStep(e) {
    e.preventDefault();
    errorEl.hidden = true;

    if (!currentStepIsComplete()) {
      showError("Please answer all rating questions before continuing.");
      return;
    }

    if (currentStep < structure.length) {
      currentStep += 1;
      renderStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Final step — submit to the backend
    btnNext.disabled = true;
    btnNext.textContent = "Submitting...";

    try {
      const payload = Object.entries(answers).map(([questionId, value]) => ({
        questionId: Number(questionId),
        value,
      }));
      await ResponseService.submit(payload, selectedDivision.id);
      sessionStorage.setItem("ntc_survey_submitted_division", selectedDivision.name);
      SurveyAuthService.logout();
      window.location.href = "thank-you.html";
    } catch (err) {
      showError(err.message || "Something went wrong submitting your response.");
      btnNext.disabled = false;
      btnNext.textContent = "Submit";
    }
  }

  function handleBack() {
    if (currentStep === 0) {
      formEl.hidden = true;
      progressEl.hidden = true;
      stepLabelEl.hidden = true;
      loadDivisionStep();
      return;
    }
    currentStep -= 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateDivisionDescription() {
    const division = divisions.find((entry) => entry.id === Number(divisionSelect.value));
    divisionDescription.textContent = division ? division.description : "";
  }

  async function loadDivisionStep() {
    loginEl.hidden = true;
    divisionStepEl.hidden = true;
    progressEl.hidden = true;
    stepLabelEl.hidden = true;
    formEl.hidden = true;
    errorEl.hidden = true;
    loadingEl.hidden = false;
    divisionErrorEl.hidden = true;

    try {
      divisions = await DivisionService.list();
      if (divisions.length === 0) {
        loadingEl.hidden = true;
        showError("No NTC Region 2 divisions are available. Please contact the office.");
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select a division";
      divisionSelect.replaceChildren(placeholder);
      divisions.forEach((division) => {
        const option = document.createElement("option");
        option.value = division.id;
        option.textContent = division.name;
        divisionSelect.appendChild(option);
      });

      if (selectedDivision) divisionSelect.value = String(selectedDivision.id);
      updateDivisionDescription();
      loadingEl.hidden = true;
      divisionStepEl.hidden = false;
    } catch (err) {
      loadingEl.hidden = true;
      if (!SurveyAuthService.isLoggedIn()) {
        loginEl.hidden = false;
        showLoginError(err.message || "Your sign-in expired. Scan a new QR code and sign in again.");
      } else {
        showError(err.message || "Could not load the Region 2 divisions.");
      }
    }
  }

  async function loadSurvey() {
    if (!selectedDivision) {
      await loadDivisionStep();
      return;
    }
    loginEl.hidden = true;
    divisionStepEl.hidden = true;
    loadingEl.hidden = false;
    errorEl.hidden = true;

    try {
      structure = await QuestionService.getSurveyStructure({
        surveyAuth: true,
        divisionId: selectedDivision.id,
      });
      if (structure.length === 0) {
        loadingEl.textContent = "The survey is not available right now. Please check back later.";
        return;
      }
      loadingEl.hidden = true;
      progressEl.hidden = false;
      stepLabelEl.hidden = false;
      formEl.hidden = false;
      renderStep();
    } catch (err) {
      loadingEl.hidden = true;
      if (!SurveyAuthService.isLoggedIn()) {
        loginEl.hidden = false;
        showLoginError(err.message || "Your sign-in expired. Scan a new QR code and sign in again.");
      } else {
        showError(err.message || "Could not load the survey. Please refresh and try again.");
      }
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    loginErrorEl.hidden = true;
    loginButton.disabled = true;
    loginButton.textContent = "Verifying...";

    const values = new FormData(loginForm);
    try {
      await SurveyAuthService.login(
        values.get("username"),
        values.get("password"),
        values.get("code")
      );
      await loadDivisionStep();
    } catch (err) {
      showLoginError(err.message || "Could not sign in. Check your credentials and QR code.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Verify and continue";
    }
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      loginCodeInput.value = code;
      loginCodeInput.required = false;
      loginCodeField.hidden = true;
      loginCodeStatus.textContent = "One-time QR code recognized. Enter your survey account credentials to continue.";
      loginCodeStatus.hidden = false;
      document.getElementById("survey-login-username").focus();
      window.history.replaceState({}, "", window.location.pathname);
    }

    loginForm.addEventListener("submit", handleLogin);
    divisionSelect.addEventListener("change", updateDivisionDescription);
    divisionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      divisionErrorEl.hidden = true;
      selectedDivision = divisions.find((entry) => entry.id === Number(divisionSelect.value)) || null;
      if (!selectedDivision) {
        divisionErrorEl.textContent = "Select the division that handled your service.";
        divisionErrorEl.hidden = false;
        return;
      }
      divisionButton.disabled = true;
      loadSurvey().finally(() => {
        divisionButton.disabled = false;
      });
    });
    if (SurveyAuthService.isLoggedIn()) {
      loadDivisionStep();
    } else {
      loadingEl.hidden = true;
      loginEl.hidden = false;
    }
  }

  btnBack.addEventListener("click", handleBack);
  formEl.addEventListener("submit", handleSubmitStep);

  init();
})();
