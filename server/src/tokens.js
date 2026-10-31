import jwt from 'jsonwebtoken'

const issuer = 'commonfund-api'
const audience = 'commonfund-client'
export const accessTokenLifetimeSeconds = 60 * 60

export function createAccessToken(userId, secret) {
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    audience,
    expiresIn: accessTokenLifetimeSeconds,
    issuer,
    subject: String(userId),
  })
}

export function verifyAccessToken(token, secret) {
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    audience,
    issuer,
  })
}

export function isInvalidAccessTokenError(error) {
  return error instanceof jwt.JsonWebTokenError
}
