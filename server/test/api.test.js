import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import jwt from 'jsonwebtoken'
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
    findOne(query) {
      return {
        select() {
          return {
            lean: async () => query.username
              ? users.get(query.username) ?? null
              : [...users.values()].find((user) => user.googleSub === query.googleSub) ?? null,
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
  const receipts = new Map()
  const receiptKey = (groupId, transactionId) => `${groupId}:${transactionId}`
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
    async deleteTransaction(userId, groupId, transactionId) {
      calls.push(['deleteTransaction', userId, groupId, transactionId])
      const key = receiptKey(groupId, transactionId)
      const receipt = receipts.get(key)?.receipt ?? null
      receipts.delete(key)
      return { id: transactionId, receipt }
    },
    async setTransactionReceipt(userId, groupId, transactionId, receipt) {
      calls.push(['setTransactionReceipt', userId, groupId, transactionId])
      const key = receiptKey(groupId, transactionId)
      const previous = receipts.get(key)?.receipt ?? null
      receipts.set(key, { userId: String(userId), receipt })
      return previous
    },
    async getTransactionReceipt(userId, groupId, transactionId) {
      calls.push(['getTransactionReceipt', userId, groupId, transactionId])
      const stored = receipts.get(receiptKey(groupId, transactionId))
      return stored?.userId === String(userId) ? stored.receipt : null
    },
    async clearTransactionReceipt(userId, groupId, transactionId) {
      calls.push(['clearTransactionReceipt', userId, groupId, transactionId])
      const key = receiptKey(groupId, transactionId)
      const stored = receipts.get(key)
      if (stored?.userId !== String(userId)) return null
      receipts.delete(key)
      return stored.receipt
    },
    ...overrides.dataStore,
  }
  const app = createApp({
    dataStore,
    UserModel: overrides.UserModel ?? createTestUserModel(),
    jwtSecret: 'test-secret-with-more-than-thirty-two-characters',
    ...overrides.appOptions,
  })

  return { app, calls }
}

async function getCsrfToken(agent) {
  const response = await agent.get('/api/auth/session').expect(200)
  return response.body.csrfToken
}

test('protected dashboard reads require a valid JWT', async () => {
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
  await agent
    .delete('/api/groups/507f1f77bcf86cd799439011/transactions/507f1f77bcf86cd799439013')
    .set('X-CSRF-Token', csrfToken)
    .expect(401)
  await agent
    .delete('/api/groups/507f1f77bcf86cd799439011/transactions/507f1f77bcf86cd799439013')
    .set('X-CSRF-Token', csrfToken)
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
  assert.equal(JSON.stringify(registration.body).includes('commonfund.token'), false)
  const cookies = registration.headers['set-cookie']
  assert.ok(cookies.some((cookie) => cookie.startsWith('commonfund.token=') && cookie.includes('HttpOnly')))
  assert.ok(cookies.some((cookie) => cookie.startsWith('commonfund.csrf=') && !cookie.includes('HttpOnly')))

  await agent.get('/api/dashboard').expect(200)
  assert.deepEqual(calls, [['getDashboard', registration.body.user.id]])
})

test('JWT authentication rejects expired and tampered tokens', async () => {
  const { app, calls } = createTestApp()
  const userId = new mongoose.Types.ObjectId().toString()
  const secret = 'test-secret-with-more-than-thirty-two-characters'
  const expiredToken = jwt.sign({}, secret, {
    algorithm: 'HS256',
    audience: 'commonfund-client',
    expiresIn: -1,
    issuer: 'commonfund-api',
    subject: userId,
  })

  await request(app)
    .get('/api/dashboard')
    .set('Cookie', `commonfund.token=${expiredToken}`)
    .expect(401)
  await request(app)
    .get('/api/dashboard')
    .set('Cookie', `commonfund.token=${expiredToken.slice(0, -1)}x`)
    .expect(401)

  assert.deepEqual(calls, [])
})

test('CSRF protection requires the header to match the readable cookie', async () => {
  const { app } = createTestApp()

  await request(app)
    .post('/api/auth/register')
    .set('Cookie', 'commonfund.csrf=cookie-token')
    .set('X-CSRF-Token', 'different-token')
    .send({ username: 'csrf_mismatch', password: 'a-secure-test-password' })
    .expect(403)
})

test('AI transaction note suggestions require authentication, CSRF, and a valid kind', async () => {
  const { app } = createTestApp({
    appOptions: {
      geminiApiKey: 'test-gemini-key',
      transactionNoteGenerator: async () => 'Should not be called',
    },
  })
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)

  await agent
    .post('/api/ai/transaction-note')
    .set('X-CSRF-Token', initialToken)
    .send({ kind: 'contribution' })
    .expect(401)

  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'ai_note_auth', password: 'a-secure-test-password' })
    .expect(201)

  await agent
    .post('/api/ai/transaction-note')
    .send({ kind: 'contribution' })
    .expect(403)
  await agent
    .post('/api/ai/transaction-note')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({ kind: 'refund' })
    .expect(400)
})

test('AI transaction note endpoint only sends transaction kind to the generator', async () => {
  const generatedKinds = []
  const { app } = createTestApp({
    appOptions: {
      geminiApiKey: 'test-gemini-key',
      transactionNoteGenerator: async (kind) => {
        generatedKinds.push(kind)
        return 'Monthly contribution'
      },
    },
  })
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'ai_note_success', password: 'a-secure-test-password' })
    .expect(201)

  const response = await agent
    .post('/api/ai/transaction-note')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({
      kind: 'contribution',
      amountMinor: 125000,
      memberName: 'Private Member',
      note: 'Private note',
    })
    .expect(200)

  assert.deepEqual(response.body, { note: 'Monthly contribution' })
  assert.deepEqual(generatedKinds, ['contribution'])
})

test('AI transaction note endpoint reports when Gemini is not configured', async () => {
  const { app } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'ai_note_unconfigured', password: 'a-secure-test-password' })
    .expect(201)

  await agent
    .post('/api/ai/transaction-note')
    .set('X-CSRF-Token', registration.body.csrfToken)
    .send({ kind: 'payout' })
    .expect(503, { error: 'AI note suggestions are not configured.' })
})

test('Google OAuth creates an account and authenticates it with a JWT cookie', async () => {
  const oauthCalls = []
  const googleOAuthClient = {
    generateAuthUrl(options) {
      oauthCalls.push(['generateAuthUrl', options])
      return 'https://accounts.google.com/o/oauth2/v2/auth'
    },
    async getToken(code) {
      oauthCalls.push(['getToken', code])
      return { tokens: { id_token: 'verified-google-id-token' } }
    },
    async verifyIdToken(options) {
      oauthCalls.push(['verifyIdToken', options])
      return {
        getPayload: () => ({
          sub: 'google-subject-123',
          email: 'person@example.com',
          email_verified: true,
        }),
      }
    },
  }
  const { app } = createTestApp({
    appOptions: {
      googleClientId: 'test-google-client-id',
      googleOAuthClient,
    },
  })
  const agent = request.agent(app)
  const start = await agent.get('/api/auth/google').expect(302)
  const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('commonfund.google-state='))
  const state = stateCookie.split(';', 1)[0].split('=').slice(1).join('=')
  const authOptions = oauthCalls[0][1]

  assert.equal(start.headers.location, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(authOptions.state, state)
  assert.deepEqual(authOptions.scope, ['openid', 'email', 'profile'])
  assert.ok(stateCookie.includes('HttpOnly'))
  assert.ok(stateCookie.includes('SameSite=Lax'))

  const callback = await agent
    .get('/api/auth/google/callback')
    .query({ code: 'google-auth-code', state })
    .redirects(0)
    .expect(303)
  const login = await agent.get('/api/auth/session').expect(200)
  const expectedUsername = `google_${createHash('sha256')
    .update('google-subject-123')
    .digest('hex')
    .slice(0, 24)}`

  assert.equal(callback.headers.location, '/')
  assert.equal(login.body.user.username, expectedUsername)
  assert.ok(callback.headers['set-cookie'].some((cookie) => (
    cookie.startsWith('commonfund.token=') && cookie.includes('HttpOnly')
  )))
  assert.deepEqual(oauthCalls.slice(1), [
    ['getToken', 'google-auth-code'],
    ['verifyIdToken', { idToken: 'verified-google-id-token', audience: 'test-google-client-id' }],
  ])
})

test('Google OAuth rejects a callback with an invalid state', async () => {
  const { app } = createTestApp({
    appOptions: {
      googleClientId: 'test-google-client-id',
      googleOAuthClient: {
        generateAuthUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
      },
    },
  })
  const agent = request.agent(app)
  await agent.get('/api/auth/google').expect(302)
  const response = await agent
    .get('/api/auth/google/callback')
    .query({ code: 'google-auth-code', state: 'attacker-controlled-state' })
    .redirects(0)
    .expect(303)

  assert.equal(response.headers.location, '/?oauthError=state')
  assert.ok(response.headers['set-cookie'].some((cookie) => (
    cookie.startsWith('commonfund.google-state=;')
  )))
})

test('Google OAuth rejects identities without a verified email', async () => {
  const googleOAuthClient = {
    generateAuthUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    async getToken() {
      return { tokens: { id_token: 'unverified-google-id-token' } }
    },
    async verifyIdToken() {
      return {
        getPayload: () => ({
          sub: 'unverified-google-subject',
          email_verified: false,
        }),
      }
    },
  }
  const { app } = createTestApp({
    appOptions: {
      googleClientId: 'test-google-client-id',
      googleOAuthClient,
    },
  })
  const agent = request.agent(app)
  const start = await agent.get('/api/auth/google').expect(302)
  const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('commonfund.google-state='))
  const state = stateCookie.split(';', 1)[0].split('=').slice(1).join('=')
  const callback = await agent
    .get('/api/auth/google/callback')
    .query({ code: 'google-auth-code', state })
    .redirects(0)
    .expect(303)
  const session = await agent.get('/api/auth/session').expect(200)

  assert.equal(callback.headers.location, '/?oauthError=failed')
  assert.equal(session.body.user, null)
})

test('Google OAuth is unavailable until provider credentials are configured', async () => {
  const { app } = createTestApp()

  await request(app)
    .get('/api/auth/google')
    .expect(503, { error: 'Google sign-in is not configured.' })
})

test('authentication rejects passwords longer than the supported maximum', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)
  const longPassword = 'p'.repeat(129)

  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'long_password', password: longPassword })
    .expect(400, { error: 'Password must contain 128 characters or fewer.' })

  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'long_password', password: longPassword })
    .expect(400, { error: 'Password must contain 128 characters or fewer.' })

  assert.deepEqual(calls, [])
})

test('login checks the password and issues a fresh authenticated JWT', async () => {
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

test('transaction DELETE requires CSRF and removes only the requested owned-group transaction', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'transaction_deleter', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const transactionId = new mongoose.Types.ObjectId().toString()
  const path = `/api/groups/${groupId}/transactions/${transactionId}`

  await agent.delete(path).expect(403)

  await agent
    .delete(path)
    .set('X-CSRF-Token', registration.body.csrfToken)
    .expect(204)

  assert.deepEqual(calls, [[
    'deleteTransaction',
    registration.body.user.id,
    groupId,
    transactionId,
  ]])
})

test('transaction DELETE rejects malformed path IDs without writing', async () => {
  const { app, calls } = createTestApp()
  const agent = request.agent(app)
  const initialToken = await getCsrfToken(agent)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'invalid_delete', password: 'a-secure-test-password' })
    .expect(201)
  const csrf = { 'X-CSRF-Token': registration.body.csrfToken }
  const transactionId = new mongoose.Types.ObjectId().toString()

  await agent.delete(`/api/groups/not-an-object-id/transactions/${transactionId}`).set(csrf).expect(400)
  await agent.delete(`/api/groups/${new mongoose.Types.ObjectId()}/transactions/not-an-object-id`).set(csrf).expect(400)
  assert.deepEqual(calls, [])
})

test('transaction receipts require authentication and a CSRF token', async () => {
  const { app } = createTestApp()
  const agent = request.agent(app)
  const csrfToken = await getCsrfToken(agent)
  const path = `/api/groups/${new mongoose.Types.ObjectId()}/transactions/${new mongoose.Types.ObjectId()}/receipt`
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')

  await agent
    .post(path)
    .set('X-CSRF-Token', csrfToken)
    .attach('receipt', png, 'receipt.png')
    .expect(401)
  const registration = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'receipt_owner', password: 'a-secure-test-password' })
    .expect(201)
  await agent.post(path).attach('receipt', png, 'receipt.png').expect(403)

  assert.ok(registration.body.user.id)
})

test('transaction receipt upload validates file content and enforces owner-only downloads', async (t) => {
  const { mkdtemp, readFile, readdir, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const receiptStorageDir = await mkdtemp(join(tmpdir(), 'commonfund-receipts-'))
  t.after(() => rm(receiptStorageDir, { recursive: true, force: true }))

  const { app, calls } = createTestApp({ appOptions: { receiptStorageDir } })
  const owner = request.agent(app)
  const initialToken = await getCsrfToken(owner)
  const registration = await owner
    .post('/api/auth/register')
    .set('X-CSRF-Token', initialToken)
    .send({ username: 'receipt_owner_two', password: 'a-secure-test-password' })
    .expect(201)
  const groupId = new mongoose.Types.ObjectId().toString()
  const transactionId = new mongoose.Types.ObjectId().toString()
  const path = `/api/groups/${groupId}/transactions/${transactionId}/receipt`
  const csrf = { 'X-CSRF-Token': registration.body.csrfToken }
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')

  await owner
    .post(path)
    .set(csrf)
    .expect(400, { error: 'Choose a receipt file to upload.' })
  await owner
    .post(`/api/groups/not-an-id/transactions/${transactionId}/receipt`)
    .set(csrf)
    .attach('receipt', png, 'receipt.png')
    .expect(400, { error: 'Invalid group ID.' })
  await owner
    .post(path)
    .set(csrf)
    .attach('receipt', Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: 'too-large.png',
      contentType: 'image/png',
    })
    .expect(413, { error: 'Receipt files must be 5 MB or smaller.' })

  await owner
    .post(path)
    .set(csrf)
    .attach('receipt', Buffer.from('not a PNG'), { filename: 'spoofed.png', contentType: 'image/png' })
    .expect(400, { error: 'The uploaded file must contain a valid PDF, JPEG, PNG, or WebP receipt.' })

  const uploaded = await owner
    .post(path)
    .set(csrf)
    .attach('receipt', png, { filename: '../October receipt.png', contentType: 'image/png' })
    .expect(201)
  assert.equal(uploaded.body.receipt.fileName, 'October receipt.png')
  assert.equal(uploaded.body.receipt.mimeType, 'image/png')
  assert.equal(uploaded.body.receipt.size, png.length)

  const download = await owner.get(path).expect(200)
  assert.match(download.headers['content-type'], /^image\/png/)
  assert.equal(download.headers['x-content-type-options'], 'nosniff')
  assert.match(download.headers['content-disposition'], /October receipt\.png/)
  assert.deepEqual(download.body, png)

  const otherUser = request.agent(app)
  const otherCsrf = await getCsrfToken(otherUser)
  const otherRegistration = await otherUser
    .post('/api/auth/register')
    .set('X-CSRF-Token', otherCsrf)
    .send({ username: 'receipt_other_user', password: 'a-secure-test-password' })
    .expect(201)
  await otherUser.get(path).expect(404, { error: 'Receipt not found.' })

  const storedFiles = await readdir(receiptStorageDir)
  assert.equal(storedFiles.length, 1)
  assert.deepEqual(calls.slice(-2), [
    ['getTransactionReceipt', registration.body.user.id, groupId, transactionId],
    ['getTransactionReceipt', otherRegistration.body.user.id, groupId, transactionId],
  ])
  assert.equal(await readFile(join(receiptStorageDir, storedFiles[0])).then((buffer) => buffer.equals(png)), true)

  const pdf = Buffer.from('%PDF-1.7\nreceipt\n%%EOF\n')
  const replacement = await owner
    .post(path)
    .set(csrf)
    .attach('receipt', pdf, { filename: 'replacement.pdf', contentType: 'application/pdf' })
    .expect(200)
  assert.equal(replacement.body.receipt.fileName, 'replacement.pdf')
  assert.equal((await readdir(receiptStorageDir)).length, 1)

  await owner.delete(path).set(csrf).expect(204)
  assert.deepEqual(await readdir(receiptStorageDir), [])
  await owner.get(path).expect(404, { error: 'Receipt not found.' })

  await owner
    .post(path)
    .set(csrf)
    .attach('receipt', png, 'before-transaction-delete.png')
    .expect(201)
  await owner
    .delete(`/api/groups/${groupId}/transactions/${transactionId}`)
    .set(csrf)
    .expect(204)
  assert.deepEqual(await readdir(receiptStorageDir), [])
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
