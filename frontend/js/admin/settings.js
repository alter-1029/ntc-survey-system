(function () {
  const user = AuthService.currentUser();
  if (!user) return;

  document.getElementById("settings-name").textContent = user.name || "\u2014";
  document.getElementById("settings-username").textContent = user.username || "\u2014";
  document.getElementById("settings-role").textContent = user.role || "\u2014";

  const passwordForm = document.getElementById("change-password-form");
  const message = document.getElementById("password-change-message");
  const submitButton = document.getElementById("change-password-button");

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    const formData = new FormData(passwordForm);
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));
    if (newPassword !== confirmPassword) {
      message.textContent = "The new passwords do not match.";
      message.dataset.state = "error";
      message.hidden = false;
      return;
    }

    submitButton.disabled = true;
    try {
      await NtcApi.apiRequest("/api/auth/change-password", {
        method: "POST",
        auth: true,
        body: {
          currentPassword: formData.get("currentPassword"),
          newPassword,
        },
      });
      NtcApi.clearSession();
      window.location.replace("login.html?passwordChanged=1");
    } catch (error) {
      message.textContent = error.message || "Could not update the password.";
      message.dataset.state = "error";
      message.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });
})();
