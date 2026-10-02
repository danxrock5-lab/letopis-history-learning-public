import 'dotenv/config'
import { resolve } from 'node:path'
import { createApp } from './app.js'
import { openDatabase } from './database.js'

const db = openDatabase()
const app = createApp({ db, staticDir: resolve('dist') })

try {
  await app.locals.bootstrapAdmin()
} catch (error) {
  console.error(error.message)
  db.close()
  process.exit(1)
}

const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a valid TCP port.')
  db.close()
  process.exit(1)
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Letopis server listening on port ${port}`)
})

const shutdown = () => {
  server.close(() => {
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
    process.exit(0)
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
