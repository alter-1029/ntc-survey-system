const express = require("express");
const router = express.Router();
const { readAll } = require("../utils/jsonStore");
const requireSurveyAccess = require("../middleware/requireSurveyAccess");

// GET /api/categories — public, used by the survey to group questions
router.get("/", (req, res) => {
  res.json(readAll("categories"));
});

module.exports = router;
