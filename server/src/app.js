import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import cookieParser from 'cookie-parser'
import express from 'express'
import { OAuth2Client } from 'google-auth-library'
import mongoose from 'mongoose'
import { createDataStore } from './dataStore.js'
import { HttpError } from './httpError.js'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  accessTokenLifetimeSeconds,
  createAccessToken,
  isInvalidAccessTokenError,
  verifyAccessToken,
} from './tokens.js'
import User from '../models/User.js'

const usernamePattern = /^[a-z0-9_.-]{3,40}$/
const passwordMinimumLength = 10
const passwordMaximumLength = 128
const accessTokenCookie = 'commonfund.token'
const csrfCookie = 'commonfund.csrf'
const googleStateCookie = 'commonfund.google-state'
const googleStateLifetimeSeconds = 10 * 60

function cookieOptions(secure) {
  return { path: '/', sameSite: 'lax', secure }
}

function googleStateCookieOptions(secure) {
  return {
    ...cookieOptions(secure),
    httpOnly: true,
    maxAge: googleStateLifetimeSeconds * 1000,
    path: '/api/auth/google',
  }
}

function googleUsername(subject) {
  const suffix = createHash('sha256').update(subject).digest('hex').slice(0, 24)
  return `google_${suffix}`
}

function googleRedirect(res, clientOrigin, status) {
  const redirectUrl = new URL(clientOrigin || '/', clientOrigin || 'http://localhost')
  redirectUrl.searchParams.set('oauthError', status)
  return res.redirect(303, clientOrigin ? redirectUrl.toString() : `/?oauthError=${status}`)
}

async function findOrCreateGoogleUser(UserModel, subject) {
  const existingUser = await UserModel.findOne({ googleSub: subject }).select('username').lean()
  if (existingUser) return existingUser

  try {
    return await UserModel.create({
      username: googleUsername(subject),
      googleSub: subject,
    })
  } catch (error) {
    if (error?.code !== 11000) throw error
    const userCreatedConcurrently = await UserModel.findOne({ googleSub: subject }).select('username').lean()
    if (userCreatedConcurrently) return userCreatedConcurrently
    throw error
  }
}

function clearAuthenticationCookies(res, secure) {
  res.clearCookie(accessTokenCookie, { ...cookieOptions(secure), httpOnly: true })
  res.clearCookie(csrfCookie, cookieOptions(secure))
}

function setAuthenticationCookies(res, userId, csrfToken, secret, secure) {
  res.cookie(accessTokenCookie, createAccessToken(userId, secret), {
    ...cookieOptions(secure),
    httpOnly: true,
    maxAge: accessTokenLifetimeSeconds * 1000,
  })
  res.cookie(csrfCookie, csrfToken, {
    ...cookieOptions(secure),
    maxAge: accessTokenLifetimeSeconds * 1000,
  })
}

function setCsrfCookie(res, csrfToken, secure) {
  res.cookie(csrfCookie, csrfToken, {
    ...cookieOptions(secure),
    maxAge: accessTokenLifetimeSeconds * 1000,
  })
}

function csrfMatches(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length
    && timingSafeEqual(expectedBuffer, actualBuffer)
}

function requireCsrf(req, res, next) {
  if (!csrfMatches(req.cookies[csrfCookie], req.get('x-csrf-token'))) {
    return res.status(403).json({ error: 'Your CSRF token is missing or expired. Refresh and try again.' })
  }
  return next()
}

function requireAuthentication(secret, secureCookies) {
  return (req, res, next) => {
    const token = req.cookies[accessTokenCookie]
    if (!token) {
      return res.status(401).json({ error: 'Please sign in to continue.' })
    }

    try {
      const payload = verifyAccessToken(token, secret)
      if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
        return res.status(401).json({ error: 'Please sign in to continue.' })
      }
      req.userId = payload.sub
      return next()
    } catch (error) {
      if (isInvalidAccessTokenError(error)) {
        clearAuthenticationCookies(res, secureCookies)
        return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' })
      }
      return next(error)
    }
  }
}

function newCsrfToken() {
  return randomBytes(32).toString('hex')
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
  jwtSecret = process.env.JWT_SECRET,
  clientOrigin = process.env.CLIENT_ORIGIN,
  secureCookies = process.env.NODE_ENV === 'production',
  googleClientId = process.env.GOOGLE_CLIENT_ID,
  googleClientSecret = process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri = process.env.GOOGLE_REDIRECT_URI,
  googleOAuthClient,
} = {}) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.')
  }

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  const requireAuth = requireAuthentication(jwtSecret, secureCookies)
  const oauthClient = googleOAuthClient ?? (
    googleClientId && googleClientSecret && googleRedirectUri
      ? new OAuth2Client(googleClientId, googleClientSecret, googleRedirectUri)
      : null
  )

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (clientOrigin) {
      res.set('Access-Control-Allow-Origin', clientOrigin)
      res.set('Access-Control-Allow-Credentials', 'true')
      res.set('Vary', 'Origin')
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

  app.get('/api/auth/session', async (req, res) => {
    const csrfToken = req.cookies[csrfCookie] || newCsrfToken()
    if (!req.cookies[csrfCookie]) setCsrfCookie(res, csrfToken, secureCookies)

    const token = req.cookies[accessTokenCookie]
    if (!token) return res.json({ user: null, csrfToken })

    let payload
    try {
      payload = verifyAccessToken(token, jwtSecret)
    } catch (error) {
      if (!isInvalidAccessTokenError(error)) throw error
      clearAuthenticationCookies(res, secureCookies)
      const newToken = newCsrfToken()
      setCsrfCookie(res, newToken, secureCookies)
      return res.json({ user: null, csrfToken: newToken })
    }

    if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      clearAuthenticationCookies(res, secureCookies)
      const newToken = newCsrfToken()
      setCsrfCookie(res, newToken, secureCookies)
      return res.json({ user: null, csrfToken: newToken })
    }

    const user = await UserModel.findById(payload.sub).select('username').lean()
    if (!user) {
      clearAuthenticationCookies(res, secureCookies)
      const newToken = newCsrfToken()
      setCsrfCookie(res, newToken, secureCookies)
      return res.json({ user: null, csrfToken: newToken })
    }

    return res.json({ user: serializeUser(user), csrfToken })
  })

  app.get('/api/auth/google', (req, res) => {
    if (!oauthClient || !googleClientId) {
      return res.status(503).json({ error: 'Google sign-in is not configured.' })
    }

    const state = randomBytes(32).toString('base64url')
    res.cookie(googleStateCookie, state, googleStateCookieOptions(secureCookies))
    return res.redirect(oauthClient.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      response_type: 'code',
      scope: ['openid', 'email', 'profile'],
      state,
    }))
  })

  app.get('/api/auth/google/callback', async (req, res) => {
    const state = req.query.state
    const cookieState = req.cookies[googleStateCookie]
    res.clearCookie(googleStateCookie, googleStateCookieOptions(secureCookies))

    if (typeof state !== 'string' || !csrfMatches(cookieState, state)) {
      return googleRedirect(res, clientOrigin, 'state')
    }
    if (req.query.error === 'access_denied') {
      return googleRedirect(res, clientOrigin, 'cancelled')
    }
    if (typeof req.query.code !== 'string' || !oauthClient || !googleClientId) {
      return googleRedirect(res, clientOrigin, 'failed')
    }

    let payload
    try {
      const { tokens } = await oauthClient.getToken(req.query.code)
      if (typeof tokens.id_token !== 'string') {
        throw new Error('Google OAuth token response did not include an ID token.')
      }
      const ticket = await oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: googleClientId,
      })
      payload = ticket.getPayload()
    } catch (error) {
      console.error('Google OAuth token verification failed:', error)
      return googleRedirect(res, clientOrigin, 'failed')
    }

    if (
      typeof payload?.sub !== 'string'
      || payload.sub.length === 0
      || payload.sub.length > 255
      || payload.email_verified !== true
    ) {
      return googleRedirect(res, clientOrigin, 'failed')
    }

    const user = await findOrCreateGoogleUser(UserModel, payload.sub)
    const csrfToken = newCsrfToken()
    setAuthenticationCookies(res, user._id, csrfToken, jwtSecret, secureCookies)
    return res.redirect(303, clientOrigin || '/')
  })

  app.post('/api/auth/register', requireCsrf, async (req, res) => {
    const body = req.body ?? {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!usernamePattern.test(username)) throw new HttpError(400, 'Username must be 3-40 letters, numbers, dots, dashes, or underscores.')
    if (password.length < passwordMinimumLength) throw new HttpError(400, `Password must contain at least ${passwordMinimumLength} characters.`)
    if (password.length > passwordMaximumLength) throw new HttpError(400, `Password must contain ${passwordMaximumLength} characters or fewer.`)

    const user = await UserModel.create({
      username,
      passwordHash: await hashPassword(password),
    })
    const csrfToken = newCsrfToken()
    setAuthenticationCookies(res, user._id, csrfToken, jwtSecret, secureCookies)
    return res.status(201).json({ user: serializeUser(user), csrfToken })
  })

  app.post('/api/auth/login', requireCsrf, async (req, res) => {
    const body = req.body ?? {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!username || !password) throw new HttpError(400, 'Enter your username and password.')
    if (password.length > passwordMaximumLength) throw new HttpError(400, `Password must contain ${passwordMaximumLength} characters or fewer.`)

    const user = await UserModel.findOne({ username }).select('+passwordHash').lean()
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Username or password is incorrect.')
    }

    const csrfToken = newCsrfToken()
    setAuthenticationCookies(res, user._id, csrfToken, jwtSecret, secureCookies)
    return res.json({ user: serializeUser(user), csrfToken })
  })

  app.post('/api/auth/logout', requireCsrf, requireAuth, (req, res) => {
    clearAuthenticationCookies(res, secureCookies)
    return res.sendStatus(204)
  })

  app.get('/api/dashboard', requireAuth, async (req, res) => {
    return res.json(await dataStore.getDashboard(req.userId))
  })

  app.get('/api/groups', requireAuth, async (req, res) => {
    return res.json(await dataStore.listGroups(req.userId))
  })

  app.get('/api/members', requireAuth, async (req, res) => {
    return res.json(await dataStore.listMembers(req.userId))
  })

  app.get('/api/groups/:groupId/members', requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    return res.json(await dataStore.listGroupMembers(req.userId, req.params.groupId))
  })

  app.get('/api/transactions', requireAuth, async (req, res) => {
    return res.json(await dataStore.listTransactions(req.userId))
  })

  app.get('/api/groups/:groupId/transactions', requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    return res.json(await dataStore.listTransactions(req.userId, req.params.groupId))
  })

  app.post('/api/groups', requireCsrf, requireAuth, async (req, res) => {
    const group = await dataStore.createGroup(
      req.userId,
      validateGroupInput(req.body ?? {}),
    )
    return res.status(201).json({ group })
  })

  app.post('/api/groups/:groupId/members', requireCsrf, requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    const member = await dataStore.createMember(
      req.userId,
      req.params.groupId,
      validateMemberInput(req.body ?? {}),
    )
    return res.status(201).json({ member })
  })

  app.post('/api/groups/:groupId/transactions', requireCsrf, requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    const transaction = await dataStore.createTransaction(
      req.userId,
      req.params.groupId,
      validateTransactionInput(req.body ?? {}),
    )
    return res.status(201).json({ transaction })
  })

  app.put('/api/groups/:groupId/transactions/:transactionId', requireCsrf, requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    if (!mongoose.isValidObjectId(req.params.transactionId)) throw new HttpError(400, 'Invalid transaction ID.')
    const transaction = await dataStore.updateTransaction(
      req.userId,
      req.params.groupId,
      req.params.transactionId,
      validateTransactionInput(req.body ?? {}),
    )
    return res.json({ transaction })
  })

  app.delete('/api/groups/:groupId/transactions/:transactionId', requireCsrf, requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID.')
    if (!mongoose.isValidObjectId(req.params.transactionId)) throw new HttpError(400, 'Invalid transaction ID.')
    await dataStore.deleteTransaction(
      req.userId,
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
