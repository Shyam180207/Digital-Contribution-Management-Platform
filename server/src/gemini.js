import { HttpError } from './httpError.js'

const defaultGeminiModel = 'gemini-3.1-flash-lite'
const requestTimeoutMilliseconds = 10_000
const maximumNoteLength = 200

export async function generateTransactionNote(
  kind,
  { apiKey, fetchImpl = globalThis.fetch, model = defaultGeminiModel } = {},
) {
  if (!apiKey) throw new HttpError(503, 'AI note suggestions are not configured.')

  let response
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Suggest one concise, neutral note for a community savings transaction of type "${kind}". Do not invent names, dates, amounts, or events. Return only the note text, no quotation marks.`,
            }],
          }],
          generationConfig: {
            maxOutputTokens: 48,
            temperature: 0.4,
          },
        }),
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      },
    )
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new HttpError(504, 'AI note suggestions timed out. Try again.')
    }
    console.error('Gemini note suggestion request failed:', error)
    throw new HttpError(502, 'AI note suggestions are temporarily unavailable. Try again.')
  }

  if (!response.ok) {
    console.error(`Gemini note suggestion request returned HTTP ${response.status}.`)
    if (response.status === 429) {
      throw new HttpError(503, 'AI note suggestions are temporarily unavailable. Try again later.')
    }
    throw new HttpError(502, 'AI note suggestions are temporarily unavailable. Try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    console.error('Gemini note suggestion response was not valid JSON:', error)
    throw new HttpError(502, 'AI note suggestions returned an unreadable response.')
  }

  const generatedText = payload?.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part.text === 'string')?.text
  const note = generatedText?.trim().replace(/^["']|["']$/g, '').trim()
  if (!note || note.length > maximumNoteLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note)) {
    console.error('Gemini note suggestion response did not contain a valid short note.')
    throw new HttpError(502, 'AI note suggestions returned an invalid response. Try again.')
  }

  return note
}
