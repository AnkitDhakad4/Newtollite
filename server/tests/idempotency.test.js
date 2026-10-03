const request = require('supertest');
const { app } = require('../src/server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedDatabase } = require('../src/seed/seed');
const WorkItem = require('../src/models/WorkItem');
const WorkItemEvent = require('../src/models/WorkItemEvent');
const User = require('../src/models/User');
const { v4: uuidv4 } = require('uuid');

describe('Critical Behaviour: Idempotency & Deduplication', () => {
  jest.setTimeout(120000);
  let user;
  let workItem;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await seedDatabase();
    user = await User.findOne();
    workItem = await WorkItem.findOne({ status: 'NEW' });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('Repeating action with same Idempotency-Key returns cached response without duplicate side-effects', async () => {
    const idempotencyKey = uuidv4();
    const payload = {
      comment: 'Network timeout retry simulation'
    };

    // First request
    const firstRes = await request(app)
      .post(`/api/work-items/${workItem._id}/comments`)
      .set('x-user-id', user._id.toString())
      .set('idempotency-key', idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const commentId = firstRes.body.data._id;

    // Count events in database
    const initialCount = await WorkItemEvent.countDocuments({
      workItemId: workItem._id,
      eventType: 'COMMENT_ADDED',
      comment: payload.comment
    });
    expect(initialCount).toBe(1);

    // Second request: User clicked submit again or network resent
    const secondRes = await request(app)
      .post(`/api/work-items/${workItem._id}/comments`)
      .set('x-user-id', user._id.toString())
      .set('idempotency-key', idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.headers['x-cache-lookup']).toBe('IDEMPOTENT_HIT');
    expect(secondRes.body.data._id).toBe(commentId);

    // Side-effects check: Audit event count must still be 1 (NOT duplicated!)
    const finalCount = await WorkItemEvent.countDocuments({
      workItemId: workItem._id,
      eventType: 'COMMENT_ADDED',
      comment: payload.comment
    });
    expect(finalCount).toBe(1);
  });
});
