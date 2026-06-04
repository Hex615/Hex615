const { validationResult } = require('express-validator');

// Run after express-validator chains — returns 422 if any errors
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array().map((e) => ({ field: e.path, msg: e.msg })) });
  }
  next();
}

// UUID format check for route params
const { param } = require('express-validator');
function uuidParam(name) {
  return param(name).isUUID(4).withMessage(`${name} must be a valid UUID`);
}

module.exports = { validate, uuidParam };
