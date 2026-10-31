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
          group: { _id: groupId, name: group.name },
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
          member: { _id: userMember, name: 'Aarav Sharma' },
          group: { _id: groupId, name: group.name, currency: group.currency },
          kind: 'contribution',
          amountMinor: 2500,
          note: 'Monthly contribution',
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
  assert.equal(dashboard.members[0].groupId, String(groupId))
  assert.equal(dashboard.activities[0].amountMinor, 2500)
  assert.equal(dashboard.activities[0].groupId, String(groupId))
  assert.equal(dashboard.activities[0].memberId, String(userMember))
  assert.equal(dashboard.activities[0].note, 'Monthly contribution')
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
          receipt: null,
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
    receipt: null,
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

test('transaction creation verifies group and member ownership before writing', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const memberId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const seenQueries = []
  const createdTransaction = {
    _id: transactionId,
    kind: 'payout',
    amountMinor: 1250,
    note: 'Monthly payout',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  }
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        seenQueries.push(['group', filter])
        return query({
          _id: groupId,
          name: 'Garden Circle',
          currency: 'INR',
        })
      },
    },
    MemberModel: {
      findOne(filter) {
        seenQueries.push(['member', filter])
        return query({ _id: memberId, name: 'Aarav Sharma' })
      },
    },
    TransactionModel: {
      async create(data) {
        seenQueries.push(['create', data])
        return createdTransaction
      },
    },
  })

  const transaction = await store.createTransaction(ownerId, groupId, {
    memberId,
    kind: 'payout',
    amountMinor: 1250,
    note: 'Monthly payout',
  })

  assert.deepEqual(seenQueries, [
    ['group', { _id: groupId, owner: ownerId }],
    ['member', { _id: memberId, group: groupId }],
    ['create', {
      group: groupId,
      member: memberId,
      createdBy: ownerId,
      kind: 'payout',
      amountMinor: 1250,
      note: 'Monthly payout',
    }],
  ])
  assert.deepEqual(transaction, {
    id: String(transactionId),
    group: { id: String(groupId), name: 'Garden Circle', currency: 'INR' },
    member: { id: String(memberId), name: 'Aarav Sharma' },
    kind: 'payout',
    amountMinor: 1250,
    note: 'Monthly payout',
    createdAt: createdTransaction.createdAt,
  })
})

test('transaction creation rejects groups not owned by the user', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  let memberQueryCalled = false
  const store = createDataStore({
    GroupModel: { findOne: () => query(null) },
    MemberModel: {
      findOne() {
        memberQueryCalled = true
        return query(null)
      },
    },
    TransactionModel: { create: async () => assert.fail('must not create a transaction') },
  })

  await assert.rejects(
    store.createTransaction(ownerId, groupId, {
      memberId: new mongoose.Types.ObjectId(),
      kind: 'contribution',
      amountMinor: 1250,
      note: null,
    }),
    { status: 404 },
  )
  assert.equal(memberQueryCalled, false)
})

test('transaction creation rejects a member from another group', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  let transactionCreateCalled = false
  const store = createDataStore({
    GroupModel: {
      findOne: () => query({ _id: groupId, name: 'Garden Circle', currency: 'INR' }),
    },
    MemberModel: { findOne: () => query(null) },
    TransactionModel: {
      async create() {
        transactionCreateCalled = true
      },
    },
  })

  await assert.rejects(
    store.createTransaction(ownerId, groupId, {
      memberId: new mongoose.Types.ObjectId(),
      kind: 'contribution',
      amountMinor: 1250,
      note: null,
    }),
    { status: 404 },
  )
  assert.equal(transactionCreateCalled, false)
})

test('transaction update scopes the write to an owned group and applies validated fields', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const memberId = new mongoose.Types.ObjectId()
  const seenQueries = []
  const updatedTransaction = {
    _id: transactionId,
    kind: 'payout',
    amountMinor: 3000,
    note: 'Updated payout',
    createdAt: new Date('2026-10-30T12:00:00Z'),
  }
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        seenQueries.push(['group', filter])
        return query({
          _id: groupId,
          name: 'Garden Circle',
          currency: 'INR',
        })
      },
    },
    MemberModel: {
      findOne(filter) {
        seenQueries.push(['member', filter])
        return query({ _id: memberId, name: 'Aarav Sharma' })
      },
    },
    TransactionModel: {
      findOneAndUpdate(filter, update, options) {
        seenQueries.push(['update', filter, update, options])
        return query(updatedTransaction)
      },
    },
  })

  const transaction = await store.updateTransaction(ownerId, groupId, transactionId, {
    memberId,
    kind: 'payout',
    amountMinor: 3000,
    note: 'Updated payout',
  })

  assert.deepEqual(seenQueries, [
    ['group', { _id: groupId, owner: ownerId }],
    ['member', { _id: memberId, group: groupId }],
    ['update', { _id: transactionId, group: groupId }, {
      $set: {
        member: memberId,
        kind: 'payout',
        amountMinor: 3000,
        note: 'Updated payout',
      },
    }, { new: true, runValidators: true }],
  ])
  assert.deepEqual(transaction, {
    id: String(transactionId),
    group: { id: String(groupId), name: 'Garden Circle', currency: 'INR' },
    member: { id: String(memberId), name: 'Aarav Sharma' },
    kind: 'payout',
    amountMinor: 3000,
    note: 'Updated payout',
    createdAt: updatedTransaction.createdAt,
  })
})

test('transaction update refuses a transaction outside the owned group', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const memberId = new mongoose.Types.ObjectId()
  let transactionUpdateCalled = false
  const store = createDataStore({
    GroupModel: {
      findOne: () => query({ _id: groupId, name: 'Garden Circle', currency: 'INR' }),
    },
    MemberModel: { findOne: () => query({ _id: memberId, name: 'Aarav Sharma' }) },
    TransactionModel: {
      findOneAndUpdate(filter) {
        assert.deepEqual(filter, { _id: transactionId, group: groupId })
        transactionUpdateCalled = true
        return query(null)
      },
    },
  })

  await assert.rejects(
    store.updateTransaction(ownerId, groupId, transactionId, {
      memberId,
      kind: 'contribution',
      amountMinor: 1250,
      note: null,
    }),
    { status: 404 },
  )
  assert.equal(transactionUpdateCalled, true)
})

test('transaction update rejects members from a different group before writing', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  let transactionUpdateCalled = false
  const store = createDataStore({
    GroupModel: {
      findOne: () => query({ _id: groupId, name: 'Garden Circle', currency: 'INR' }),
    },
    MemberModel: { findOne: () => query(null) },
    TransactionModel: {
      findOneAndUpdate() {
        transactionUpdateCalled = true
        return query(null)
      },
    },
  })

  await assert.rejects(
    store.updateTransaction(ownerId, groupId, transactionId, {
      memberId: new mongoose.Types.ObjectId(),
      kind: 'contribution',
      amountMinor: 1250,
      note: null,
    }),
    { status: 404 },
  )
  assert.equal(transactionUpdateCalled, false)
})

test('transaction deletion requires group ownership and deletes by both IDs', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const seenQueries = []
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        seenQueries.push(['group', filter])
        return query({ _id: groupId })
      },
    },
    TransactionModel: {
      findOneAndDelete(filter) {
        seenQueries.push(['delete', filter])
        return query({ _id: transactionId })
      },
    },
  })

  assert.deepEqual(await store.deleteTransaction(ownerId, groupId, transactionId), {
    id: String(transactionId),
  })
  assert.deepEqual(seenQueries, [
    ['group', { _id: groupId, owner: ownerId }],
    ['delete', { _id: transactionId, group: groupId }],
  ])
})

test('transaction deletion does not delete records from groups the user does not own', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  let transactionDeleteCalled = false
  const store = createDataStore({
    GroupModel: { findOne: () => query(null) },
    TransactionModel: {
      findOneAndDelete() {
        transactionDeleteCalled = true
        return query(null)
      },
    },
  })

  await assert.rejects(
    store.deleteTransaction(ownerId, groupId, transactionId),
    { status: 404 },
  )
  assert.equal(transactionDeleteCalled, false)
})

test('receipt reads and updates are scoped through the owned group and transaction', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  const transactionId = new mongoose.Types.ObjectId()
  const previousReceipt = { storageKey: 'old-key.png', originalName: 'old.png' }
  const receipt = { storageKey: 'new-key.pdf', originalName: 'new.pdf' }
  const seenQueries = []
  const store = createDataStore({
    GroupModel: {
      findOne(filter) {
        seenQueries.push(['group', filter])
        return query({ _id: groupId })
      },
    },
    TransactionModel: {
      findOneAndUpdate(filter, update, options) {
        seenQueries.push(['update', filter, update, options])
        return query({ receipt: previousReceipt })
      },
      findOne(filter) {
        seenQueries.push(['findReceipt', filter])
        return query({ receipt })
      },
    },
  })

  assert.deepEqual(
    await store.setTransactionReceipt(ownerId, groupId, transactionId, receipt),
    previousReceipt,
  )
  assert.deepEqual(
    await store.getTransactionReceipt(ownerId, groupId, transactionId),
    receipt,
  )
  assert.deepEqual(
    await store.clearTransactionReceipt(ownerId, groupId, transactionId),
    previousReceipt,
  )
  assert.deepEqual(seenQueries, [
    ['group', { _id: groupId, owner: ownerId }],
    ['update', { _id: transactionId, group: groupId }, { $set: { receipt } }, { new: false, runValidators: true }],
    ['group', { _id: groupId, owner: ownerId }],
    ['findReceipt', { _id: transactionId, group: groupId }],
    ['group', { _id: groupId, owner: ownerId }],
    ['update', { _id: transactionId, group: groupId }, { $unset: { receipt: 1 } }, { new: false }],
  ])
})

test('receipt operations refuse groups not owned by the requesting user', async () => {
  const ownerId = new mongoose.Types.ObjectId()
  const groupId = new mongoose.Types.ObjectId()
  let transactionQueryCalled = false
  const store = createDataStore({
    GroupModel: { findOne: () => query(null) },
    TransactionModel: {
      findOneAndUpdate() {
        transactionQueryCalled = true
        return query(null)
      },
      findOne() {
        transactionQueryCalled = true
        return query(null)
      },
    },
  })

  await assert.rejects(
    store.getTransactionReceipt(ownerId, groupId, new mongoose.Types.ObjectId()),
    { status: 404 },
  )
  await assert.rejects(
    store.setTransactionReceipt(ownerId, groupId, new mongoose.Types.ObjectId(), {}),
    { status: 404 },
  )
  assert.equal(transactionQueryCalled, false)
})
