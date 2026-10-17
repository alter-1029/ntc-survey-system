(function () {
  const loadingEl = document.getElementById("analytics-loading");
  const errorEl = document.getElementById("analytics-error");
  const contentEl = document.getElementById("analytics-content");
  const filterForm = document.getElementById("analytics-filter-form");
  const periodSelect = document.getElementById("analytics-period");
  const customRange = document.getElementById("analytics-custom-range");
  const fromInput = document.getElementById("analytics-from");
  const toInput = document.getElementById("analytics-to");
  const rangeLabel = document.getElementById("analytics-range-label");
  const applyButton = filterForm.querySelector('button[type="submit"]');
  let appliedFilter = null;

  function setCustomRangeVisible() {
    const isCustom = periodSelect.value === "custom";
    customRange.hidden = !isCustom;
    fromInput.required = isCustom;
    toInput.required = isCustom;
  }

  function renderChart(containerId, points, denominator, unitLabel) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    const max = Math.max(...points.map((point) => point.count), 1);

    if (points.length === 0 || denominator === 0) {
      const empty = document.createElement("p");
      empty.className = "analytics-chart-empty";
      empty.textContent = "No records match this date range.";
      container.appendChild(empty);
      return;
    }

    points.forEach((point) => {
      const column = document.createElement("div");
      column.className = "precise-bar-col";

      const value = document.createElement("span");
      value.className = "precise-bar-value";
      value.textContent = point.count.toLocaleString();

      const track = document.createElement("div");
      track.className = "precise-bar-track";
      const bar = document.createElement("div");
      bar.className = "precise-bar";
      bar.style.height = `${Math.max((point.count / max) * 100, 2)}%`;
      bar.title = `${point.label}: ${point.count} ${unitLabel}`;
      track.appendChild(bar);

      const label = document.createElement("span");
      label.className = "precise-bar-label";
      label.textContent = point.label;

      column.append(value, track, label);
      container.appendChild(column);
    });
  }

  function renderSummary(summary, period, dateRange) {
    document.getElementById("kv-period-responses").textContent = summary.periodResponseCount.toLocaleString();
    document.getElementById("kv-period-average").textContent = summary.ratedResponseCount
      ? `${summary.periodAverageRating.toFixed(2)} / 5`
      : "No ratings";
    document.getElementById("kv-rated-responses").textContent = summary.ratedResponseCount.toLocaleString();
    document.getElementById("kv-rating-answers").textContent = summary.ratingAnswerCount.toLocaleString();

    const rangeNames = {
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      "12m": "Last 12 months",
      all: "All records",
      custom: `${dateRange.from} through ${dateRange.to}`,
    };
    rangeLabel.textContent = `${rangeNames[period]} · ${summary.periodResponseCount.toLocaleString()} responses`;

    const satisfaction = summary.satisfactionCounts;
    const satisfactionTotal = summary.ratedResponseCount;
    ["satisfied", "neutral", "unsatisfied"].forEach((key) => {
      const count = satisfaction[key];
      const share = satisfactionTotal ? Math.round((count / satisfactionTotal) * 100) : 0;
      document.getElementById(`count-${key}`).textContent = count.toLocaleString();
      document.getElementById(`share-${key}`).textContent = `${share}%`;
    });
    document.getElementById("satisfaction-total").textContent = `${satisfactionTotal.toLocaleString()} rated responses`;

    const divisionBody = document.getElementById("division-breakdown-body");
    divisionBody.replaceChildren();
    if (summary.divisionBreakdown.length === 0) {
      const row = document.createElement("tr");
      const empty = document.createElement("td");
      empty.colSpan = 3;
      empty.textContent = "No responses in this period.";
      row.appendChild(empty);
      divisionBody.appendChild(row);
    } else {
      summary.divisionBreakdown.forEach((division) => {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = division.divisionName;
        const count = document.createElement("td");
        count.textContent = division.responseCount.toLocaleString();
        const average = document.createElement("td");
        average.textContent = division.averageRating === null ? "No ratings" : `${division.averageRating.toFixed(2)} / 5`;
        row.append(name, count, average);
        divisionBody.appendChild(row);
      });
    }

    renderChart(
      "response-chart",
      summary.trend.map((point) => ({ label: point.month, count: point.count })),
      summary.periodResponseCount,
      "responses"
    );
    renderChart(
      "rating-chart",
      [
        ...[1, 2, 3, 4, 5].map((rating) => ({ label: `${rating} star`, count: summary.ratingDistribution[rating] })),
        { label: "N/A", count: summary.ratingDistribution.notApplicable },
      ],
      summary.ratingAnswerCount,
      "ratings"
    );
  }

  async function loadAnalytics({ silent = false, period = periodSelect.value, dateRange = { from: fromInput.value, to: toInput.value } } = {}) {
    if (period === "custom" && (!dateRange.from || !dateRange.to)) {
      errorEl.textContent = "Choose both a start and end date.";
      errorEl.hidden = false;
      return false;
    }

    errorEl.hidden = true;
    if (!silent) {
      applyButton.disabled = true;
      applyButton.textContent = "Updating...";
    }
    try {
      const summary = await AnalyticsService.getSummary(period, dateRange);
      renderSummary(summary, period, dateRange);
      appliedFilter = { period, dateRange: { ...dateRange } };
      loadingEl.hidden = true;
      contentEl.hidden = false;
      NtcLiveRefresh.markUpdated();
      return true;
    } catch (error) {
      errorEl.textContent = error.message || "Could not load analytics.";
      errorEl.hidden = false;
      loadingEl.hidden = true;
      if (silent) throw error;
      return false;
    } finally {
      if (!silent) {
        applyButton.disabled = false;
        applyButton.textContent = "Apply filters";
      }
    }
  }

  periodSelect.addEventListener("change", setCustomRangeVisible);
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadAnalytics();
  });
  document.getElementById("analytics-reset").addEventListener("click", () => {
    periodSelect.value = "12m";
    fromInput.value = "";
    toInput.value = "";
    setCustomRangeVisible();
    loadAnalytics();
  });

  setCustomRangeVisible();
  loadAnalytics().then(() => {
    NtcLiveRefresh.start(
      () => appliedFilter && loadAnalytics({ silent: true, ...appliedFilter }),
      (error) => {
        errorEl.textContent = error.message || "Live analytics updates are temporarily unavailable.";
        errorEl.hidden = false;
      }
    );
  });
})();
