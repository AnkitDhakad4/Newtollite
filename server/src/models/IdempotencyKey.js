const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'], 
      default: 'IN_PROGRESS' 
    },
    statusCode: { type: Number },
    responseBody: { type: mongoose.Schema.Types.Mixed },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// TTL index to automatically prune keys after expiration
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
