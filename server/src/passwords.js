import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, keyLength)
  return `scrypt$${salt}$${key.toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, storedKey] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !storedKey) return false

  const key = await scrypt(password, salt, keyLength)
  const expectedKey = Buffer.from(storedKey, 'hex')
  return expectedKey.length === key.length && timingSafeEqual(key, expectedKey)
}
