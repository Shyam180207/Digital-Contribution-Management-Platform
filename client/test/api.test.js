import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authenticate,
  createGroup,
  getSession,
  signOut,
  uploadTransactionReceipt,
} from '../src/api.js'

function mockResponse(body, { status = 200, ok = true } = {}) {
  return {
    status,
    ok,
    async json() {
      return body
    },
  }
}

function mockFetch(t, implementation) {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = implementation
}

test('getSession includes cookies and returns the session response', async (t) => {
  const session = { user: { id: 'user-id' }, csrfToken: 'csrf-token' }
  mockFetch(t, async (path, options) => {
    assert.equal(path, '/api/auth/session')
    assert.equal(options.method, 'GET')
    assert.equal(options.credentials, 'include')
    return mockResponse(session)
  })

  assert.deepEqual(await getSession(), session)
})

test('authenticate sends JSON with the CSRF header and cookies', async (t) => {
  const credentials = { username: 'test_user', password: 'a-secure-password' }
  const result = { user: { id: 'user-id' }, csrfToken: 'next-token' }
  mockFetch(t, async (path, options) => {
    assert.equal(path, '/api/auth/login')
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.headers['X-CSRF-Token'], 'csrf-token')
    assert.deepEqual(JSON.parse(options.body), credentials)
    return mockResponse(result)
  })

  assert.deepEqual(await authenticate('login', credentials, 'csrf-token'), result)
})

test('signOut returns null for a successful no-content response', async (t) => {
  mockFetch(t, async (path, options) => {
    assert.equal(path, '/api/auth/logout')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['X-CSRF-Token'], 'csrf-token')
    return mockResponse(null, { status: 204 })
  })

  assert.equal(await signOut('csrf-token'), null)
})

test('createGroup posts the requested group fields', async (t) => {
  const group = { id: 'group-id', name: 'Community Fund', currency: 'USD' }
  mockFetch(t, async (path, options) => {
    assert.equal(path, '/api/groups')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['X-CSRF-Token'], 'csrf-token')
    assert.deepEqual(JSON.parse(options.body), { name: 'Community Fund', currency: 'USD' })
    return mockResponse({ group })
  })

  assert.deepEqual(await createGroup('Community Fund', 'USD', 'csrf-token'), { group })
})

test('uploadTransactionReceipt sends a multipart receipt without overriding its boundary', async (t) => {
  const file = new File(['receipt contents'], 'receipt.pdf', { type: 'application/pdf' })
  mockFetch(t, async (path, options) => {
    assert.equal(path, '/api/groups/group-id/transactions/transaction-id/receipt')
    assert.equal(options.method, 'POST')
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers['X-CSRF-Token'], 'csrf-token')
    assert.equal(options.headers['Content-Type'], undefined)
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('receipt').name, 'receipt.pdf')
    return mockResponse({ receipt: { fileName: 'receipt.pdf' } })
  })

  assert.deepEqual(
    await uploadTransactionReceipt('group-id', 'transaction-id', file, 'csrf-token'),
    { receipt: { fileName: 'receipt.pdf' } },
  )
})

test('API error responses surface the server message', async (t) => {
  mockFetch(t, async () => mockResponse({ error: 'Please sign in.' }, { status: 401, ok: false }))

  await assert.rejects(getSession(), { message: 'Please sign in.' })
})

test('network failures return the actionable API connection message', async (t) => {
  mockFetch(t, async () => {
    throw new Error('socket unavailable')
  })

  await assert.rejects(getSession(), {
    message: 'Cannot reach the CommonFund API. Start the server and try again.',
  })
})
