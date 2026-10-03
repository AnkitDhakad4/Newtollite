require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const WorkItem = require('../models/WorkItem');
const WorkItemEvent = require('../models/WorkItemEvent');

async function seedDatabase() {
  console.log('[Seed] Seeding database with operational scenarios...');

  // Clear existing
  await Promise.all([
    User.deleteMany({}),
    Team.deleteMany({}),
    WorkItem.deleteMany({}),
    WorkItemEvent.deleteMany({})
  ]);

  // 1. Teams
  const finopsTeam = await Team.create({
    name: 'FinOps & Settlement',
    slug: 'finops',
    description: 'Handles payment discrepancies, clearing reconciliations, and financial ledger exceptions.',
    allowedCategories: ['PAYMENT_INVESTIGATION', 'OPERATIONAL_APPROVAL']
  });

  const infraTeam = await Team.create({
    name: 'Platform SRE & Infra',
    slug: 'infra',
    description: 'Guarantees 99.99% availability, resolves production outages, and remediates infrastructure bottlenecks.',
    allowedCategories: ['INCIDENT', 'CUSTOMER_ISSUE']
  });

  const complianceTeam = await Team.create({
    name: 'Compliance & Risk',
    slug: 'compliance',
    description: 'Manages regulatory audits, KYC alerts, and fraud investigations.',
    allowedCategories: ['COMPLIANCE', 'OPERATIONAL_APPROVAL']
  });

  // 2. Users
  const alice = await User.create({
    name: 'Alice Vance',
    email: 'alice@newtonite.internal',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    globalRole: 'ADMIN',
    teams: [
      { teamId: finopsTeam._id, role: 'TEAM_LEAD' },
      { teamId: infraTeam._id, role: 'MEMBER' }
    ]
  });

  const bob = await User.create({
    name: 'Bob Martinez',
    email: 'bob@newtonite.internal',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    globalRole: 'OPERATOR',
    teams: [
      { teamId: infraTeam._id, role: 'TEAM_LEAD' }
    ]
  });

  const carol = await User.create({
    name: 'Carol Chen',
    email: 'carol@newtonite.internal',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    globalRole: 'OPERATOR',
    teams: [
      { teamId: complianceTeam._id, role: 'TEAM_LEAD' }
    ]
  });

  const david = await User.create({
    name: 'David Kim',
    email: 'david@newtonite.internal',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    globalRole: 'OPERATOR',
    teams: [
      { teamId: finopsTeam._id, role: 'MEMBER' }
    ]
  });

  // Link leads
  finopsTeam.leadUserId = alice._id;
  await finopsTeam.save();
  infraTeam.leadUserId = bob._id;
  await infraTeam.save();
  complianceTeam.leadUserId = carol._id;
  await complianceTeam.save();

  // 3. Work Items
  const item1 = await WorkItem.create({
    itemNumber: 'OPS-1001',
    title: 'ACH Settlement Batch #4409 Desync with Gateway',
    description: 'Batch #4409 containing $1.4M in merchant payouts failed nightly reconciliation. Ledger records show pending status while bank partner reported credit completed.',
    category: 'PAYMENT_INVESTIGATION',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    teamId: finopsTeam._id,
    creatorId: david._id,
    assigneeId: alice._id,
    claimedAt: new Date(Date.now() - 3600000),
    requiresApproval: true,
    approvalDetails: {
      state: 'PENDING',
      requestedBy: david._id
    },
    version: 3,
    slaDueAt: new Date(Date.now() + 2 * 3600000), // Due in 2 hours (Urgent attention)
    tags: ['ach', 'finance', 'gateway'],
    aiAnalysis: {
      analyzedAt: new Date(),
      modelUsed: 'newtonite-heuristic-v1',
      summary: 'Critical financial reconciliation discrepancy between ledger and external payment gateway.',
      rootCauseHypothesis: 'Reconciliation pipeline discrepancy between internal ledger and payment gateway webhooks.',
      suggestedNextStep: 'Query payment transaction audit logs for batch mismatch, verify webhook delivery timestamps.',
      recommendedPriority: 'HIGH',
      duplicateSuspects: [],
      status: 'COMPLETED'
    }
  });

  // Events for item1
  await WorkItemEvent.create([
    {
      workItemId: item1._id,
      sequenceNumber: 1,
      eventType: 'CREATED',
      actor: { userId: david._id, name: david.name, email: david.email, role: david.globalRole },
      changes: [{ field: 'status', oldValue: null, newValue: 'NEW' }],
      comment: 'Work item created from automated night-batch alert.'
    },
    {
      workItemId: item1._id,
      sequenceNumber: 2,
      eventType: 'CLAIMED',
      actor: { userId: alice._id, name: alice.name, email: alice.email, role: alice.globalRole },
      changes: [
        { field: 'assigneeId', oldValue: null, newValue: alice._id.toString() },
        { field: 'status', oldValue: 'NEW', newValue: 'IN_PROGRESS' }
      ],
      comment: 'Alice claimed ticket to investigate gateway clearing logs.'
    },
    {
      workItemId: item1._id,
      sequenceNumber: 3,
      eventType: 'APPROVAL_REQUESTED',
      actor: { userId: alice._id, name: alice.name, email: alice.email, role: alice.globalRole },
      changes: [{ field: 'status', oldValue: 'IN_PROGRESS', newValue: 'PENDING_APPROVAL' }],
      comment: 'Requires dual-authorization to execute manual ledger balance adjustment.'
    }
  ]);

  const item2 = await WorkItem.create({
    itemNumber: 'OPS-1002',
    title: 'Kubernetes Pod OOM CrashLoop in prod-eu-west',
    description: 'Payment routing worker pods in namespace prod-eu-west are exceeding memory limits (2Gi) and being killed by Linux kernel OOM killer. Request latency has spiked to 4.2s.',
    category: 'INCIDENT',
    priority: 'URGENT',
    status: 'NEW',
    teamId: infraTeam._id,
    creatorId: bob._id,
    assigneeId: null, // UNASSIGNED - Race condition target for demo!
    version: 1,
    slaDueAt: new Date(Date.now() + 1 * 3600000), // Due in 1 hour
    tags: ['kubernetes', 'oom', 'latency', 'production'],
    aiAnalysis: {
      analyzedAt: new Date(),
      modelUsed: 'newtonite-heuristic-v1',
      summary: 'Severe memory leak causing cascading pod terminations in production payment routing cluster.',
      rootCauseHypothesis: 'Process memory exhaustion or connection pool depletion under peak operational load.',
      suggestedNextStep: 'Inspect APM heap profiles, scale container replicas, and check circuit breaker metrics.',
      recommendedPriority: 'URGENT',
      duplicateSuspects: [],
      status: 'COMPLETED'
    }
  });

  await WorkItemEvent.create({
    workItemId: item2._id,
    sequenceNumber: 1,
    eventType: 'CREATED',
    actor: { userId: bob._id, name: bob.name, email: bob.email, role: bob.globalRole },
    changes: [{ field: 'status', oldValue: null, newValue: 'NEW' }],
    comment: 'PagerDuty incident P-8823 auto-escalated.'
  });

  const item3 = await WorkItem.create({
    itemNumber: 'OPS-1003',
    title: 'Suspicious Wire Transfer Sanction Alert #9910',
    description: 'Transaction of €350,000 flagged due to beneficiary entity name fuzzy match with OFAC sanctions list. System placed automatic hold pending compliance verification.',
    category: 'COMPLIANCE',
    priority: 'HIGH',
    status: 'PENDING_APPROVAL',
    teamId: complianceTeam._id,
    creatorId: carol._id,
    assigneeId: carol._id,
    requiresApproval: true,
    approvalDetails: {
      state: 'PENDING',
      requestedBy: carol._id
    },
    version: 2,
    slaDueAt: new Date(Date.now() + 6 * 3600000),
    tags: ['ofac', 'sanctions', 'wire-transfer'],
    aiAnalysis: {
      analyzedAt: new Date(),
      modelUsed: 'newtonite-heuristic-v1',
      summary: 'Sanctions screening fuzzy match triggered regulatory hold.',
      rootCauseHypothesis: 'Automated screening rule flagged transaction against sanctioned entities list.',
      suggestedNextStep: 'Conduct secondary identity verification and obtain Team Lead compliance sign-off.',
      recommendedPriority: 'HIGH',
      duplicateSuspects: [],
      status: 'COMPLETED'
    }
  });

  await WorkItemEvent.create({
    workItemId: item3._id,
    sequenceNumber: 1,
    eventType: 'CREATED',
    actor: { userId: carol._id, name: carol.name, email: carol.email, role: carol.globalRole },
    changes: [{ field: 'status', oldValue: null, newValue: 'PENDING_APPROVAL' }],
    comment: 'Automated screening alert ingested.'
  });

  console.log(`[Seed] Seeded ${await User.countDocuments()} users, ${await Team.countDocuments()} teams, and ${await WorkItem.countDocuments()} operational work items.`);
}

module.exports = { seedDatabase };

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB().then(async () => {
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  });
}

