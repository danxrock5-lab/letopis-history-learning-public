import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from './app.js'
import { openDatabase } from './database.js'
import { assessments } from './assessments.js'
import { hashPassword } from './security.js'

const fixture = test('secure API', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'letopis-api-'))
  const db = openDatabase(join(directory, 'test.sqlite'))
  const insertUser = db.prepare(
    'INSERT INTO users (id, name, name_key, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insertUser.run('teacher-id', 'Teacher', 'teacher', 'teacher', await hashPassword('teacher-password-1'), new Date().toISOString())
  insertUser.run('student-id', 'Student', 'student', 'student', await hashPassword('student-password-1'), new Date().toISOString())
  const app = createApp({ db, staticDir: join(directory, 'no-static-files') })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`

  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    db.close()
    await rm(directory, { recursive: true, force: true })
  })

  const login = async (name, password, role) => {
    const response = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ name, password }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`Login failed (${response.status}): ${body.error}`)
    const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(';')[0])
    return { body, cookies, role }
  }
  const request = (path, { cookies = [], csrfToken, ...options } = {}) => fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { origin: base } : {}),
      ...(cookies.length ? { cookie: cookies.join('; ') } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...options.headers,
    },
  })
  let studentSession

  await t.test('health check reports database status', async () => {
    const response = await request('/api/health')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  })

  await t.test('assessment catalog never sends answer keys or explanations', async () => {
    const response = await request('/api/assessments')
    assert.equal(response.status, 200)
    const catalog = await response.json()
    assert.equal(catalog.length, assessments.length + (await import('./assessments.js')).olympiads.length)
    for (const assessment of catalog) {
      for (const question of assessment.questions) {
        assert.equal('answer' in question, false)
        assert.equal('explanation' in question, false)
      }
    }
  })

  await t.test('replacement curriculum has ten tests and three olympiads with complete answer keys', async () => {
    const { olympiads } = await import('./assessments.js')
    assert.equal(assessments.length, 10)
    assert.equal(olympiads.length, 3)
    for (const assessment of assessments) {
      assert.equal(assessment.questions.length, 10, assessment.id)
      assert.ok(assessment.questions.every((question) => question.explanation), assessment.id)
    }
    for (const olympiad of olympiads) {
      assert.equal(olympiad.questions.length, 15, olympiad.id)
      assert.ok(olympiad.questions.every((question) => question.explanation), olympiad.id)
    }
    for (const question of [...assessments, ...olympiads].flatMap((assessment) => assessment.questions)) {
      if (question.type === 'single') assert.ok(question.options.includes(question.answer), question.prompt)
      if (question.type === 'multi') {
        assert.ok(question.answer.length > 0 && question.answer.every((answer) => question.options.includes(answer)), question.prompt)
      }
      if (question.type === 'match') {
        assert.equal(question.answer.length, question.pairs.length, question.prompt)
        assert.ok(question.pairs.every((item) => item.options.includes(item.answer)), question.prompt)
      }
      if (question.type === 'date' || question.type === 'text') assert.equal(typeof question.answer, 'string', question.prompt)
    }
  })

  await t.test('login blocks hostile origins and rejects invalid credentials', async () => {
    const hostile = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
      body: JSON.stringify({ name: 'Teacher', password: 'teacher-password-1' }),
    })
    assert.equal(hostile.status, 403)
    const invalid = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ name: 'Teacher', password: 'not-the-password' }),
    })
    assert.equal(invalid.status, 401)
    assert.deepEqual(await invalid.json(), { error: 'Имя или пароль не совпадают.' })
    const wrongRole = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ name: 'Student', password: 'student-password-1', role: 'teacher' }),
    })
    assert.equal(wrongRole.status, 401)
    assert.equal(wrongRole.headers.getSetCookie().length, 0)
  })

  await t.test('student session is HttpOnly and has a matching CSRF token', async () => {
    const session = studentSession = await login('Student', 'student-password-1', 'student')
    assert.equal(session.body.user.role, 'student')
    assert.match(session.body.csrfToken, /^[A-Za-z0-9_-]{40,64}$/)
    assert.ok(session.cookies.some((cookie) => cookie.startsWith('letopis_session=')))
    const sessionResponse = await request('/api/session', { cookies: session.cookies })
    assert.equal(sessionResponse.status, 200)
    assert.equal((await sessionResponse.json()).csrfToken, session.body.csrfToken)
    const badCsrf = await request('/api/assessments/not-a-test/submit', {
      cookies: session.cookies,
      method: 'POST',
      body: JSON.stringify({ answers: [] }),
    })
    assert.equal(badCsrf.status, 403)
  })

  await t.test('server grades submissions, persists them, and scopes results by role', async () => {
    const student = studentSession
    const assessment = assessments[0]
    const response = await request(`/api/assessments/${assessment.id}/submit`, {
      cookies: student.cookies,
      csrfToken: student.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ answers: assessment.questions.map((question) => question.answer), score: 0, grade: '2' }),
    })
    assert.equal(response.status, 201)
    const submission = await response.json()
    assert.equal(submission.result.score, assessment.questions.length)
    assert.equal(submission.result.grade, '5')
    assert.ok(submission.review.every((question) => question.correct))

    const invalidAssessment = await request('/api/assessments/not-a-test/submit', {
      cookies: student.cookies,
      csrfToken: student.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ answers: [] }),
    })
    assert.equal(invalidAssessment.status, 404)
    const studentResults = await request('/api/results', { cookies: student.cookies })
    assert.equal((await studentResults.json()).length, 1)

    const teacher = await login('Teacher', 'teacher-password-1', 'teacher')
    const teacherResults = await request('/api/results', { cookies: teacher.cookies })
    const records = await teacherResults.json()
    assert.equal(records.length, 1)
    assert.equal(records[0].student, 'Student')
    const teacherSubmit = await request(`/api/assessments/${assessment.id}/submit`, {
      cookies: teacher.cookies,
      csrfToken: teacher.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ answers: assessment.questions.map((question) => question.answer) }),
    })
    assert.equal(teacherSubmit.status, 403)
  })

  await t.test('teacher can provision a student using a hashed password', async () => {
    const teacher = await login('Teacher', 'teacher-password-1', 'teacher')
    const response = await request('/api/admin/users', {
      cookies: teacher.cookies,
      csrfToken: teacher.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ name: 'New Student', role: 'student', password: 'a-long-new-password' }),
    })
    assert.equal(response.status, 201)
    const studentRow = db.prepare('SELECT password_hash FROM users WHERE name_key = ?').get('new student')
    assert.match(studentRow.password_hash, /^scrypt\$/)
    assert.notEqual(studentRow.password_hash, 'a-long-new-password')
    const duplicate = await request('/api/admin/users', {
      cookies: teacher.cookies,
      csrfToken: teacher.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ name: 'new student', role: 'student', password: 'a-long-new-password' }),
    })
    assert.equal(duplicate.status, 409)
  })

  await t.test('matching answers are graded by pair position, not as an unordered set', async () => {
    const student = studentSession
    const assessment = assessments.find((item) => item.questions.some((question) => question.type === 'match'))
    const answers = assessment.questions.map((question) =>
      Array.isArray(question.answer) ? [...question.answer] : question.answer)
    const matchingIndex = assessment.questions.findIndex((question) => question.type === 'match')
    const matchQuestion = assessment.questions[matchingIndex]
    answers[matchingIndex][0] = matchQuestion.pairs[0].options.find((option) => option !== answers[matchingIndex][0])
    const response = await request(`/api/assessments/${assessment.id}/submit`, {
      cookies: student.cookies,
      csrfToken: student.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ answers }),
    })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).result.score, assessment.questions.length - 1)
  })

  await t.test('unanswered matching fields are accepted and graded as incorrect', async () => {
    const student = studentSession
    const assessment = assessments.find((item) => item.questions.some((question) => question.type === 'match'))
    const answers = assessment.questions.map((question) =>
      question.type === 'match' ? question.pairs.map(() => '') : question.type === 'multi' ? [] : '')
    const response = await request(`/api/assessments/${assessment.id}/submit`, {
      cookies: student.cookies,
      csrfToken: student.body.csrfToken,
      method: 'POST',
      body: JSON.stringify({ answers }),
    })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).result.score, 0)
  })
})

void fixture
