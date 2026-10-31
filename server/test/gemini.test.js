import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTransactionNote } from '../src/gemini.js'

test('Gemini note generation sends only a generic transaction type prompt', async () => {
  let requestUrl
  let requestOptions
  const note = await generateTransactionNote('contribution', {
    apiKey: 'test-gemini-key',
    fetchImpl: async (url, options) => {
      requestUrl = url
      requestOptions = options
      return Response.json({
        candidates: [{ content: { parts: [{ text: '  Monthly contribution  ' }] } }],
      })
    },
  })

  assert.equal(note, 'Monthly contribution')
  assert.equal(
    requestUrl,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
  )
  assert.equal(requestOptions.method, 'POST')
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-gemini-key')
  const body = JSON.parse(requestOptions.body)
  assert.match(body.contents[0].parts[0].text, /contribution/)
  assert.equal(JSON.stringify(body).includes('test-gemini-key'), false)
  assert.equal(body.generationConfig.maxOutputTokens, 48)
})

test('Gemini note generation requires an API key', async () => {
  await assert.rejects(generateTransactionNote('payout'), {
    status: 503,
    message: 'AI note suggestions are not configured.',
  })
})

test('Gemini provider errors do not expose upstream response details', async () => {
  await assert.rejects(generateTransactionNote('payout', {
    apiKey: 'test-gemini-key',
    fetchImpl: async () => new Response('private provider details', { status: 500 }),
  }), {
    status: 502,
    message: 'AI note suggestions are temporarily unavailable. Try again.',
  })
})

test('Gemini output must contain a short usable note', async () => {
  await assert.rejects(generateTransactionNote('payout', {
    apiKey: 'test-gemini-key',
    fetchImpl: async () => Response.json({
      candidates: [{ content: { parts: [{ text: 'x'.repeat(201) }] } }],
    }),
  }), {
    status: 502,
    message: 'AI note suggestions returned an invalid response. Try again.',
  })
})
