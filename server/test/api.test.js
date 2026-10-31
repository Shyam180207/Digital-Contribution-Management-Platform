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
    async createGroup(userId, groupData) {
      calls.push(['createGroup', userId, groupData])
      return { id: 'group-id', ...groupData }
    },
    async createMember(userId, groupId, memberData) {
      calls.push(['createMember', userId, groupId, memberData])
      return { id: 'member-id', group: groupId, ...memberData }
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

  await request(app).get('/api/dashboard').expect(401)
  assert.equal(calls.length, 0)
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
