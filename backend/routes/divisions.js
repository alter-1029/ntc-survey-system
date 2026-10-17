const express = require("express");
const router = express.Router();
const { readAll } = require("../utils/jsonStore");
const requireSurveyAccess = require("../middleware/requireSurveyAccess");

router.get("/", requireSurveyAccess, (req, res) => {
  res.json(readAll("divisions"));
});

module.exports = router;
