const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const anthropic = require('../services/anthropic');

router.post('/claude',
  body('prompt').isString().isLength({ min: 1 }).withMessage('prompt required'),
  body('model').optional().isString(),
  validate,
  async (req, res) => {
    const { prompt, model } = req.body;
    try {
      const opts = { max_tokens: 800 };
      if (model) opts.model = model;
      // only set temperature if caller provided it (some Anthropic models deprecate this field)
      if (typeof req.body.temperature === 'number') opts.temperature = req.body.temperature;
      const result = await anthropic.complete(prompt, opts);
      return res.json({ success: true, result });
    } catch (err) {
      console.error('Anthropic error:', err.message || err, err.original && err.original.response && err.original.response.data);
      return res.status(500).json({ success: false, error: 'Anthropic request failed', detail: err.message });
    }
  }
);

module.exports = router;
