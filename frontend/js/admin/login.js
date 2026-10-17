(function () {
  // Already logged in? Skip straight to the dashboard.
  if (AuthService.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const noticeEl = document.getElementById("login-notice");
  const btn = document.getElementById("btn-login");

  const params = new URLSearchParams(window.location.search);
  if (params.has("passwordChanged")) {
    noticeEl.textContent = "Password updated. Sign in with your new password.";
    noticeEl.dataset.state = "success";
    noticeEl.hidden = false;
  } else if (params.has("passwordReset")) {
    noticeEl.textContent = "Password reset complete. Sign in with your new password.";
    noticeEl.dataset.state = "success";
    noticeEl.hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in...";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      await AuthService.login(username, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message || "Login failed.";
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
})();
