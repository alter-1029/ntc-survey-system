const NtcLiveRefresh = {
  intervalMs: 10000,

  markUpdated() {
    const status = document.getElementById("live-update-status");
    if (!status) return;
    status.dataset.state = "live";
    status.lastElementChild.textContent = `Updated ${new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  },

  markDelayed() {
    const status = document.getElementById("live-update-status");
    if (!status) return;
    status.dataset.state = "delayed";
    status.lastElementChild.textContent = "Update delayed";
  },

  start(refresh, onError = () => {}) {
    let refreshing = false;
    let stopped = false;

    async function run() {
      if (stopped || document.hidden || refreshing) return;
      refreshing = true;
      try {
        await refresh();
        NtcLiveRefresh.markUpdated();
      } catch (error) {
        onError(error);
        NtcLiveRefresh.markDelayed();
      } finally {
        refreshing = false;
      }
    }

    const interval = window.setInterval(run, NtcLiveRefresh.intervalMs);
    const handleVisibility = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  },
};

window.NtcLiveRefresh = NtcLiveRefresh;
