import { randomBytes, timingSafeEqual } from 'node:crypto'
import express from 'express'
import session from 'express-session'
import mongoose from 'mongoose'
import { createDataStore } from './dataStore.js'
import { HttpError } from './httpError.js'
import { hashPassword, verifyPassword } from './passwords.js'
import User from '../models/User.js'

const usernamePattern = /^[a-z0-9_.-]{3,40}$/
const passwordMinimumLength = 10

function csrfMatches(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer)
}

function requireCsrf(req, res, next) {
  if (!csrfMatches(req.session.csrfToken, req.get('x-csrf-token'))) {
    return res.status(403).json({ error: 'Your session token is missing or expired. Refresh and try again.' })
  }
  return next()
}

function requireAuthentication(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please sign in to continue.' })
  }
  return next()
}

function regenerateSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error)
      req.session.userId = String(userId)
      req.session.csrfToken = randomBytes(32).toString('hex')
      req.session.save((saveError) => {
        if (saveError) return reject(saveError)
        return resolve(req.session.csrfToken)
      })
    })
  })
}

function serializeUser(user) {
  return { id: String(user._id), username: user.username }
}

function validateGroupInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'USD'

  if (!name || name.length > 80) throw new HttpError(400, 'Group name is required and must be 80 characters or fewer.')
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'Currency must be a three-letter code.')

  return { name, currency }
}

function validateMemberInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (!name || name.length > 100) throw new HttpError(400, 'Member name is required and must be 100 characters or fewer.')
  if (phone.length > 40) throw new HttpError(400, 'Phone number must be 40 characters or fewer.')

  return { name, phone: phone || null }
}

function validateTransactionInput(body) {
  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : ''
  const kind = body.kind
  const amountMinor = body.amountMinor
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!mongoose.isValidObjectId(memberId)) throw new HttpError(400, 'A valid member ID is required.')
  if (kind !== 'contribution' && kind !== 'payout') {
    throw new HttpError(400, 'Transaction kind must be contribution or payout.')
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 99_999_999_999) {
    throw new HttpError(400, 'Amount must be a positive safe integer in minor currency units.')
  }
  if (note.length > 200) throw new HttpError(400, 'Transaction note must be 200 characters or fewer.')

  return { memberId, kind, amountMinor, note: note || null }
}

export function createApp({
  dataStore = createDataStore(),
  UserModel = User,
  sessionStore,
  sessionSecret = process.env.SESSION_SECRET,
  clientOrigin = process.env.CLIENT_ORIGIN,
} = {}) {
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.')
  }

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use(session({
    name: 'commonfund.sid',
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }))

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (clientOrigin) {
      res.set('Access-Control-Allow-Origin', clientOrigin)
      res.set('Access-Control-Allow-Credentials', 'true')
      res.set('Vary', 'Origin')
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    return next()
  })

  app.get('/api/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1
    return res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'database unavailable',
    })
  })

  app.get('/api/auth/session', async (req, res, next) => {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex')

    if (!req.session.userId) {
      return res.json({ user: null, csrfToken: req.session.csrfToken })
    }

    const user = await UserModel.findById(req.session.userId).select('username').lean()
    if (!user) {
      delete req.session.userId
      return res.json({ user: null, csrfToken: req.session.csrfToken })
    }

    return res.json({ user: serializeUser(user), csrfToken: req.session.csrfToken })
  })

  app.post('/api/auth/register', requireCsrf, async (req, res) => {
    const body = req.body ?? {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!usernamePattern.test(username)) throw new HttpError(400, 'Username must be 3-40 letters, numbers, dots, dashes, or underscores.')
    if (password.length < passwordMinimumLength) throw new HttpError(400, `Password must contain at least ${passwordMinimumLength} characters.`)

    const user = await UserModel.create({
      username,
      passwordHash: await hashPassword(password),
    })
    const csrfToken = await regenerateSession(req, user._id)
    return res.status(201).json({ user: serializeUser(user), csrfToken })
  })

  app.post('/api/auth/login', requireCsrf, async (req, res) => {
    const body = req.body ?? {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!username || !password) throw new HttpError(400, 'Enter your username and password.')

    const user = await UserModel.findOne({ username }).select('+passwordHash').lean()
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Username or password is incorrect.')
    }

    const csrfToken = await regenerateSession(req, user._id)
    return res.json({ user: serializeUser(user), csrfToken })
  })

  app.post('/api/auth/logout', requireCsrf, requireAuthentication, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie('commonfund.sid', { httpOnly: true, sameSite: 'lax' })
      return res.sendStatus(204)
    })
  })

  app.get('/api/dashboard', requireAuthentication, async (req, res) => {
    return res.json(await dataStore.getDashboard(req.session.userId))
  })

  app.get('/api/groups', requireAuthentication, async (req, res) => {
    return res.json(await dataStore.listGroups(req.session.userId))
  })

  app.get('/api/members', requireAuthentication, async (req, res) => {
    return res.json(await dataStore.listMembers(req.session.userId))
  })

  app.get('/api/groups/:groupId/members', requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    return res.json(await dataStore.listGroupMembers(req.session.userId, req.params.groupId))
  })

  app.get('/api/transactions', requireAuthentication, async (req, res) => {
    return res.json(await dataStore.listTransactions(req.session.userId))
  })

  app.get('/api/groups/:groupId/transactions', requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    return res.json(await dataStore.listTransactions(req.session.userId, req.params.groupId))
  })

  app.post('/api/groups', requireCsrf, requireAuthentication, async (req, res) => {
    const group = await dataStore.createGroup(
      req.session.userId,
      validateGroupInput(req.body ?? {}),
    )
    return res.status(201).json({ group })
  })

  app.post('/api/groups/:groupId/members', requireCsrf, requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    const member = await dataStore.createMember(
      req.session.userId,
      req.params.groupId,
      validateMemberInput(req.body ?? {}),
    )
    return res.status(201).json({ member })
  })

  app.post('/api/groups/:groupId/transactions', requireCsrf, requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    const transaction = await dataStore.createTransaction(
      req.session.userId,
      req.params.groupId,
      validateTransactionInput(req.body ?? {}),
    )
    return res.status(201).json({ transaction })
  })

  app.put('/api/groups/:groupId/transactions/:transactionId', requireCsrf, requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    if (!mongoose.isValidObjectId(req.params.transactionId)) throw new HttpError(400, 'Invalid transaction ID.')
    const transaction = await dataStore.updateTransaction(
      req.session.userId,
      req.params.groupId,
      req.params.transactionId,
      validateTransactionInput(req.body ?? {}),
    )
    return res.json({ transaction })
  })

  app.delete('/api/groups/:groupId/transactions/:transactionId', requireCsrf, requireAuthentication, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    if (!mongoose.isValidObjectId(req.params.transactionId)) throw new HttpError(400, 'Invalid transaction ID.')
    await dataStore.deleteTransaction(
      req.session.userId,
      req.params.groupId,
      req.params.transactionId,
    )
    return res.sendStatus(204)
  })

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message })
    }
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: 'The submitted data is invalid.' })
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'The request body must contain valid JSON.' })
    }
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'That username is already registered.' })
    }

    console.error('CommonFund API request failed:', error)
    return res.status(500).json({ error: 'The request could not be completed. Please try again.' })
  })

  return app
}
