const express = require("express");
const router = express.Router();
const { readAll } = require("../utils/jsonStore");
const requireAuth = require("../middleware/requireAuth");

const SATISFIED_THRESHOLD = 4;
const NEUTRAL_THRESHOLD = 2.5;
const DAY_MS = 86400000;

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short" });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function buildRangeTrend(responses, start, endExclusive) {
  const dayCount = Math.ceil((endExclusive.getTime() - start.getTime()) / DAY_MS);
  const unit = dayCount <= 31 ? "day" : dayCount <= 180 ? "week" : dayCount <= 730 ? "month" : "year";
  const trend = [];

  for (let cursor = new Date(start); cursor < endExclusive;) {
    const next = new Date(cursor);
    if (unit === "day") next.setUTCDate(next.getUTCDate() + 1);
    else if (unit === "week") next.setUTCDate(next.getUTCDate() + 7);
    else if (unit === "month") next.setUTCMonth(next.getUTCMonth() + 1, 1);
    else next.setUTCFullYear(next.getUTCFullYear() + 1, 0, 1);
    if (next > endExclusive) next.setTime(endExclusive.getTime());

    const label = unit === "day"
      ? cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      : unit === "week"
        ? `${cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} - ${new Date(next.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
        : unit === "month"
          ? cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
          : String(cursor.getUTCFullYear());

    trend.push({
      month: label,
      count: responses.filter((response) => {
        const submitted = new Date(response.submittedAt);
        return submitted >= cursor && submitted < next;
      }).length,
    });
    cursor = next;
  }
  return trend;
}

function countRatingAnswers(responses) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, notApplicable: 0 };
  responses.forEach((response) => {
    (response.answers || []).forEach((answer) => {
      if (Number.isInteger(answer.value) && answer.value >= 1 && answer.value <= 5) {
        counts[answer.value] += 1;
      } else if (answer.value === "na") {
        counts.notApplicable += 1;
      }
    });
  });
  return counts;
}

function averageRatingFor(responses) {
  const rated = responses.filter((response) => typeof response.overallRating === "number");
  return rated.length
    ? Math.round((rated.reduce((sum, response) => sum + response.overallRating, 0) / rated.length) * 100) / 100
    : 0;
}

function satisfiedPercentFor(responses) {
  const rated = responses.filter((response) => typeof response.overallRating === "number");
  return rated.length
    ? Math.round((rated.filter((response) => response.overallRating >= SATISFIED_THRESHOLD).length / rated.length) * 100)
    : 0;
}

function filterResponses(responses, period, now) {
  if (period === "all") return responses;
  if (period === "7d") {
    const cutoff = startOfDay(now);
    cutoff.setDate(cutoff.getDate() - 6);
    return responses.filter((response) => new Date(response.submittedAt) >= cutoff);
  }
  if (period === "30d") {
    return responses.filter((response) => new Date(response.submittedAt) >= new Date(now.getTime() - 30 * 86400000));
  }
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return responses.filter((response) => new Date(response.submittedAt) >= cutoff);
}

function buildTrend(responses, period, now) {
  if (period === "7d") {
    const trend = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = startOfDay(now);
      day.setDate(day.getDate() - offset);
      const nextDay = new Date(day.getTime() + 86400000);
      trend.push({
        month: day.toLocaleString("en-US", { weekday: "short" }),
        count: responses.filter((response) => {
          const submitted = new Date(response.submittedAt);
          return submitted >= day && submitted < nextDay;
        }).length,
      });
    }
    return trend;
  }

  if (period === "30d") {
    const firstDay = new Date(startOfDay(now).getTime() - 29 * 86400000);
    const trend = [];
    for (let bucket = 0; bucket < 5; bucket++) {
      const start = new Date(firstDay.getTime() + bucket * 7 * 86400000);
      const end = new Date(Math.min(start.getTime() + 7 * 86400000, startOfDay(now).getTime() + 86400000));
      trend.push({
        month: start.toLocaleString("en-US", { month: "short", day: "numeric" }),
        count: responses.filter((response) => {
          const submitted = new Date(response.submittedAt);
          return submitted >= start && submitted < end;
        }).length,
      });
    }
    return trend;
  }

  if (period === "all") {
    const dates = responses
      .map((response) => new Date(response.submittedAt))
      .filter((date) => !Number.isNaN(date.getTime()));
    if (dates.length === 0) return [];
    const earliest = new Date(Math.min(...dates.map((date) => date.getTime())));
    const start = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
    const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return buildRangeTrend(responses, start, endExclusive);
  }

  const trend = [];
  for (let offset = 11; offset >= 0; offset--) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    trend.push({
      month: monthLabel(month),
      count: responses.filter((response) => {
        const submitted = new Date(response.submittedAt);
        return submitted.getFullYear() === month.getFullYear() && submitted.getMonth() === month.getMonth();
      }).length,
    });
  }
  return trend;
}

// GET /api/analytics/summary — admin only, powers the dashboard
router.get("/summary", requireAuth, (req, res) => {
  const allowedPeriods = new Set(["7d", "30d", "12m", "all", "custom"]);
  const period = allowedPeriods.has(req.query.period) ? req.query.period : "12m";
  const now = new Date();
  const allResponses = readAll("responses");
  const divisionId = req.query.divisionId ? Number(req.query.divisionId) : null;
  if (divisionId !== null && !readAll("divisions").some((division) => division.id === divisionId)) {
    return res.status(400).json({ error: "Choose a valid NTC Region 2 division." });
  }
  const responses = allResponses.filter((response) =>
    divisionId === null || response.divisionId === divisionId
  );
  const rated = responses.filter((response) => typeof response.overallRating === "number");
  let chartResponses;
  let trend;
  if (period === "custom") {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (!from || !to || from > to) {
      return res.status(400).json({ error: "Choose a valid start date and end date, with the start on or before the end." });
    }
    const endExclusive = new Date(to.getTime() + DAY_MS);
    chartResponses = responses.filter((response) => {
      const submitted = new Date(response.submittedAt);
      return submitted >= from && submitted < endExclusive;
    });
    trend = buildRangeTrend(chartResponses, from, endExclusive);
  } else {
    chartResponses = filterResponses(responses, period, now);
    trend = buildTrend(chartResponses, period, now);
  }
  const chartRated = chartResponses.filter((response) => typeof response.overallRating === "number");

  const totalResponses = responses.length;
  const averageRating = rated.length
    ? Math.round((rated.reduce((sum, response) => sum + response.overallRating, 0) / rated.length) * 100) / 100
    : 0;
  const satisfiedCount = rated.filter((response) => response.overallRating >= SATISFIED_THRESHOLD).length;
  const neutralCount = rated.filter(
    (response) => response.overallRating >= NEUTRAL_THRESHOLD && response.overallRating < SATISFIED_THRESHOLD
  ).length;
  const satisfiedPct = rated.length ? Math.round((satisfiedCount / rated.length) * 100) : 0;
  const neutralPct = rated.length ? Math.round((neutralCount / rated.length) * 100) : 0;
  const unsatisfiedPct = Math.max(0, 100 - satisfiedPct - neutralPct);

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthLabel = previousMonthStart.toLocaleString("en-US", { month: "short" });
  const thisMonthResponses = responses.filter((response) => {
    const submitted = new Date(response.submittedAt);
    return submitted >= currentMonthStart && submitted < nextMonthStart;
  });
  const previousMonthResponses = responses.filter((response) => {
    const submitted = new Date(response.submittedAt);
    return submitted >= previousMonthStart && submitted < currentMonthStart;
  });
  const thisMonthCount = thisMonthResponses.length;
  const thisMonthAverageRating = averageRatingFor(thisMonthResponses);
  const previousMonthAverageRating = averageRatingFor(previousMonthResponses);
  const thisMonthSatisfiedPct = satisfiedPercentFor(thisMonthResponses);
  const previousMonthSatisfiedPct = satisfiedPercentFor(previousMonthResponses);

  const chartSatisfiedCount = chartRated.filter((response) => response.overallRating >= SATISFIED_THRESHOLD).length;
  const chartNeutralCount = chartRated.filter(
    (response) => response.overallRating >= NEUTRAL_THRESHOLD && response.overallRating < SATISFIED_THRESHOLD
  ).length;
  const chartSatisfiedPct = chartRated.length ? Math.round((chartSatisfiedCount / chartRated.length) * 100) : 0;
  const chartNeutralPct = chartRated.length ? Math.round((chartNeutralCount / chartRated.length) * 100) : 0;
  const chartUnsatisfiedPct = Math.max(0, 100 - chartSatisfiedPct - chartNeutralPct);
  const satisfactionCounts = {
    satisfied: chartRated.filter((response) => response.overallRating >= SATISFIED_THRESHOLD).length,
    neutral: chartRated.filter(
      (response) => response.overallRating >= NEUTRAL_THRESHOLD && response.overallRating < SATISFIED_THRESHOLD
    ).length,
    unsatisfied: chartRated.filter((response) => response.overallRating < NEUTRAL_THRESHOLD).length,
  };
  const ratingDistribution = countRatingAnswers(chartResponses);
  const ratingAnswerCount = Object.values(ratingDistribution).reduce((sum, count) => sum + count, 0);
  const periodAverageRating = chartRated.length
    ? Math.round((chartRated.reduce((sum, response) => sum + response.overallRating, 0) / chartRated.length) * 100) / 100
    : 0;
  const divisionBuckets = new Map();
  chartResponses.forEach((response) => {
    const divisionName = response.divisionName || "Not recorded";
    if (!divisionBuckets.has(divisionName)) {
      divisionBuckets.set(divisionName, { divisionName, responseCount: 0, ratingTotal: 0, ratedCount: 0 });
    }
    const bucket = divisionBuckets.get(divisionName);
    bucket.responseCount += 1;
    if (typeof response.overallRating === "number") {
      bucket.ratingTotal += response.overallRating;
      bucket.ratedCount += 1;
    }
  });
  const divisionBreakdown = [...divisionBuckets.values()]
    .map((bucket) => ({
      divisionName: bucket.divisionName,
      responseCount: bucket.responseCount,
      ratedResponseCount: bucket.ratedCount,
      averageRating: bucket.ratedCount
        ? Math.round((bucket.ratingTotal / bucket.ratedCount) * 100) / 100
        : null,
    }))
    .sort((a, b) => b.responseCount - a.responseCount || a.divisionName.localeCompare(b.divisionName));

  res.json({
    totalResponses,
    divisionId,
    periodResponseCount: chartResponses.length,
    ratedResponseCount: chartRated.length,
    averageRating,
    periodAverageRating,
    satisfiedPct,
    thisMonthCount,
    thisMonthLabel: currentMonthStart.toLocaleString("en-US", { month: "short" }),
    previousMonthLabel,
    previousMonthCount: previousMonthResponses.length,
    thisMonthAverageRating,
    previousMonthAverageRating,
    thisMonthSatisfiedPct,
    previousMonthSatisfiedPct,
    trend,
    satisfactionCounts,
    ratingDistribution,
    ratingAnswerCount,
    divisionBreakdown,
    overallSatisfaction: {
      satisfied: chartSatisfiedPct,
      neutral: chartNeutralPct,
      unsatisfied: chartUnsatisfiedPct,
    },
  });
});

module.exports = router;
