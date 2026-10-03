const mongoose = require('mongoose');

const WorkItemSchema = new mongoose.Schema(
  {
    itemNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        'CUSTOMER_ISSUE',
        'INCIDENT',
        'PAYMENT_INVESTIGATION',
        'COMPLIANCE',
        'OPERATIONAL_APPROVAL'
      ],
      index: true
    },
    priority: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: ['NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED', 'CLOSED'],
      default: 'NEW',
      index: true
    },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    claimedAt: { type: Date, default: null },

    requiresApproval: { type: Boolean, default: false },
    approvalDetails: {
      state: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'NOT_REQUIRED'
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decisionReason: { type: String },
      decidedAt: { type: Date }
    },

    // Optimistic Concurrency Control (OCC) Version
    version: { type: Number, required: true, default: 1, index: true },

    // Agentic AI Autonomous Triage & Analysis
    aiAnalysis: {
      analyzedAt: { type: Date },
      modelUsed: { type: String },
      summary: { type: String },
      rootCauseHypothesis: { type: String },
      suggestedNextStep: { type: String },
      recommendedPriority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      duplicateSuspects: [
        {
          workItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem' },
          itemNumber: { type: String },
          title: { type: String },
          similarityReason: { type: String }
        }
      ],
      status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' }
    },

    slaDueAt: { type: Date, required: true, index: true },
    tags: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

// High-performance compound indexes for concurrent filtering
WorkItemSchema.index({ teamId: 1, status: 1, priority: -1, slaDueAt: 1 });
WorkItemSchema.index({ assigneeId: 1, status: 1 });
WorkItemSchema.index({ teamId: 1, assigneeId: 1, status: 1 });
WorkItemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('WorkItem', WorkItemSchema);

