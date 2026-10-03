const request = require('supertest');
const { app } = require('../src/server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedDatabase } = require('../src/seed/seed');
const WorkItem = require('../src/models/WorkItem');
const User = require('../src/models/User');

describe('Critical Behaviour: Concurrency & Race Conditions', () => {
  jest.setTimeout(120000);
  let users;
  let unassignedTicket;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await seedDatabase();
    users = await User.find();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    // Ensure clean unassigned ticket for race test
    unassignedTicket = await WorkItem.findOne({ assigneeId: null });
  });

  test('Simultaneous Claim Race Condition: Only ONE user succeeds, others receive 409 Conflict', async () => {
    expect(unassignedTicket).toBeDefined();

    // 4 distinct users attempt to claim the exact same work item simultaneously
    const claimPromises = users.slice(0, 4).map(user =>
      request(app)
        .post(`/api/work-items/${unassignedTicket._id}/claim`)
        .set('x-user-id', user._id.toString())
        .send({ version: unassignedTicket.version })
    );

    const responses = await Promise.all(claimPromises);

    const successfulClaims = responses.filter(r => r.status === 200);
    const conflictClaims = responses.filter(r => r.status === 409);

    // Exactly 1 winner
    expect(successfulClaims.length).toBe(1);
    // All other 3 are rejected with 409 Conflict
    expect(conflictClaims.length).toBe(3);

    // Verify winner holds the lock in the database
    const freshTicket = await WorkItem.findById(unassignedTicket._id);
    expect(freshTicket.assigneeId).not.toBeNull();
    expect(freshTicket.assigneeId.toString()).toBe(successfulClaims[0].body.data.assigneeId._id.toString());
  });

  test('Optimistic Concurrency Control (OCC): Stale edit is rejected with 409 Conflict', async () => {
    const item = await WorkItem.findOne({ status: 'IN_PROGRESS' });
    const originalVersion = item.version;

    // User A reads version V
    // User B updates the ticket to version V + 1
    const userBUpdate = await request(app)
      .put(`/api/work-items/${item._id}`)
      .set('x-user-id', users[1]._id.toString())
      .send({
        version: originalVersion,
        title: 'Title updated by User B'
      });

    expect(userBUpdate.status).toBe(200);
    expect(userBUpdate.body.data.version).toBe(originalVersion + 1);

    // User A now submits an update using their stale version V
    const userAStaleUpdate = await request(app)
      .put(`/api/work-items/${item._id}`)
      .set('x-user-id', users[0]._id.toString())
      .send({
        version: originalVersion, // Stale!
        title: 'Title blindly overwritten by User A'
      });

    // Server must reject with 409 Conflict
    expect(userAStaleUpdate.status).toBe(409);
    expect(userAStaleUpdate.body.error).toContain('Item has been modified by another user');
    expect(userAStaleUpdate.body.details.currentResource.version).toBe(originalVersion + 1);
  });
});
