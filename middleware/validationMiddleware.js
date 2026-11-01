const { matchedData, validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map(({ path, msg }) => ({
        field: path,
        message: msg
      }))
    });
  }

  req.body = matchedData(req, { locations: ["body"] });
  next();
};

module.exports = validate;
