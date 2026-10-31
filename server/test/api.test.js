import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'

function createTestUserModel() {
  const users = new Map()

  return {
    async create(userData) {
      if (users.has(userData.username)) {
        const error = new Error('Duplicate username')
        error.code = 11000
        throw error
      }

      const user = { _id: new mongoose.Types.ObjectId(), ...userData }
      users.set(user.username, user)
      return user
    },
    findOne({ username }) {
      return {
        select() {
          return {
            lean: async () => users.get(username) ?? null,
          }
        },
      }
    },
    findById(id) {
      return {
        select() {
          return {
            lean: async () => [...users.values()].find((user) => String(user._id) === String(id)) ?? null,
          }
        },
      }
    },
  }
}

function createTestApp(overrides = {}) {
  const calls = []
  const dataStore = {
    async listGroups(userId) {
      calls.push(['listGroups', userId])
      return []
    },
    async getDashboard(userId) {
      calls.push(['getDashboard', userId])
      return {
        summary: { activeGroups: 0, activeMembers: 0, contributionsThisMonth: 0, payoutsThisMonth: 0 },
        groups: [],
        members: [],
        activities: [],
        chart: { labels: [], values: [] },
      }
    },
    async listGroupMembers(userId, groupId) {
      calls.push(['listGroupMembers', userId, groupId])
      return []
    },
    async listTransactions(userId, groupId) {
      calls.push(['listTransactions', userId, groupId])
      return []
    },
    async listMembers(userId) {
      calls.push(['listMembers', userId])
      return []
    },
    async createGroup(userId, groupData) {
      calls.push(['createGroup', userId, groupData])
      return { id: 'group-id', ...groupData }
    },
    async createMember(userId, groupId, memberData) {
      calls.push(['createMember', userId, groupId, memberData])
      return { id: 'member-id', group: groupId, ...memberData }
    },
    async createTransaction(userId, groupId, transactionData) {
      calls.push(['createTransaction', userId, groupId, transactionData])
      return { id: 'transaction-id', group: groupId, ...transactionData }
    },
    async updateTransaction(userId, groupId, transactionId, transactionData) {
      calls.push(['updateTransaction', userId, groupId, transactionId, transactionData])
      return { id: transactionId, group: groupId, ...transactionData }
    },
    ...overrides.dataStore,
  }
  const app = createApp({
    dataStore,
    UserModel: createTestUserModel(),
    sessionSecret: 'test-secret-with-more-than-thirty-two-characters',
  })

  return { app, calls }
}

async function getCsrfToken(agent) {
  const response = await agent.get('/api/auth/session').expect(200)
  return response.body.csrfToken
}

test('protected dashboard reads require an authenticated session', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)

  await agent.get('/api/dashboard').expect(401)
  await agent.get('/api/groups').expect(401)
  await agent.get('/api/groups/507f1f77bcf86cd799439011/members').expect(401)
  await agent.get('/api/transactions').expect(401)
  await agent.get('/api/groups/507f1f77bcf86cd799439011/transactions').expect(401)
  await agent
    .post('/api/groups/507f1f77bcf86cd799439011/transactions')
    .set('X-CSRF-Token', csrfToken)
    .send({ memberId: '507f1f77bcf86cd799439012', kind: 'contribution', amountMinor: 1250 })
    .expect(401)
  await agent
    .put('/api/groups/507f1f77bcf86cd799439011/transactions/507f1f77bcf86cd799439013')
    .set('X-CSRF-Token', csrfToken)
    .send({ memberId: '507f1f77bcf86cd799439012', kind: 'contribution', amountMinor: 1250 })
    .expect(401)
  assert.equal(calls.length, 0)
})

test('GET resource endpoints pass the authenticated owner and group to the datastore', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'get_routes', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()

  await agent.get('/api/groups').expect(200, [])
  await agent.get(`/api/groups/${groupId}/members`).expect(200, [])
  await agent.get('/api/transactions').expect(200, [])
  await agent.get(`/api/groups/${groupId}/transactions`).expect(200, [])

  assert.deepEqual(calls, [
    ['listGroups', registration.body.user.id],
    ['listGroupMembers', registration.body.user.id, groupId],
    ['listTransactions', registration.body.user.id, undefined],
    ['listTransactions', registration.body.user.id, groupId],
  ])
})

test('group resource GET endpoints reject malformed IDs', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'invalid_get_id', password: 'a-secure-test-password' })
    .expect(201)

  await agent.get('/api/groups/not-an-object-id/members').expect(400)
  await agent.get('/api/groups/not-an-object-id/transactions').expect(400)
  assert.deepEqual(calls, [])
  assert.ok(registration.body.user.id)
})

test('registration authenticates and dashboard reads are scoped to that user', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)

  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'Shyam_01', password: 'a-secure-test-password' })
    .expect(201)

  assert.equal(registration.body.user.username, 'shyam_01')
  assert.equal(registration.body.csrfToken.length, 64)

  await agent.get('/api/dashboard').expect(200)
  assert.deepEqual(calls, [['getDashboard', registration.body.user.id]])
})

test('login checks the password and creates a fresh authenticated session', async () => {
  const { app } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'login_user', password: 'a-secure-test-password' })
    .expect(201)

  await agent
    .post('/api/auth/logout')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .expect(204)

  const loginToken = await getCsrfToken(agent)
  const login = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', loginToken)
    .send({ username: 'LOGIN_USER', password: 'a-secure-test-password' })
    .expect(200)

  assert.equal(login.body.user.username, 'login_user')
  assert.notEqual(login.body.csrfToken, loginToken)
  await agent.get('/api/auth/session').expect(200)
})

test('group creation validates CSRF and writes only with the session owner', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'member_one', password: 'a-secure-test-password' })
    .expect(201)

  await agent
    .post('/api/groups')
    .send({ name: 'No token' })
    .expect(403)

  const created = await agent
    .post('/api/groups')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({ name: '  Garden Circle  ', currency: 'inr', owner: 'forged-owner' })
    .expect(201)

  assert.deepEqual(created.body.group, {
    id: 'group-id',
    name: 'Garden Circle',
    currency: 'INR',
  })
  assert.deepEqual(calls, [[
    'createGroup',
    registration.body.user.id,
    { name: 'Garden Circle', currency: 'INR' },
  ]])
})

test('transaction creation requires CSRF and uses authenticated group and member data', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'transaction_writer', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const memberId = new mongoose.Types.ObjectId().toString()
  const body = {
    memberId,
    kind: 'contribution',
    amountMinor: 1250,
    note: ' October contribution ',
    group: 'forged-group',
    createdBy: 'forged-user',
  }

  await agent.post(`/api/groups/${groupId}/transactions`).send(body).expect(403)

  const created = await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send(body)
    .expect(201)

  assert.deepEqual(created.body.transaction, {
    id: 'transaction-id',
    group: groupId,
    memberId,
    kind: 'contribution',
    amountMinor: 1250,
    note: 'October contribution',
  })
  assert.deepEqual(calls, [[
    'createTransaction',
    registration.body.user.id,
    groupId,
    { memberId, kind: 'contribution', amountMinor: 1250, note: 'October contribution' },
  ]])
})

test('transaction endpoint rejects invalid IDs, kinds, amounts, and notes before writing', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'invalid_transaction', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const memberId = new mongoose.Types.ObjectId().toString()
  const csrf = { 'X-CSRF-Token': registration.body.csrfToken }

  await agent
    .post('/api/groups/not-an-object-id/transactions')
    .set(csrf)
    .send({ memberId, kind: 'payout', amountMinor: 100 })
    .expect(400)
  await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set(csrf)
    .send({ memberId: 'not-an-object-id', kind: 'payout', amountMinor: 100 })
    .expect(400)
  await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set(csrf)
    .send({ memberId, kind: 'refund', amountMinor: 100 })
    .expect(400)
  await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set(csrf)
    .send({ memberId, kind: 'payout', amountMinor: '100' })
    .expect(400)
  await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set(csrf)
    .send({ memberId, kind: 'payout', amountMinor: 0 })
    .expect(400)
  await agent
    .post(`/api/groups/${groupId}/transactions`)
    .set(csrf)
    .send({ memberId, kind: 'payout', amountMinor: 100, note: 'x'.repeat(201) })
    .expect(400)

  assert.deepEqual(calls, [])
})

test('transaction PUT validates CSRF and sends only the replacement fields', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'transaction_editor', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const transactionId = new mongoose.Types.ObjectId().toString()
  const memberId = new mongoose.Types.ObjectId().toString()
  const path = `/api/groups/${groupId}/transactions/${transactionId}`
  const body = {
    memberId,
    kind: 'payout',
    amountMinor: 3000,
    note: ' Updated payout ',
    createdBy: 'forged-user',
  }

  await agent.put(path).send(body).expect(403)

  const updated = await agent
    .put(path)
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send(body)
    .expect(200)

  assert.deepEqual(updated.body.transaction, {
    id: transactionId,
    group: groupId,
    memberId,
    kind: 'payout',
    amountMinor: 3000,
    note: 'Updated payout',
  })
  assert.deepEqual(calls, [[
    'updateTransaction',
    registration.body.user.id,
    groupId,
    transactionId,
    { memberId, kind: 'payout', amountMinor: 3000, note: 'Updated payout' },
  ]])
})

test('transaction PUT rejects malformed path IDs and invalid replacement data', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'invalid_update', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const transactionId = new mongoose.Types.ObjectId().toString()
  const memberId = new mongoose.Types.ObjectId().toString()
  const csrf = { 'X-CSRF-Token': registration.body.csrfToken }
  const body = { memberId, kind: 'contribution', amountMinor: 1000 }

  await agent
    .put(`/api/groups/not-an-object-id/transactions/${transactionId}`)
    .set(csrf)
    .send(body)
    .expect(400)
  await agent
    .put(`/api/groups/${groupId}/transactions/not-an-object-id`)
    .set(csrf)
    .send(body)
    .expect(400)
  await agent
    .put(`/api/groups/${groupId}/transactions/${transactionId}`)
    .set(csrf)
    .send({ ...body, amountMinor: 0 })
    .expect(400)

  assert.deepEqual(calls, [])
})

test('invalid API inputs return client errors without writing', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'member_two', password: 'a-secure-test-password' })
    .expect(201)

  await agent
    .post('/api/groups')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({ name: 'Circle', currency: 'US dollars' })
    .expect(400)

  await agent
    .post(`/api/groups/${new mongoose.Types.ObjectId()}/members`)
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({ name: 'A member' })
    .expect(201)

  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'createMember')
  assert.equal(calls[0][1], registration.body.user.id)
})
