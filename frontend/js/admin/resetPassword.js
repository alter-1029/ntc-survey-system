(function () {
  const form = document.getElementById("reset-password-form");
  const message = document.getElementById("reset-password-message");
  const submitButton = document.getElementById("reset-submit");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token) window.history.replaceState({}, "", window.location.pathname);
  if (!token) {
    message.textContent = "This reset link is missing its token. Request a new link.";
    message.dataset.state = "error";
    message.hidden = false;
    submitButton.disabled = true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    const values = new FormData(form);
    const newPassword = String(values.get("newPassword"));
    if (newPassword !== String(values.get("confirmPassword"))) {
      message.textContent = "The new passwords do not match.";
      message.dataset.state = "error";
      message.hidden = false;
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Updating...";
    try {
      const result = await NtcApi.apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
      });
      NtcApi.clearSession();
      message.replaceChildren();
      message.dataset.state = "success";
      message.hidden = false;
      const copy = document.createElement("p");
      copy.textContent = result.message || "Password reset complete.";
      const login = document.createElement("a");
      login.className = "recovery-preview-link";
      login.href = "login.html?passwordReset=1";
      login.textContent = "Continue to sign in";
      message.append(copy, login);
      form.hidden = true;
    } catch (error) {
      message.textContent = error.message || "Could not reset the password.";
      message.dataset.state = "error";
      message.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Update password";
    }
  });
})();
