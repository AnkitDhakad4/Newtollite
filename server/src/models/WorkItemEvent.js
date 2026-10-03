const mongoose = require('mongoose');

const WorkItemEventSchema = new mongoose.Schema(
  {
    workItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', required: true, index: true },
    sequenceNumber: { type: Number, required: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        'CREATED',
        'CLAIMED',
        'ASSIGNED',
        'UNASSIGNED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'APPROVAL_REQUESTED',
        'APPROVAL_DECIDED',
        'COMMENT_ADDED',
        'AI_ENRICHED',
        'AI_DUPLICATE_FLAGGED'
      ],
      index: true
    },
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true }
    },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed }
      }
    ],
    comment: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// High-speed indices for paginating work item audit trail
WorkItemEventSchema.index({ workItemId: 1, sequenceNumber: -1 });
WorkItemEventSchema.index({ workItemId: 1, createdAt: -1 });
WorkItemEventSchema.index({ 'actor.userId': 1, createdAt: -1 });

module.exports = mongoose.model('WorkItemEvent', WorkItemEventSchema);
