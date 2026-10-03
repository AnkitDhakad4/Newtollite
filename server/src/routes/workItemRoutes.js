const express = require('express');
const router = express.Router();
const workItemController = require('../controllers/workItemController');
const { handleIdempotency } = require('../middleware/idempotency');

// Attention feed / Cockpit (must be placed before /:id)
router.get('/attention-feed', workItemController.getAttentionFeed);

// Core list & create
router.get('/', workItemController.getWorkItems);
router.post('/', handleIdempotency, workItemController.createWorkItem);

// Single item
router.get('/:id', workItemController.getWorkItemById);
router.put('/:id', handleIdempotency, workItemController.updateWorkItem);

// Concurrency-critical actions
router.post('/:id/claim', handleIdempotency, workItemController.claimWorkItem);
router.post('/:id/assign', handleIdempotency, workItemController.assignWorkItem);
router.post('/:id/transition', handleIdempotency, workItemController.transitionStatus);
router.post('/:id/request-approval', handleIdempotency, workItemController.requestApproval);
router.post('/:id/decide-approval', handleIdempotency, workItemController.decideApproval);

// Audit history & collaboration
router.get('/:id/history', workItemController.getHistory);
router.post('/:id/comments', handleIdempotency, workItemController.addComment);

module.exports = router;
