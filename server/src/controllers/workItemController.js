const mongoose = require('mongoose');
const WorkItem = require('../models/WorkItem');
const WorkItemEvent = require('../models/WorkItemEvent');
const User = require('../models/User');
const { WorkflowService } = require('../services/workflowService');
const { asyncTaskQueue } = require('../services/queueService');
const { VersionConflictError, WorkflowRuleError } = require('../middleware/errorHandler');

/**
 * List work items with server-side pagination, sorting, and multi-field filtering
 */
async function getWorkItems(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.teamId) {
      query.teamId = req.query.teamId;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.assigneeId) {
      query.assigneeId = req.query.assigneeId === 'unassigned' ? null : req.query.assigneeId;
    }
    if (req.query.unassignedOnly === 'true') {
      query.assigneeId = null;
    }
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { itemNumber: { $regex: req.query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(req.query.search, 'i')] } }
      ];
    }

    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      WorkItem.find(query)
        .populate('teamId', 'name slug')
        .populate('creatorId', 'name email avatarUrl')
        .populate('assigneeId', 'name email avatarUrl')
        .populate('approvalDetails.approverId', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      WorkItem.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Operator Cockpit / Attention Feed: Urgent items needing immediate action
 */
async function getAttentionFeed(req, res, next) {
  try {
    const user = req.user;
    const userTeamIds = user.teams.map(t => t.teamId);

    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const [slaBreaching, unassignedUrgent, pendingApprovals, myActiveWork] = await Promise.all([
      // 1. SLA Breach Risk (due soon or past due)
      WorkItem.find({
        status: { $in: ['NEW', 'TRIAGED', 'IN_PROGRESS'] },
        slaDueAt: { $lte: fourHoursFromNow }
      })
        .populate('teamId', 'name slug')
        .populate('assigneeId', 'name email')
        .sort({ slaDueAt: 1 })
        .limit(5)
        .lean(),

      // 2. High or Urgent unassigned tickets
      WorkItem.find({
        assigneeId: null,
        status: { $in: ['NEW', 'TRIAGED'] },
        priority: { $in: ['HIGH', 'URGENT'] }
      })
        .populate('teamId', 'name slug')
        .sort({ priority: -1, createdAt: -1 })
        .limit(5)
        .lean(),

      // 3. Pending approvals for caller's teams
      WorkItem.find({
        status: 'PENDING_APPROVAL',
        'approvalDetails.state': 'PENDING',
        teamId: { $in: userTeamIds }
      })
        .populate('teamId', 'name slug')
        .populate('creatorId', 'name email')
        .populate('approvalDetails.requestedBy', 'name email')
        .limit(5)
        .lean(),

      // 4. Currently assigned to me
      WorkItem.find({
        assigneeId: user._id,
        status: { $in: ['IN_PROGRESS', 'PENDING_APPROVAL'] }
      })
        .populate('teamId', 'name slug')
        .sort({ priority: -1, slaDueAt: 1 })
        .limit(5)
        .lean()
    ]);

    res.json({
      success: true,
      feed: {
        slaBreaching,
        unassignedUrgent,
        pendingApprovals,
        myActiveWork
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single work item
 */
async function getWorkItemById(req, res, next) {
  try {
    const item = await WorkItem.findById(req.params.id)
      .populate('teamId', 'name slug allowedCategories')
      .populate('creatorId', 'name email avatarUrl')
      .populate('assigneeId', 'name email avatarUrl')
      .populate('approvalDetails.approverId', 'name email')
      .populate('approvalDetails.requestedBy', 'name email');

    if (!item) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    res.setHeader('ETag', `W/"${item.version}"`);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new work item with version 1 and trigger async AI Triage
 */
async function createWorkItem(req, res, next) {
  try {
    const { title, description, category, priority, teamId, requiresApproval, slaHours = 24, tags = [] } = req.body;
    const user = req.user;

    // Generate unique sequential code (e.g. OPS-3841)
    const count = await WorkItem.countDocuments();
    const itemNumber = `OPS-${1000 + count + 1}`;

    const slaDueAt = new Date(Date.now() + (parseInt(slaHours) || 24) * 60 * 60 * 1000);

    const newItem = await WorkItem.create({
      itemNumber,
      title,
      description,
      category,
      priority: priority || 'MEDIUM',
      status: 'NEW',
      teamId,
      creatorId: user._id,
      assigneeId: null,
      requiresApproval: !!requiresApproval,
      approvalDetails: {
        state: requiresApproval ? 'PENDING' : 'NOT_REQUIRED'
      },
      version: 1,
      slaDueAt,
      tags: Array.isArray(tags) ? tags : []
    });

    // Record initial event in audit history collection
    await WorkItemEvent.create({
      workItemId: newItem._id,
      sequenceNumber: 1,
      eventType: 'CREATED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [
        { field: 'status', oldValue: null, newValue: 'NEW' },
        { field: 'priority', oldValue: null, newValue: newItem.priority }
      ],
      comment: 'Work item initialized.'
    });

    // Dispatch background job for AI Copilot enrichment (asynchronous)
    asyncTaskQueue.enqueue('ENRICH_WORK_ITEM', { workItemId: newItem._id.toString() });

    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    next(err);
  }
}

/**
 * Update details with Optimistic Concurrency Control (OCC)
 */
async function updateWorkItem(req, res, next) {
  try {
    const { id } = req.params;
    const { version, title, description, priority, category, tags } = req.body;
    const user = req.user;

    if (version === undefined || version === null) {
      return res.status(400).json({
        success: false,
        error: "Missing required 'version' for optimistic concurrency check."
      });
    }

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    // OCC Check: Did another user change it while this user was editing?
    if (current.version !== parseInt(version)) {
      throw new VersionConflictError(
        `Update rejected: Item has been modified by another user (Server version: ${current.version}, Submitted version: ${version}).`,
        current
      );
    }

    // Build changes diff for audit history
    const changes = [];
    if (title && title !== current.title) changes.push({ field: 'title', oldValue: current.title, newValue: title });
    if (description && description !== current.description) changes.push({ field: 'description', oldValue: current.description, newValue: description });
    if (priority && priority !== current.priority) changes.push({ field: 'priority', oldValue: current.priority, newValue: priority });
    if (category && category !== current.category) changes.push({ field: 'category', oldValue: current.category, newValue: category });

    const updated = await WorkItem.findOneAndUpdate(
      { _id: id, version: current.version },
      {
        $set: {
          ...(title && { title }),
          ...(description && { description }),
          ...(priority && { priority }),
          ...(category && { category }),
          ...(tags && { tags })
        },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new VersionConflictError('Concurrent modification detected during update.', await WorkItem.findById(id));
    }

    if (changes.length > 0) {
      await WorkItemEvent.create({
        workItemId: updated._id,
        sequenceNumber: updated.version,
        eventType: 'STATUS_CHANGED',
        actor: {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.globalRole
        },
        changes,
        comment: 'Work item details updated.'
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Atomic Claim: Resolves race condition when 2 users click claim simultaneously
 */
async function claimWorkItem(req, res, next) {
  try {
    const { id } = req.params;
    const { version } = req.body;
    const user = req.user;

    // Check version if provided
    const query = { _id: id, assigneeId: null };
    if (version !== undefined && version !== null) {
      query.version = parseInt(version);
    }

    // Atomic compare-and-swap
    const updated = await WorkItem.findOneAndUpdate(
      query,
      {
        $set: {
          assigneeId: user._id,
          claimedAt: new Date(),
          status: 'IN_PROGRESS'
        },
        $inc: { version: 1 }
      },
      { new: true }
    ).populate('assigneeId', 'name email');

    if (!updated) {
      const current = await WorkItem.findById(id).populate('assigneeId', 'name email');
      if (!current) {
        return res.status(404).json({ success: false, error: 'Work item not found' });
      }
      if (current.assigneeId) {
        return res.status(409).json({
          success: false,
          error: `Claim failed: Item has already been claimed by ${current.assigneeId.name || 'another user'}.`,
          code: 'ALREADY_CLAIMED',
          currentResource: current
        });
      }
      throw new VersionConflictError('Version mismatch while claiming work item.', current);
    }

    // Record claim in audit trail
    await WorkItemEvent.create({
      workItemId: updated._id,
      sequenceNumber: updated.version,
      eventType: 'CLAIMED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [
        { field: 'assigneeId', oldValue: null, newValue: user._id.toString() },
        { field: 'status', oldValue: 'NEW', newValue: 'IN_PROGRESS' }
      ],
      comment: `${user.name} took responsibility for this work item.`
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Assign to another user with permission and team check
 */
async function assignWorkItem(req, res, next) {
  try {
    const { id } = req.params;
    const { targetUserId, version } = req.body;
    const actor = req.user;

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    if (version !== undefined && current.version !== parseInt(version)) {
      throw new VersionConflictError('Version mismatch. Stale item state.', current);
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(400).json({ success: false, error: 'Target user does not exist' });
    }

    const oldAssigneeId = current.assigneeId;

    const updated = await WorkItem.findOneAndUpdate(
      { _id: id, version: current.version },
      {
        $set: {
          assigneeId: targetUser._id,
          claimedAt: new Date(),
          status: current.status === 'NEW' ? 'TRIAGED' : current.status
        },
        $inc: { version: 1 }
      },
      { new: true }
    ).populate('assigneeId', 'name email');

    if (!updated) {
      throw new VersionConflictError('Concurrent edit conflict during assignment.', await WorkItem.findById(id));
    }

    await WorkItemEvent.create({
      workItemId: updated._id,
      sequenceNumber: updated.version,
      eventType: 'ASSIGNED',
      actor: {
        userId: actor._id,
        name: actor.name,
        email: actor.email,
        role: actor.globalRole
      },
      changes: [
        { field: 'assigneeId', oldValue: oldAssigneeId ? oldAssigneeId.toString() : null, newValue: targetUser._id.toString() }
      ],
      comment: `Reassigned from ${oldAssigneeId || 'Unassigned'} to ${targetUser.name}.`
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * State machine status transition
 */
async function transitionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { targetStatus, reason, version } = req.body;
    const user = req.user;

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    if (version !== undefined && current.version !== parseInt(version)) {
      throw new VersionConflictError('Cannot transition: Work item version is stale.', current);
    }

    // Validate transition against state machine rules
    WorkflowService.validateTransition(current, targetStatus);

    const oldStatus = current.status;

    const updated = await WorkItem.findOneAndUpdate(
      { _id: id, version: current.version },
      {
        $set: { status: targetStatus },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new VersionConflictError('Concurrent state change detected.', await WorkItem.findById(id));
    }

    await WorkItemEvent.create({
      workItemId: updated._id,
      sequenceNumber: updated.version,
      eventType: 'STATUS_CHANGED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [{ field: 'status', oldValue: oldStatus, newValue: targetStatus }],
      comment: reason || `Status transitioned from ${oldStatus} to ${targetStatus}.`
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Request Operational Approval
 */
async function requestApproval(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, approverId, version } = req.body;
    const user = req.user;

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    if (version !== undefined && current.version !== parseInt(version)) {
      throw new VersionConflictError('Version mismatch. Refresh required.', current);
    }

    const updated = await WorkItem.findOneAndUpdate(
      { _id: id, version: current.version },
      {
        $set: {
          requiresApproval: true,
          status: 'PENDING_APPROVAL',
          approvalDetails: {
            state: 'PENDING',
            requestedBy: user._id,
            approverId: approverId || null,
            decisionReason: null,
            decidedAt: null
          }
        },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new VersionConflictError('Conflict requesting approval.', await WorkItem.findById(id));
    }

    await WorkItemEvent.create({
      workItemId: updated._id,
      sequenceNumber: updated.version,
      eventType: 'APPROVAL_REQUESTED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [{ field: 'status', oldValue: current.status, newValue: 'PENDING_APPROVAL' }],
      comment: reason || 'Operational approval requested before continuing.'
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Decide Operational Approval (Approve or Reject)
 */
async function decideApproval(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, reason, version } = req.body; // 'APPROVED' or 'REJECTED'
    const user = req.user;

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be APPROVED or REJECTED' });
    }

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    if (version !== undefined && current.version !== parseInt(version)) {
      throw new VersionConflictError('Version mismatch during approval decision.', current);
    }

    WorkflowService.validateApprovalDecision(current, decision);

    // Enforce team lead or admin authorization
    const isLeadOrAdmin = user.globalRole === 'ADMIN' || user.teams.some(
      t => t.teamId.toString() === current.teamId.toString() && (t.role === 'TEAM_LEAD' || t.role === 'ADMIN')
    );

    if (!isLeadOrAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only a Team Lead or Admin can grant operational approval.'
      });
    }

    const nextStatus = decision === 'APPROVED' ? 'RESOLVED' : 'IN_PROGRESS';

    const updated = await WorkItem.findOneAndUpdate(
      { _id: id, version: current.version },
      {
        $set: {
          status: nextStatus,
          'approvalDetails.state': decision,
          'approvalDetails.approverId': user._id,
          'approvalDetails.decisionReason': reason || '',
          'approvalDetails.decidedAt': new Date()
        },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new VersionConflictError('Conflict recording approval decision.', await WorkItem.findById(id));
    }

    await WorkItemEvent.create({
      workItemId: updated._id,
      sequenceNumber: updated.version,
      eventType: 'APPROVAL_DECIDED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [
        { field: 'approvalDetails.state', oldValue: 'PENDING', newValue: decision },
        { field: 'status', oldValue: current.status, newValue: nextStatus }
      ],
      comment: `Approval ${decision}: ${reason || 'Decision recorded'}`
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetch Paginated Audit Trail / History
 */
async function getHistory(req, res, next) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      WorkItemEvent.find({ workItemId: id })
        .sort({ sequenceNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WorkItemEvent.countDocuments({ workItemId: id })
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add Comment to Audit History
 */
async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const user = req.user;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text is required.' });
    }

    const current = await WorkItem.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }

    const eventCount = await WorkItemEvent.countDocuments({ workItemId: current._id });
    const event = await WorkItemEvent.create({
      workItemId: current._id,
      sequenceNumber: eventCount + 1,
      eventType: 'COMMENT_ADDED',
      actor: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.globalRole
      },
      changes: [],
      comment: comment.trim()
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWorkItems,
  getAttentionFeed,
  getWorkItemById,
  createWorkItem,
  updateWorkItem,
  claimWorkItem,
  assignWorkItem,
  transitionStatus,
  requestApproval,
  decideApproval,
  getHistory,
  addComment
};
