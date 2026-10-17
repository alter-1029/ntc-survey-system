(function () {
  const form = document.getElementById("forgot-password-form");
  const message = document.getElementById("forgot-password-message");
  const submitButton = document.getElementById("recovery-submit");

  function showMessage(text, state) {
    message.replaceChildren();
    message.dataset.state = state;
    message.hidden = false;

    const copy = document.createElement("p");
    copy.textContent = text;
    message.appendChild(copy);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
      const result = await NtcApi.apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: new FormData(form).get("email") },
      });
      showMessage(result.message || "Check your email for recovery instructions.", "success");

      if (result.previewUrl) {
        const link = document.createElement("a");
        link.href = result.previewUrl;
        link.textContent = "Open development reset link";
        link.className = "recovery-preview-link";
        message.appendChild(link);
      }
    } catch (error) {
      showMessage(error.message || "Could not request a reset link.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send reset link";
    }
  });
})();
