const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');

async function handleIdempotency(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  // Only apply to mutating requests with the header
  if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  const userId = req.user?._id;
  if (!userId) {
    return next();
  }

  const requestHash = crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body || {})}`)
    .digest('hex');

  try {
    const existing = await IdempotencyKey.findOne({ key: idempotencyKey });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
        return res.status(existing.statusCode || 200).json(existing.responseBody);
      }

      if (existing.status === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate request in progress with this Idempotency-Key. Please wait.',
          code: 'IDEMPOTENCY_IN_PROGRESS'
        });
      }
    }

    // Register key as in progress
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hr TTL
    const record = await IdempotencyKey.create({
      key: idempotencyKey,
      userId,
      endpoint: `${req.method} ${req.originalUrl}`,
      requestHash,
      status: 'IN_PROGRESS',
      expiresAt
    });

    // Intercept response to cache upon success/failure
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      const statusCode = res.statusCode;
      IdempotencyKey.updateOne(
        { _id: record._id },
        {
          $set: {
            status: statusCode < 500 ? 'COMPLETED' : 'FAILED',
            statusCode,
            responseBody: body
          }
        }
      ).then(() => {
        originalJson(body);
      }).catch(err => {
        console.error('[Idempotency] Failed to record response:', err.message);
        originalJson(body);
      });
      return res;
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { handleIdempotency };
