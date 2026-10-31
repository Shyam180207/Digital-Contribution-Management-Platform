import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import { createDataStore } from '../src/dataStore.js'

function query(value) {
  const result = {
    sort: () => result,
    limit: () => result,
    populate: () => result,
    select: () => result,
    lean: async () => value,
  }
  return result
}

test('dashboard reads only groups owned by the requesting account', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const userMember = new mongoose.Types.ObjectId()
  const seenQueries = []
  const group = {
    _id: groupId,
    name: 'Garden Circle',
    currency: 'INR',
  }
  const store = createDataStore({
    GroupModel: {
      find(filter) {
        seenQueries.push(['groups', filter])
        return query([group])
      },
    },
    MemberModel: {
      aggregate: async (pipeline) => {
        seenQueries.push(['memberAggregate', pipeline[0].$match.group.$in])
        return [{ _id: groupId, count: 1 }]
      },
      countDocuments: async (filter) => {
        seenQueries.push(['memberCount', filter.group.$in])
        return 1
      },
      find: (filter) => {
        seenQueries.push(['members', filter.group.$in])
        return query([{
          _id: userMember,
          name: 'Aarav Sharma',
          phone: '555-0101',
          group: { name: group.name },
          createdAt: new Date('2026-10-30T12:00:00Z'),
        }])
      },
    },
    TransactionModel: {
      aggregate: async (pipeline) => {
        seenQueries.push(['transactionAggregate', pipeline[0].$match.group.$in])
        if (pipeline.some((stage) => stage.$group?._id?.$dateToString)) return []
        return [{ _id: groupId, contributionsMinor: 5000, payoutsMinor: 1000 }]
      },
      countDocuments: async (filter) => {
        seenQueries.push(['transactionCount', filter.group.$in])
        return filter.kind === 'contribution' ? 2 : 1
      },
      find: (filter) => {
        seenQueries.push(['transactions', filter.group.$in])
        return query([{
          _id: new mongoose.Types.ObjectId(),
          member: { name: 'Aarav Sharma' },
          group: { name: group.name, currency: group.currency },
          kind: 'contribution',
          amountMinor: 2500,
          createdAt: new Date('2026-10-31T12:00:00Z'),
        }])
      },
    },
  })

  const dashboard = await store.getDashboard(ownerId, new Date('2026-10-31T12:00:00Z'))

  assert.deepEqual(seenQueries[0], ['groups', { owner: ownerId }])
  assert.ok(seenQueries.slice(1).every(([, groupIds]) => groupIds[0] === groupId))
  assert.equal(dashboard.summary.activeMembers, 1)
  assert.equal(dashboard.summary.contributionsThisMonth, 2)
  assert.deepEqual(dashboard.groups[0], {
    id: String(groupId),
    name: 'Garden Circle',
    currency: 'INR',
    members: 1,
    balanceMinor: 4000,
    color: 'lavender',
    initials: 'GC',
  })
  assert.equal(dashboard.members[0].name, 'Aarav Sharma')
  assert.equal(dashboard.activities[0].amountMinor, 2500)
  assert.equal(dashboard.chart.labels.length, 7)
})

test('group list returns only records owned by the requesting account', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  let seenFilter
  const store = createDataStore({
    GroupModel: {
      find(filter) {
        seenFilter = filter
        return query([{
          _id: groupId,
          name: 'Garden Circle',
          currency: 'INR',
          createdAt: new Date('2026-10-30T12:00:00Z'),
        }])
      },
    },
  })

  assert.deepEqual(await store.listGroups(ownerId), [{
    id: String(groupId),
    name: 'Garden Circle',
    currency: 'INR',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  }])
  assert.deepEqual(seenFilter, { owner: ownerId })
})

test('group member list verifies ownership before reading member records', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const memberId = new mongoose.Types.ObjectId()
  const seenQueries = []
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        seenQueries.push(['group', filter])
        return query({ _id: groupId })
      },
    },
    MemberModel: {
      find(filter) {
        seenQueries.push(['members', filter])
        return query([{
          _id: memberId,
          name: 'Aarav Sharma',
          phone: '555-0101',
          createdAt: new Date('2026-10-30T12:00:00Z'),
        }])
      },
    },
  })

  const members = await store.listGroupMembers(ownerId, groupId)

  assert.deepEqual(seenQueries, [
    ['group', { _id: groupId, owner: ownerId }],
    ['members', { group: groupId }],
  ])
  assert.deepEqual(members, [{
    id: String(memberId),
    name: 'Aarav Sharma',
    phone: '555-0101',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  }])
})

test('transaction list limits results to the requesting user’s groups', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const memberId = new mongoose.Types.ObjectId()
  const seenQueries = []
  const store = createDataStore({
    GroupModel: {
      find(filter) {
        seenQueries.push(['groups', filter])
        return query([{ _id: groupId }])
      },
    },
    TransactionModel: {
      find(filter) {
        seenQueries.push(['transactions', filter])
        return query([{
          _id: transactionId,
          group: { _id: groupId, name: 'Garden Circle', currency: 'INR' },
          member: { _id: memberId, name: 'Aarav Sharma' },
          kind: 'contribution',
          amountMinor: 2500,
          note: 'Monthly contribution',
          createdAt: new Date('2026-10-30T12:00:00Z'),
        }])
      },
    },
  })

  const transactions = await store.listTransactions(ownerId)

  assert.deepEqual(seenQueries, [
    ['groups', { owner: ownerId }],
    ['transactions', { group: { $in: [groupId] } }],
  ])
  assert.deepEqual(transactions, [{
    id: String(transactionId),
    group: { id: String(groupId), name: 'Garden Circle', currency: 'INR' },
    member: { id: String(memberId), name: 'Aarav Sharma' },
    kind: 'contribution',
    amountMinor: 2500,
    note: 'Monthly contribution',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  }])
})

test('group transaction list refuses access to a group not owned by the user', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  let transactionQueryCalled = false
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        assert.deepEqual(filter, { _id: groupId, owner: ownerId })
        return query(null)
      },
    },
    TransactionModel: {
      find() {
        transactionQueryCalled = true
        return query([])
      },
    },
  })

  await assert.rejects(store.listTransactions(ownerId, groupId), { status: 404 })
  assert.equal(transactionQueryCalled, false)
})
