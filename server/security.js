import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const SCRYPT_COST = 32768
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELISM = 1
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024

export const hashToken = (token) => createHash('sha256').update(token).digest('hex')
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: MAX_MEMORY,
  })
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELISM}$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt' ||
    parts.slice(1, 4).some((part) => !/^\d+$/.test(part)) ||
    parts[1] !== String(SCRYPT_COST) || parts[2] !== String(SCRYPT_BLOCK_SIZE) ||
    parts[3] !== String(SCRYPT_PARALLELISM) ||
    !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false
  const [, cost, blockSize, parallelism, saltHex, expectedHex] = parts
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
    maxmem: MAX_MEMORY,
  })
  const expected = Buffer.from(expectedHex, 'hex')
  return timingSafeEqual(key, expected)
}

export function validUserName(name) {
  return typeof name === 'string' && name.trim().length >= 2 &&
    name.trim().length <= 64 &&
    /^[\p{L}\p{M}\d][\p{L}\p{M}\d ._'’-]{1,63}$/u.test(name.trim())
}

export const userNameKey = (name) => name.normalize('NFKC').trim().toLocaleLowerCase('ru-RU')
export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128
}
