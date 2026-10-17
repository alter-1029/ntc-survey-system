(function () {
  const loadingEl = document.getElementById("dashboard-loading");
  const errorEl = document.getElementById("dashboard-error");
  const contentEl = document.getElementById("dashboard-content");
  const trendPeriod = document.getElementById("trend-period");
  const satisfactionPeriod = document.getElementById("satisfaction-period");
  const divisionSelect = document.getElementById("dashboard-division");

  const DONUT_COLORS = {
    satisfied: "#4d8fd6",
    neutral: "#d9a441",
    unsatisfied: "#ccd4e0",
  };

  function setDelta(element, text, change) {
    element.textContent = text;
    element.classList.toggle("is-positive", change > 0);
    element.classList.toggle("is-negative", change < 0);
    element.classList.toggle("neutral", change === 0);
  }

  function countComparison(current, previous, previousMonthLabel) {
    if (current === 0 && previous === 0) return `No responses in ${previousMonthLabel} or this month`;
    if (previous === 0) return "First responses this month";
    const difference = current - previous;
    if (difference === 0) return `Even with ${previousMonthLabel}`;
    return `${Math.abs(difference)} ${difference > 0 ? "more" : "fewer"} vs ${previousMonthLabel}`;
  }

  function renderStats(summary) {
    document.getElementById("stat-total").textContent = summary.totalResponses.toLocaleString();
    document.getElementById("stat-avg").textContent = `${summary.averageRating.toFixed(2)} / 5`;
    document.getElementById("stat-satisfied").textContent = `${summary.satisfiedPct}%`;
    document.getElementById("stat-month").textContent = summary.thisMonthCount.toLocaleString();

    const totalDelta = document.getElementById("stat-total-delta");
    const avgDelta = document.getElementById("stat-avg-delta");
    const satisfiedDelta = document.getElementById("stat-satisfied-delta");
    const monthDelta = document.getElementById("stat-month-delta");
    const responseChange = summary.thisMonthCount - summary.previousMonthCount;
    const ratingChange = summary.thisMonthAverageRating - summary.previousMonthAverageRating;
    const satisfactionChange = summary.thisMonthSatisfiedPct - summary.previousMonthSatisfiedPct;

    setDelta(
      totalDelta,
      `${summary.thisMonthCount} this month · ${countComparison(summary.thisMonthCount, summary.previousMonthCount, summary.previousMonthLabel)}`,
      responseChange
    );
    setDelta(
      avgDelta,
      summary.thisMonthAverageRating
        ? `This month ${summary.thisMonthAverageRating.toFixed(2)} · ${summary.previousMonthAverageRating ? `${ratingChange > 0 ? "+" : ""}${ratingChange.toFixed(2)} vs ${summary.previousMonthLabel}` : "No rated responses last month"}`
        : "No rated responses this month",
      ratingChange
    );
    setDelta(
      satisfiedDelta,
      summary.thisMonthAverageRating
        ? `${summary.thisMonthSatisfiedPct}% this month · ${summary.previousMonthAverageRating ? `${satisfactionChange > 0 ? "+" : ""}${satisfactionChange} points vs ${summary.previousMonthLabel}` : "No rated responses last month"}`
        : "No rated responses this month",
      satisfactionChange
    );
    setDelta(
      monthDelta,
      countComparison(summary.thisMonthCount, summary.previousMonthCount, summary.previousMonthLabel),
      responseChange
    );
  }

  function renderBarChart(trend) {
    const container = document.getElementById("bar-chart");
    container.innerHTML = "";
    const max = Math.max(...trend.map((t) => t.count), 1);

    trend.forEach((point) => {
      const col = document.createElement("div");
      col.className = "bar-chart__col";

      const bar = document.createElement("div");
      bar.className = "bar-chart__bar";
      const heightPct = Math.max((point.count / max) * 70, 4);
      bar.style.height = `${heightPct}%`;
      bar.title = `${point.month}: ${point.count} responses`;

      const value = document.createElement("span");
      value.className = "bar-chart__value";
      value.textContent = point.count.toLocaleString();

      const label = document.createElement("div");
      label.className = "bar-chart__label";
      label.textContent = point.month;

      col.append(value, bar);
      col.appendChild(label);
      container.appendChild(col);
    });
  }

  function renderDonut(overall, counts) {
    const svg = document.getElementById("donut-chart");
    const legendEl = document.getElementById("donut-legend");
    svg.innerHTML = "";
    legendEl.innerHTML = "";

    const segments = [
      { key: "satisfied", label: "Satisfied", value: overall.satisfied, count: counts.satisfied },
      { key: "neutral", label: "Neutral", value: overall.neutral, count: counts.neutral },
      { key: "unsatisfied", label: "Unsatisfied", value: overall.unsatisfied, count: counts.unsatisfied },
    ];

    const radius = 15.9155; // makes circumference ~100 for easy percentage math
    let cumulative = 0;

    segments.forEach((seg) => {
      if (seg.value <= 0) return;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "21");
      circle.setAttribute("cy", "21");
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", "transparent");
      circle.setAttribute("stroke", DONUT_COLORS[seg.key]);
      circle.setAttribute("stroke-width", "6");
      circle.setAttribute("stroke-dasharray", `${seg.value} ${100 - seg.value}`);
      circle.setAttribute("stroke-dashoffset", `${25 - cumulative}`);
      circle.setAttribute("transform", "rotate(-90 21 21)");
      svg.appendChild(circle);
      cumulative += seg.value;

      const row = document.createElement("div");
      row.className = "donut-legend__row";
      row.innerHTML = `
        <span class="donut-legend__label">
          <span class="donut-legend__dot" style="background:${DONUT_COLORS[seg.key]}"></span>
          ${seg.label}
        </span>
        <span>${seg.value}% · ${seg.count.toLocaleString()}</span>
      `;
      legendEl.appendChild(row);
    });
  }

  async function updateChart(periodSelect, render) {
    periodSelect.disabled = true;
    errorEl.hidden = true;
    try {
      const summary = await AnalyticsService.getSummary(periodSelect.value, {
        divisionId: divisionSelect.value || undefined,
      });
      render(summary);
      NtcLiveRefresh.markUpdated();
    } catch (err) {
      errorEl.textContent = err.message || "Could not update the chart.";
      errorEl.hidden = false;
    } finally {
      periodSelect.disabled = false;
    }
  }

  async function refreshDashboard() {
    const trendValue = trendPeriod.value;
    const satisfactionValue = satisfactionPeriod.value;
    const divisionId = divisionSelect.value || undefined;
    const periods = [...new Set(["all", trendValue, satisfactionValue])];
    const summaries = Object.fromEntries(await Promise.all(
      periods.map(async (period) => [period, await AnalyticsService.getSummary(period, { divisionId })])
    ));

    renderStats(summaries.all);
    if (!trendPeriod.disabled && trendPeriod.value === trendValue) {
      renderBarChart(summaries[trendValue].trend);
    }
    if (!satisfactionPeriod.disabled && satisfactionPeriod.value === satisfactionValue) {
      const summary = summaries[satisfactionValue];
      renderDonut(summary.overallSatisfaction, summary.satisfactionCounts);
    }
  }

  async function loadDivisions() {
    const divisions = await DivisionService.list({ auth: true });
    divisions.forEach((division) => {
      const option = document.createElement("option");
      option.value = division.id;
      option.textContent = division.name;
      divisionSelect.appendChild(option);
    });
  }

  async function init() {
    try {
      await loadDivisions();
      await refreshDashboard();

      loadingEl.hidden = true;
      contentEl.hidden = false;
      NtcLiveRefresh.markUpdated();
      NtcLiveRefresh.start(refreshDashboard, (err) => {
        errorEl.textContent = err.message || "Live dashboard updates are temporarily unavailable.";
        errorEl.hidden = false;
      });
    } catch (err) {
      loadingEl.hidden = true;
      errorEl.textContent = err.message || "Could not load dashboard data.";
      errorEl.hidden = false;
    }
  }

  trendPeriod.addEventListener("change", () => {
    updateChart(trendPeriod, (summary) => renderBarChart(summary.trend));
  });
  satisfactionPeriod.addEventListener("change", () => {
    updateChart(satisfactionPeriod, (summary) => renderDonut(summary.overallSatisfaction, summary.satisfactionCounts));
  });
  divisionSelect.addEventListener("change", refreshDashboard);

  init();
})();
