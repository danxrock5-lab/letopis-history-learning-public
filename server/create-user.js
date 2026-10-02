import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { randomUUID } from 'node:crypto'
import { openDatabase } from './database.js'
import { hashPassword, userNameKey, validPassword, validUserName } from './security.js'

const [nameArg, roleArg = 'student'] = process.argv.slice(2)
const terminal = createInterface({ input: stdin, output: stdout })
const db = openDatabase()

try {
  const name = (nameArg ?? await terminal.question('Имя пользователя: ')).trim()
  const role = roleArg
  const password = await terminal.question('Пароль (не менее 12 символов): ')
  if (!validUserName(name) || !validPassword(password) ||
    (role !== 'teacher' && role !== 'student')) {
    throw new Error('Проверьте имя, роль и длину пароля (12–128 символов).')
  }
  const passwordHash = await hashPassword(password)
  db.prepare('INSERT INTO users (id, name, name_key, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), name, userNameKey(name), role, passwordHash, new Date().toISOString())
  console.log(`Создан пользователь «${name}» (${role}).`)
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('Пользователь с таким именем уже существует.')
    process.exitCode = 1
  } else {
    console.error(error.message)
    process.exitCode = 1
  }
} finally {
  terminal.close()
  db.close()
}
