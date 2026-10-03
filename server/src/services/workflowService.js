const { WorkflowRuleError } = require('../middleware/errorHandler');

const VALID_STATUS_TRANSITIONS = {
  NEW: ['TRIAGED', 'CLOSED'],
  TRIAGED: ['IN_PROGRESS', 'PENDING_APPROVAL', 'CLOSED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'RESOLVED', 'TRIAGED'],
  PENDING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['TRIAGED']
};

class WorkflowService {
  /**
   * Validate that a state transition is legally allowed under business rules
   */
  static validateTransition(item, targetStatus, targetAssigneeId = null) {
    const currentStatus = item.status;

    if (currentStatus === targetStatus) {
      throw new WorkflowRuleError(`Item is already in status '${targetStatus}'.`);
    }

    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new WorkflowRuleError(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ')}]`
      );
    }

    // Rule 1: Cannot move to IN_PROGRESS without an assignee
    const effectiveAssignee = targetAssigneeId || item.assigneeId;
    if (targetStatus === 'IN_PROGRESS' && !effectiveAssignee) {
      throw new WorkflowRuleError('Cannot move to IN_PROGRESS without an assigned owner.');
    }

    // Rule 2: Cannot resolve if approval is required and not granted
    if (targetStatus === 'RESOLVED' && item.requiresApproval) {
      if (!item.approvalDetails || item.approvalDetails.state !== 'APPROVED') {
        throw new WorkflowRuleError(
          `Cannot resolve work item: Operational approval is required and currently '${item.approvalDetails?.state || 'NOT_GRANTED'}'.`
        );
      }
    }
  }

  /**
   * Validate approval decision rules
   */
  static validateApprovalDecision(item, decision) {
    if (!item.requiresApproval) {
      throw new WorkflowRuleError('This work item does not require operational approval.');
    }

    if (item.approvalDetails?.state !== 'PENDING') {
      throw new WorkflowRuleError(
        `Cannot decide on approval: Current approval state is '${item.approvalDetails?.state}', not 'PENDING'.`
      );
    }
  }
}

module.exports = {
  WorkflowService,
  VALID_STATUS_TRANSITIONS
};

