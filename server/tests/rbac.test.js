import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/seed/seed.js';
import WorkItem from '../src/models/WorkItem.js';
import User from '../src/models/User.js';
import Team from '../src/models/Team.js';

describe('Critical Behaviour: Resource-Level Role-Based Access Control (RBAC)', () => {
  let finopsLeadAlice;
  let sreOperatorBob;
  let finopsMemberDavid;
  let finopsItem;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    await seedDatabase();

    finopsLeadAlice = await User.findOne({ email: 'alice@newtonite.internal' });
    sreOperatorBob = await User.findOne({ email: 'bob@newtonite.internal' });
    finopsMemberDavid = await User.findOne({ email: 'david@newtonite.internal' });

    const finopsTeam = await Team.findOne({ slug: 'finops' });
    finopsItem = await WorkItem.findOne({ teamId: finopsTeam._id });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('User cannot modify an item outside their team purview (Returns 403 Forbidden)', async () => {
    // Bob is in SRE, not in FinOps
    const res = await request(app)
      .put(`/api/work-items/${finopsItem._id}`)
      .set('x-user-id', sreOperatorBob._id.toString())
      .send({
        version: finopsItem.version,
        title: 'Unauthorized title edit by SRE on FinOps item'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  test('User cannot claim an item outside their team purview (Returns 403 Forbidden)', async () => {
    // Bob attempts to claim a FinOps item
    const res = await request(app)
      .post(`/api/work-items/${finopsItem._id}/claim`)
      .set('x-user-id', sreOperatorBob._id.toString())
      .send({
        version: finopsItem.version
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('outside your team\'s purview');
  });

  test('Team member without TEAM_LEAD role cannot grant operational approval (Returns 403 Forbidden)', async () => {
    const pendingApprovalItem = await WorkItem.findOne({
      requiresApproval: true,
      'approvalDetails.state': 'PENDING'
    });
    expect(pendingApprovalItem).toBeDefined();

    // David is only a MEMBER of FinOps, not a TEAM_LEAD or ADMIN
    const res = await request(app)
      .post(`/api/work-items/${pendingApprovalItem._id}/decide-approval`)
      .set('x-user-id', finopsMemberDavid._id.toString())
      .send({
        decision: 'APPROVED',
        reason: 'Unauthorized rogue approval attempt by junior operator',
        version: pendingApprovalItem.version
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Only a Team Lead or Admin');
  });

  test('Authorized Team Lead or Admin CAN grant approval (Returns 200 OK)', async () => {
    const pendingApprovalItem = await WorkItem.findOne({
      requiresApproval: true,
      'approvalDetails.state': 'PENDING'
    });
    expect(pendingApprovalItem).toBeDefined();

    // Alice is TEAM_LEAD of FinOps & Global ADMIN
    const res = await request(app)
      .post(`/api/work-items/${pendingApprovalItem._id}/decide-approval`)
      .set('x-user-id', finopsLeadAlice._id.toString())
      .send({
        decision: 'APPROVED',
        reason: 'Verified against clearing gateway statements',
        version: pendingApprovalItem.version
      });

    expect(res.status).toBe(200);
    expect(res.body.data.approvalDetails.state).toBe('APPROVED');
    expect(res.body.data.status).toBe('RESOLVED');
  });
});
