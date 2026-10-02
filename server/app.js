import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { assessments, olympiads } from './assessments.js'
import { hashPassword, hashToken, randomToken, userNameKey, validPassword, validUserName, verifyPassword } from './security.js'

const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const SESSION_COOKIE = '__Host-letopis_session'
const CSRF_COOKIE = '__Host-letopis_csrf'
const DEV_SESSION_COOKIE = 'letopis_session'
const DEV_CSRF_COOKIE = 'letopis_csrf'
const MAX_RESULTS = 1000
const allAssessments = [...assessments, ...olympiads]
const dummyPasswordHash = hashPassword(randomToken())

export function createApp({ db, staticDir = resolve('dist'), production = process.env.NODE_ENV === 'production' }) {
  const app = express()
  if (production) app.set('trust proxy', 1)

  app.disable('x-powered-by')
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  }))
  app.use(express.json({ limit: '24kb', strict: true }))

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 180,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много запросов. Попробуйте позже.' },
  })
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  })
  app.use('/api', apiLimiter)
  app.use('/api/login', authLimiter)

  const cookieNames = production
    ? { session: SESSION_COOKIE, csrf: CSRF_COOKIE }
    : { session: DEV_SESSION_COOKIE, csrf: DEV_CSRF_COOKIE }
  const cookieOptions = (maxAge) => [
    'Path=/',
    'SameSite=Strict',
    ...(production ? ['Secure'] : []),
    ...(maxAge === 0 ? ['Max-Age=0'] : [`Max-Age=${Math.floor(maxAge / 1000)}`]),
  ]
  const cookiesFromRequest = (req) => {
    const parsed = new Map()
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const separator = part.indexOf('=')
      if (separator < 0) continue
      const key = part.slice(0, separator).trim()
      if (parsed.has(key)) return null
      parsed.set(key, part.slice(separator + 1).trim())
    }
    return parsed
  }
  const setAuthCookies = (res, sessionToken, csrfToken) => {
    const sessionOptions = ['HttpOnly', ...cookieOptions(SESSION_TTL_MS)]
    const csrfOptions = cookieOptions(SESSION_TTL_MS)
    res.append('Set-Cookie', `${cookieNames.session}=${sessionToken}; ${sessionOptions.join('; ')}`)
    res.append('Set-Cookie', `${cookieNames.csrf}=${csrfToken}; ${csrfOptions.join('; ')}`)
  }
  const clearAuthCookies = (res) => {
    res.append('Set-Cookie', `${cookieNames.session}=; HttpOnly; ${cookieOptions(0).join('; ')}`)
    res.append('Set-Cookie', `${cookieNames.csrf}=; ${cookieOptions(0).join('; ')}`)
  }

  const statements = {
    userByName: db.prepare('SELECT id, name, role, password_hash FROM users WHERE name_key = ?'),
    listUsers: db.prepare('SELECT id, name, role, created_at AS createdAt FROM users ORDER BY role, name LIMIT 500'),
    addUser: db.prepare('INSERT INTO users (id, name, name_key, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    addSession: db.prepare('INSERT INTO sessions (token_hash, user_id, csrf_hash, expires_at) VALUES (?, ?, ?, ?)'),
    getSession: db.prepare(`
      SELECT users.id, users.name, users.role, sessions.csrf_hash, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `),
    removeSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    cleanSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    addResult: db.prepare(`
      INSERT INTO results (id, user_id, assessment_id, title, score, total, grade, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    myResults: db.prepare(`
      SELECT id, user_id AS userId, assessment_id AS assessmentId, title, score, total, grade,
        completed_at AS completedAt FROM results WHERE user_id = ? ORDER BY completed_at DESC LIMIT ?
    `),
    allResults: db.prepare(`
      SELECT results.id, results.user_id AS userId, users.name AS student,
        results.assessment_id AS assessmentId, results.title, results.score, results.total,
        results.grade, results.completed_at AS completedAt
      FROM results JOIN users ON users.id = results.user_id
      WHERE (? IS NULL OR users.name = ? COLLATE NOCASE)
        AND (? IS NULL OR results.assessment_id = ?)
        AND (? IS NULL OR results.completed_at >= ?)
      ORDER BY results.completed_at DESC LIMIT ?
    `),
  }

  app.use(async (req, res, next) => {
    try {
      if (!req.path.startsWith('/api/')) return next()
      const cookies = cookiesFromRequest(req)
      if (!cookies) return res.status(400).json({ error: 'Некорректные cookie.' })
      const token = cookies.get(cookieNames.session)
      if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return next()
      const session = statements.getSession.get(hashToken(token))
      if (!session) return next()
      if (session.expires_at <= Date.now()) {
        statements.removeSession.run(hashToken(token))
        clearAuthCookies(res)
        return next()
      }
      req.auth = {
        id: session.id,
        name: session.name,
        role: session.role,
        csrfHash: session.csrf_hash,
        csrfCookie: cookies.get(cookieNames.csrf),
      }
      return next()
    } catch (error) {
      return next(error)
    }
  })

  const requireAuth = (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Требуется войти в систему.' })
    return next()
  }
  const requireTeacher = (req, res, next) => {
    if (req.auth?.role !== 'teacher') return res.status(403).json({ error: 'Недостаточно прав.' })
    return next()
  }
  const requireCsrf = (req, res, next) => {
    if (!req.auth || typeof req.auth.csrfCookie !== 'string' ||
      req.get('x-csrf-token') !== req.auth.csrfCookie ||
      hashToken(req.auth.csrfCookie) !== req.auth.csrfHash) {
      return res.status(403).json({ error: 'Проверка запроса не пройдена. Обновите страницу.' })
    }
    return next()
  }
  const checkOrigin = (req, res, next) => {
    const origin = req.get('origin')
    if (!origin) return res.status(403).json({ error: 'Запрос без источника не разрешён.' })
    let requestOrigin
    try {
      requestOrigin = new URL(origin).origin
    } catch {
      return res.status(403).json({ error: 'Источник запроса недопустим.' })
    }
    const expectedOrigin = process.env.APP_ORIGIN
      ? new URL(process.env.APP_ORIGIN).origin
      : `${req.protocol}://${req.get('host')}`
    if (requestOrigin !== expectedOrigin) return res.status(403).json({ error: 'Источник запроса не разрешён.' })
    return next()
  }

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get()
      return res.json({ status: 'ok' })
    } catch {
      return res.status(503).json({ status: 'unavailable' })
    }
  })
  app.get('/api/session', (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!req.auth || !req.auth.csrfCookie) return res.json({ user: null })
    return res.json({
      user: { id: req.auth.id, name: req.auth.name, role: req.auth.role },
      csrfToken: req.auth.csrfCookie,
    })
  })
  app.post('/api/login', checkOrigin, async (req, res, next) => {
    try {
      const { name, password } = req.body ?? {}
      const requestedRole = req.body?.role
      if (requestedRole !== undefined && requestedRole !== 'teacher' && requestedRole !== 'student') {
        return res.status(400).json({ error: 'Укажите имя и пароль.' })
      }
      if (!validUserName(name) || typeof password !== 'string' || password.length > 128) {
        return res.status(400).json({ error: 'Укажите имя и пароль.' })
      }
      const user = statements.userByName.get(userNameKey(name))
      const valid = await verifyPassword(password, user?.password_hash ?? await dummyPasswordHash)
      if (!user || !valid || (requestedRole && user.role !== requestedRole)) {
        return res.status(401).json({ error: 'Имя или пароль не совпадают.' })
      }
      const sessionToken = randomToken()
      const csrfToken = randomToken()
      const expiresAt = Date.now() + SESSION_TTL_MS
      statements.cleanSessions.run(Date.now())
      statements.addSession.run(hashToken(sessionToken), user.id, hashToken(csrfToken), expiresAt)
      setAuthCookies(res, sessionToken, csrfToken)
      res.set('Cache-Control', 'no-store')
      return res.json({ user: { id: user.id, name: user.name, role: user.role }, csrfToken })
    } catch (error) {
      return next(error)
    }
  })
  app.post('/api/logout', requireAuth, checkOrigin, requireCsrf, (req, res) => {
    const cookies = cookiesFromRequest(req)
    const token = cookies?.get(cookieNames.session)
    if (token) statements.removeSession.run(hashToken(token))
    clearAuthCookies(res)
    res.status(204).end()
  })
  app.get('/api/assessments', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.json(allAssessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      unit: assessment.unit,
      description: assessment.description,
      olympiad: Boolean(assessment.olympiad),
      questions: assessment.questions.map(({ prompt, type, options, pairs }) => ({
        prompt, type, ...(options ? { options } : {}), ...(pairs ? { pairs: pairs.map(({ label, options: pairOptions }) => ({ label, options: pairOptions })) } : {}),
      })),
    })))
  })
  app.post('/api/admin/users', requireAuth, requireTeacher, checkOrigin, requireCsrf, async (req, res, next) => {
    try {
      const { name, password } = req.body ?? {}
      const role = req.body?.role ?? 'student'
      if (!validUserName(name) || !validPassword(password) || (role !== 'teacher' && role !== 'student')) {
        return res.status(400).json({ error: 'Проверьте имя, пароль (12–128 символов) и роль.' })
      }
      const passwordHash = await hashPassword(password)
      const id = randomUUID()
      try {
        statements.addUser.run(id, name.trim(), userNameKey(name), role, passwordHash, new Date().toISOString())
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Пользователь с таким именем уже существует.' })
        throw error
      }
      return res.status(201).json({ id, name: name.trim(), role })
    } catch (error) {
      return next(error)
    }
  })
  app.get('/api/admin/users', requireAuth, requireTeacher, (_req, res) => {
    res.set('Cache-Control', 'no-store')
    return res.json(statements.listUsers.all())
  })
  app.post('/api/assessments/:id/submit', requireAuth, checkOrigin, requireCsrf, (req, res) => {
    if (req.auth.role !== 'student') return res.status(403).json({ error: 'Работы доступны только ученикам.' })
    const assessment = allAssessments.find((item) => item.id === req.params.id)
    if (!assessment) return res.status(404).json({ error: 'Работа не найдена.' })
    const { answers } = req.body ?? {}
    const validAnswer = (question, answer) => {
      if (question.type === 'multi' || question.type === 'match') {
        if (!Array.isArray(answer) || answer.length > 20 ||
          answer.some((item) => typeof item !== 'string' || item.length > 300)) return false
        if (question.type === 'match') {
          const selected = answer.filter((item) => item !== '')
          if (new Set(selected).size !== selected.length) return false
          return answer.length === question.pairs.length &&
            answer.every((item, index) => item === '' || question.pairs[index].options.includes(item))
        }
        return new Set(answer).size === answer.length &&
          answer.every((item) => question.options.includes(item))
      }
      if (typeof answer !== 'string' || answer.length > 1000) return false
      return question.type === 'text' || question.type === 'date' ||
        (answer === '' || question.options.includes(answer))
    }
    if (!Array.isArray(answers) || answers.length !== assessment.questions.length ||
      answers.some((answer, index) => !validAnswer(assessment.questions[index], answer))) {
      return res.status(400).json({ error: 'Ответы имеют неверный формат.' })
    }
    const correct = (question, answer) => {
      if (answer === undefined) return false
      if (question.type === 'match') {
        return Array.isArray(answer) && Array.isArray(question.answer) &&
          answer.length === question.answer.length &&
          answer.every((value, index) => value === question.answer[index])
      }
      if (question.type === 'text' || question.type === 'date') {
        return typeof answer === 'string' && answer.trim().toLocaleLowerCase('ru') === question.answer.trim().toLocaleLowerCase('ru')
      }
      const actual = Array.isArray(answer) ? [...answer].sort() : [answer]
      const expected = Array.isArray(question.answer) ? [...question.answer].sort() : [question.answer]
      return actual.length === expected.length && actual.every((value, index) => value === expected[index])
    }
    const score = assessment.questions.reduce((sum, question, index) => sum + (correct(question, answers[index]) ? 1 : 0), 0)
    const percentage = Math.round(score / assessment.questions.length * 100)
    const grade = percentage >= 90 ? '5' : percentage >= 75 ? '4' : percentage >= 60 ? '3' : '2'
    const result = {
      id: randomUUID(),
      student: req.auth.name,
      assessment: assessment.id,
      title: assessment.title,
      score,
      total: assessment.questions.length,
      grade,
      completedAt: new Date().toISOString(),
    }
    statements.addResult.run(result.id, req.auth.id, result.assessment, result.title, result.score, result.total, result.grade, result.completedAt)
    res.set('Cache-Control', 'no-store')
    return res.status(201).json({
      result,
      review: assessment.questions.map((question, index) => ({
        prompt: question.prompt,
        answer: question.answer,
        explanation: question.explanation,
        correct: correct(question, answers[index]),
      })),
    })
  })
  app.get('/api/results', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (req.auth.role === 'student') return res.json(statements.myResults.all(req.auth.id, MAX_RESULTS))
    const student = typeof req.query.student === 'string' && req.query.student.length <= 64 ? req.query.student : null
    const assessmentId = typeof req.query.assessmentId === 'string' &&
      allAssessments.some((assessment) => assessment.id === req.query.assessmentId) ? req.query.assessmentId : null
    if (req.query.since !== undefined &&
      (typeof req.query.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.query.since))) {
      return res.status(400).json({ error: 'Дата фильтра задана неверно.' })
    }
    const since = typeof req.query.since === 'string' ? `${req.query.since}T00:00:00.000Z` : null
    return res.json(statements.allResults.all(student, student, assessmentId, assessmentId, since, since, MAX_RESULTS))
  })

  if (existsSync(staticDir)) {
    app.use(express.static(staticDir, {
      index: false,
      setHeaders: (res, path) => {
        if (production && /\.[a-f0-9]{8,}\./i.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    }))
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      return res.sendFile(resolve(staticDir, 'index.html'))
    })
  }

  app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден.' }))
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Запрос слишком большой.' })
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Некорректный JSON.' })
    console.error('API request failed:', error)
    return res.status(500).json({ error: 'Внутренняя ошибка сервера.' })
  })

  app.locals.bootstrapAdmin = async () => {
    const count = db.prepare('SELECT count(*) AS count FROM users').get().count
    if (count > 0) return
    const name = process.env.INITIAL_ADMIN_NAME
    const password = process.env.INITIAL_ADMIN_PASSWORD
    if (!validUserName(name) || !validPassword(password)) {
      throw new Error('Set INITIAL_ADMIN_NAME and a 12+ character INITIAL_ADMIN_PASSWORD before first startup.')
    }
    statements.addUser.run(randomUUID(), name.trim(), userNameKey(name), 'teacher', await hashPassword(password), new Date().toISOString())
  }
  return app
}
