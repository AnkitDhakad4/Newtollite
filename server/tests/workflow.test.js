const request = require('supertest');
const { app } = require('../src/server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedDatabase } = require('../src/seed/seed');
const WorkItem = require('../src/models/WorkItem');
const User = require('../src/models/User');

describe('Critical Behaviour: Workflow State Machine & Approval Enforcement', () => {
  jest.setTimeout(120000);
  let adminUser;
  let operatorUser;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await seedDatabase();
    adminUser = await User.findOne({ globalRole: 'ADMIN' });
    operatorUser = await User.findOne({ globalRole: 'OPERATOR' });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('Cannot transition to RESOLVED if required approval is still PENDING', async () => {
    const pendingItem = await WorkItem.findOne({
      requiresApproval: true,
      'approvalDetails.state': 'PENDING'
    });
    expect(pendingItem).toBeDefined();

    const res = await request(app)
      .post(`/api/work-items/${pendingItem._id}/transition`)
      .set('x-user-id', adminUser._id.toString())
      .send({
        targetStatus: 'RESOLVED',
        version: pendingItem.version
      });

    // Must be rejected by the workflow state machine
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Operational approval is required');
  });

  test('Illegal state jumps (e.g. NEW -> RESOLVED) are blocked with 422 Unprocessable Entity', async () => {
    const newItem = await WorkItem.findOne({ status: 'NEW' });
    expect(newItem).toBeDefined();

    const res = await request(app)
      .post(`/api/work-items/${newItem._id}/transition`)
      .set('x-user-id', adminUser._id.toString())
      .send({
        targetStatus: 'RESOLVED',
        version: newItem.version
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Invalid status transition');
  });
});
