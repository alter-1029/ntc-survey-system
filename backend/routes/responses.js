const express = require("express");
const router = express.Router();
const { readAll, insert, findById, remove } = require("../utils/jsonStore");
const requireAuth = require("../middleware/requireAuth");
const requireSurveyAuth = require("../middleware/requireSurveyAuth");

// POST /api/responses — authenticated survey users submit responses
router.post("/", requireSurveyAuth, (req, res) => {
  const { answers, divisionId } = req.body;

  const division = readAll("divisions").find((entry) => entry.id === Number(divisionId));
  if (!division) {
    return res.status(400).json({ error: "Choose a valid NTC Region 2 division before submitting." });
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "At least one answer is required." });
  }

  const allowedQuestions = readAll("questions").filter(
    (question) => question.divisionId == null || question.divisionId === division.id
  );
  const questionsById = new Map(allowedQuestions.map((question) => [question.id, question]));
  const answeredIds = new Set();
  for (const answer of answers) {
    const questionId = Number(answer.questionId);
    const question = questionsById.get(questionId);
    if (!question || answeredIds.has(questionId)) {
      return res.status(400).json({ error: "One or more answers do not belong to this division's survey." });
    }
    if (question.type === "rating" && answer.value !== "na" &&
      (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5)) {
      return res.status(400).json({ error: "Rating answers must be whole numbers from 1 to 5." });
    }
    if (question.type === "text" && typeof answer.value !== "string") {
      return res.status(400).json({ error: "Text answers must contain text." });
    }
    answeredIds.add(questionId);
  }

  const missingRating = allowedQuestions.some(
    (question) => question.type === "rating" && !answeredIds.has(question.id)
  );
  if (missingRating) {
    return res.status(400).json({ error: "Answer all required rating questions before submitting." });
  }

  const numericValues = answers
    .map((a) => a.value)
    .filter((v) => typeof v === "number");

  const overallRating =
    numericValues.length > 0
      ? Math.round(
          (numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length) * 100
        ) / 100
      : null;

  const created = insert("responses", {
    submittedAt: new Date().toISOString(),
    divisionId: division.id,
    divisionName: division.name,
    answers,
    overallRating,
  });

  res.status(201).json({ message: "Thank you for your feedback!", response: created });
});

// GET /api/responses — admin only, paginated list (newest first)
router.get("/", requireAuth, (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
  const divisionId = req.query.divisionId ? Number(req.query.divisionId) : null;
  if (divisionId !== null && !readAll("divisions").some((division) => division.id === divisionId)) {
    return res.status(400).json({ error: "Choose a valid NTC Region 2 division." });
  }

  const all = readAll("responses")
    .filter((response) => divisionId === null || response.divisionId === divisionId)
    .sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  );

  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  res.json({
    items,
    page,
    pageSize,
    total: all.length,
    totalPages: Math.ceil(all.length / pageSize),
  });
});

// GET /api/responses/:id — admin only
router.get("/:id", requireAuth, (req, res) => {
  const response = findById("responses", req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found." });
  res.json(response);
});

// DELETE /api/responses/:id — admin only
router.delete("/:id", requireAuth, (req, res) => {
  const ok = remove("responses", req.params.id);
  if (!ok) return res.status(404).json({ error: "Response not found." });
  res.status(204).send();
});

module.exports = router;
