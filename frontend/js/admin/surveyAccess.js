(function () {
  const form = document.getElementById("survey-user-form");
  const errorEl = document.getElementById("survey-user-error");
  const statusEl = document.getElementById("survey-user-status");
  const listEl = document.getElementById("survey-users-list");
  const qrResult = document.getElementById("survey-qr-result");
  const selectAll = document.getElementById("select-all-survey-users");
  const deleteSelectedButton = document.getElementById("delete-selected-qrs");
  const deleteSelectedAccountsButton = document.getElementById("delete-selected-accounts");
  const selectionSummary = document.getElementById("survey-selection-summary");
  const selectedUserIds = new Set();

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function showStatus(message, state = "success") {
    statusEl.textContent = message;
    statusEl.dataset.state = state;
    statusEl.hidden = false;
  }

  function updateSelectionControls() {
    const checkboxes = [...listEl.querySelectorAll(".survey-user-select")];
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    const qrSelected = checkboxes.filter((checkbox) => checkbox.checked && checkbox.dataset.hasQrRecords === "true").length;
    selectAll.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    selectionSummary.textContent = `${selectedCount} selected`;
    deleteSelectedButton.disabled = qrSelected === 0;
    deleteSelectedButton.textContent = qrSelected
      ? `Delete ${qrSelected} selected QR record${qrSelected === 1 ? "" : "s"}`
      : "Delete selected QR codes";
    deleteSelectedAccountsButton.disabled = selectedCount === 0;
    deleteSelectedAccountsButton.textContent = selectedCount
      ? `Delete ${selectedCount} selected account${selectedCount === 1 ? "" : "s"}`
      : "Delete selected accounts";
  }

  function showQrResult(result) {
    qrResult.replaceChildren();
    qrResult.hidden = false;
    qrResult.dataset.userId = result.user.id;

    const heading = document.createElement("h4");
    heading.textContent = `One-time QR code for ${result.user.name}`;

    const image = document.createElement("img");
    image.src = result.qrCodeDataUrl;
    image.alt = `One-time sign-in QR code for ${result.user.username}`;
    image.width = 200;
    image.height = 200;

    const codeLabel = document.createElement("p");
    codeLabel.className = "survey-qr-code-label";
    codeLabel.textContent = "One-time sign-in code";

    const codeRow = document.createElement("div");
    codeRow.className = "survey-qr-code-row";
    const codeValue = document.createElement("code");
    codeValue.className = "survey-qr-code";
    codeValue.textContent = result.code || "Code unavailable";

    const copyCode = document.createElement("button");
    copyCode.className = "btn btn-secondary survey-qr-copy";
    copyCode.type = "button";
    copyCode.textContent = "Copy code";
    copyCode.disabled = !result.code;
    copyCode.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(result.code);
        copyCode.textContent = "Copied";
      } catch {
        copyCode.textContent = "Select code to copy";
      }
    });
    codeRow.append(codeValue, copyCode);

    const expires = document.createElement("p");
    expires.textContent = `Expires ${new Date(result.expiresAt).toLocaleString()}. This code can only be used once.`;

    const actions = document.createElement("div");
    actions.className = "survey-qr-actions";

    const download = document.createElement("a");
    download.className = "btn btn-secondary";
    download.href = result.qrCodeDataUrl;
    download.download = `${result.user.username}-survey-sign-in.png`;
    download.textContent = "Download QR";

    const open = document.createElement("a");
    open.className = "btn btn-primary";
    open.href = result.signInUrl;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open sign-in page";

    actions.append(download, open);
    qrResult.append(heading, image, codeLabel, codeRow, expires, actions);
  }

  async function loadSurveyUsers() {
    listEl.textContent = "Loading accounts...";
    try {
      const users = await NtcApi.apiRequest("/api/auth/survey-users", { auth: true });
      listEl.replaceChildren();
      const activeQrCount = users.filter((user) => user.hasActiveQr).length;
      document.getElementById("survey-account-total").textContent = users.length.toLocaleString();
      document.getElementById("survey-active-qr-total").textContent = activeQrCount.toLocaleString();
      document.getElementById("survey-qr-attention").textContent = (users.length - activeQrCount).toLocaleString();
      const userIds = new Set(users.map((user) => user.id));
      selectedUserIds.forEach((id) => {
        if (!userIds.has(id)) selectedUserIds.delete(id);
      });
      if (users.length === 0) {
        listEl.textContent = "No survey accounts yet.";
        updateSelectionControls();
        return;
      }

      users.forEach((surveyUser) => {
        const row = document.createElement("div");
        row.className = "survey-user-row";
        row.dataset.userId = surveyUser.id;

        const checkbox = document.createElement("input");
        checkbox.className = "survey-user-select";
        checkbox.type = "checkbox";
        checkbox.value = surveyUser.id;
        checkbox.checked = selectedUserIds.has(surveyUser.id);
        checkbox.dataset.hasQrRecords = String(surveyUser.hasQrCodeRecords);
        checkbox.setAttribute("aria-label", `Select ${surveyUser.name}`);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selectedUserIds.add(surveyUser.id);
          else selectedUserIds.delete(surveyUser.id);
          updateSelectionControls();
        });

        const identity = document.createElement("div");
        identity.className = "survey-user-identity";
        const name = document.createElement("strong");
        name.textContent = surveyUser.name;
        const username = document.createElement("span");
        username.textContent = surveyUser.username;
        const accountStatus = document.createElement("span");
        accountStatus.className = surveyUser.active ? "survey-qr-state is-active" : "survey-qr-state is-inactive";
        accountStatus.textContent = surveyUser.active
          ? "Account active"
          : `Deactivated${surveyUser.deactivatedAt ? ` ${new Date(surveyUser.deactivatedAt).toLocaleDateString()}` : ""}`;
        const qrStatus = document.createElement("span");
        qrStatus.className = surveyUser.hasActiveQr ? "survey-qr-state is-active" : "survey-qr-state";
        qrStatus.textContent = surveyUser.hasActiveQr
          ? `Active QR expires ${new Date(surveyUser.qrExpiresAt).toLocaleString()}`
          : surveyUser.hasQrCodeRecords ? "QR code expired or already used" : "No QR code on record";
        identity.append(name, username, accountStatus, qrStatus);

        if (surveyUser.qrHistory.length > 0) {
          const history = document.createElement("details");
          history.className = "survey-qr-history";
          const summary = document.createElement("summary");
          summary.textContent = `QR history (${surveyUser.qrHistory.length})`;
          const historyList = document.createElement("ul");
          surveyUser.qrHistory.forEach((grant) => {
            const item = document.createElement("li");
            const used = grant.usedAt ? ` · used ${new Date(grant.usedAt).toLocaleString()}` : "";
            item.textContent = `${grant.status} · issued ${new Date(grant.createdAt).toLocaleString()} · expires ${new Date(grant.expiresAt).toLocaleString()}${used}`;
            historyList.appendChild(item);
          });
          history.append(summary, historyList);
          identity.appendChild(history);
        }

        const actions = document.createElement("div");
        actions.className = "survey-user-actions";

        const issueButton = document.createElement("button");
        issueButton.className = "btn btn-secondary";
        issueButton.type = "button";
        issueButton.textContent = "New QR";
        issueButton.disabled = !surveyUser.active;
        issueButton.addEventListener("click", async () => {
          errorEl.hidden = true;
          issueButton.disabled = true;
          try {
            const result = await NtcApi.apiRequest(
              `/api/auth/survey-users/${surveyUser.id}/access-code`,
              { method: "POST", auth: true }
            );
            showQrResult(result);
            await loadSurveyUsers();
          } catch (error) {
            showError(error.message || "Could not create a sign-in code.");
          } finally {
            issueButton.disabled = false;
          }
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn btn-danger";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete QR";
        deleteButton.disabled = !surveyUser.hasQrCodeRecords;
        deleteButton.setAttribute("aria-label", `Delete QR code for ${surveyUser.name}`);
        deleteButton.addEventListener("click", () => revokeQrCodes([surveyUser.id], [surveyUser.name]));

        const deleteAccountButton = document.createElement("button");
        deleteAccountButton.className = "btn btn-danger";
        deleteAccountButton.type = "button";
        deleteAccountButton.textContent = "Delete account";
        deleteAccountButton.setAttribute("aria-label", `Delete survey account ${surveyUser.name}`);
        deleteAccountButton.addEventListener("click", async () => {
          const warning = `Delete the survey account for ${surveyUser.name} (${surveyUser.username})? This revokes its QR codes and prevents future sign-in. Submitted responses will be kept.`;
          if (!window.confirm(warning)) return;

          errorEl.hidden = true;
          deleteAccountButton.disabled = true;
          try {
            const result = await NtcApi.apiRequest(`/api/auth/survey-users/${surveyUser.id}`, {
              method: "DELETE",
              auth: true,
            });
            selectedUserIds.delete(surveyUser.id);
            if (qrResult.dataset.userId === String(surveyUser.id)) qrResult.hidden = true;
            showStatus(result.message);
            await loadSurveyUsers();
          } catch (error) {
            showError(error.message || "Could not delete the survey account.");
          } finally {
            deleteAccountButton.disabled = false;
          }
        });

        const statusButton = document.createElement("button");
        statusButton.className = "btn btn-secondary";
        statusButton.type = "button";
        statusButton.textContent = surveyUser.active ? "Deactivate" : "Reactivate";
        statusButton.addEventListener("click", async () => {
          const nextActive = !surveyUser.active;
          const message = nextActive
            ? `Reactivate ${surveyUser.name}'s survey account? A new QR code will need to be issued for QR sign-in.`
            : `Deactivate ${surveyUser.name}'s survey account? Their current session and QR codes will stop working, but account history and submitted responses will be kept.`;
          if (!window.confirm(message)) return;

          statusButton.disabled = true;
          errorEl.hidden = true;
          try {
            const result = await NtcApi.apiRequest(`/api/auth/survey-users/${surveyUser.id}/status`, {
              method: "PATCH",
              auth: true,
              body: { active: nextActive },
            });
            showStatus(result.message);
            await loadSurveyUsers();
          } catch (error) {
            showError(error.message || "Could not update the survey account status.");
          } finally {
            statusButton.disabled = false;
          }
        });

        actions.append(issueButton, statusButton, deleteButton, deleteAccountButton);
        row.append(checkbox, identity, actions);
        listEl.appendChild(row);
      });
      updateSelectionControls();
    } catch (error) {
      listEl.textContent = error.message || "Could not load survey accounts.";
    }
  }

  async function revokeQrCodes(userIds, names, { bulk = false } = {}) {
    if (userIds.length === 0) return;
    const accountNames = names.join(", ");
    const warning = bulk
      ? `Delete QR code records for ${userIds.length} selected account${userIds.length === 1 ? "" : "s"} (${accountNames})? Any remaining QR links will become unusable. The accounts and their responses will not be deleted.`
      : `Delete the QR code record for ${accountNames}? Any remaining QR link will become unusable. The survey account and its responses will not be deleted.`;
    if (!window.confirm(warning)) return;

    errorEl.hidden = true;
    statusEl.hidden = true;
    deleteSelectedButton.disabled = true;
    try {
      const result = await NtcApi.apiRequest("/api/auth/survey-access-codes", {
        method: "DELETE",
        auth: true,
        body: { userIds },
      });
      if (bulk) selectedUserIds.clear();
      else userIds.forEach((id) => selectedUserIds.delete(id));
      qrResult.hidden = true;
      showStatus(result.message);
      await loadSurveyUsers();
    } catch (error) {
      showError(error.message || "Could not delete the selected QR codes.");
      updateSelectionControls();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const values = new FormData(form);
      const result = await NtcApi.apiRequest("/api/auth/survey-users", {
        method: "POST",
        auth: true,
        body: {
          name: values.get("name"),
          username: values.get("username"),
          password: values.get("password"),
        },
      });
      form.reset();
      showQrResult(result);
      await loadSurveyUsers();
    } catch (error) {
      showError(error.message || "Could not create the survey account.");
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("refresh-survey-users").addEventListener("click", loadSurveyUsers);

  selectAll.addEventListener("change", () => {
    const checkboxes = listEl.querySelectorAll(".survey-user-select");
    selectedUserIds.clear();
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
      if (checkbox.checked) selectedUserIds.add(Number(checkbox.value));
    });
    updateSelectionControls();
  });

  deleteSelectedButton.addEventListener("click", () => {
    const qrCheckboxes = [...listEl.querySelectorAll('.survey-user-select:checked')]
      .filter((checkbox) => checkbox.dataset.hasQrRecords === "true");
    const userIds = qrCheckboxes.map((checkbox) => Number(checkbox.value));
    const names = qrCheckboxes.map((checkbox) =>
      checkbox.closest(".survey-user-row").querySelector(".survey-user-identity strong").textContent
    );
    revokeQrCodes(userIds, names, { bulk: true });
  });

  deleteSelectedAccountsButton.addEventListener("click", async () => {
    const selectedCheckboxes = [...listEl.querySelectorAll(".survey-user-select:checked")];
    const userIds = selectedCheckboxes.map((checkbox) => Number(checkbox.value));
    if (userIds.length === 0) return;

    const names = selectedCheckboxes.map((checkbox) =>
      checkbox.closest(".survey-user-row").querySelector(".survey-user-identity strong").textContent
    );
    const warning = `Permanently delete ${userIds.length} survey account${userIds.length === 1 ? "" : "s"} (${names.join(", ")})? Their QR codes will be revoked and they will no longer be able to sign in. Submitted responses will be kept. This cannot be undone.`;
    if (!window.confirm(warning)) return;

    errorEl.hidden = true;
    statusEl.hidden = true;
    deleteSelectedAccountsButton.disabled = true;
    try {
      const result = await NtcApi.apiRequest("/api/auth/survey-users", {
        method: "DELETE",
        auth: true,
        body: { userIds },
      });
      selectedUserIds.clear();
      if (userIds.includes(Number(qrResult.dataset.userId))) qrResult.hidden = true;
      showStatus(result.message);
      await loadSurveyUsers();
    } catch (error) {
      showError(error.message || "Could not delete the selected survey accounts.");
    } finally {
      updateSelectionControls();
    }
  });

  loadSurveyUsers();
})();
