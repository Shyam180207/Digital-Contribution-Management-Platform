async function request(path, { method = 'GET', body, csrfToken, signal } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Cannot reach the CommonFund API. Start the server and try again.')
  }

  if (response.status === 204) return null

  const result = await response.json().catch(() => {
    throw new Error('The API returned an unreadable response.')
  })

  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.')
  return result
}

export function getSession(options) {
  return request('/api/auth/session', options)
}

export function getDashboard(options) {
  return request('/api/dashboard', options)
}

export function authenticate(mode, credentials, csrfToken) {
  return request(`/api/auth/${mode}`, {
    method: 'POST',
    body: credentials,
    csrfToken,
  })
}

export function signOut(csrfToken) {
  return request('/api/auth/logout', { method: 'POST', csrfToken })
}

export function createGroup(name, currency, csrfToken) {
  return request('/api/groups', {
    method: 'POST',
    body: { name, currency },
    csrfToken,
  })
}
