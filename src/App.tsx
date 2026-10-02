import { useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Award, BookOpen, Check, ChevronDown, Clock3,
  GraduationCap, History, LogOut, Menu, Moon, Search, ShieldCheck, Sparkles, Sun,
  Target, Trophy, UserRound, Users, X,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { assessments, formatQuestionType, getGrade, olympiads, sourceLinks, textbook, type Assessment, type Question } from './data'

type Person = { name: string; role: 'student' | 'teacher'; password: string }
type SessionUser = Omit<Person, 'password'>
type Result = { id: string; student: string; assessment: string; title: string; score: number; total: number; grade: string; date: string }
const accounts: Person[] = [
  { name: 'Учитель', role: 'teacher', password: 'teacher-demo' },
  { name: 'Ученик 1', role: 'student', password: 'student1-demo' },
  { name: 'Ученик 2', role: 'student', password: 'student2-demo' },
  { name: 'Ученик 3', role: 'student', password: 'student3-demo' },
]
const PALETTE = ['#f4c84a', '#2563a6']
const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}
const persist = <T,>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value))
const sortedAnswer = (value: string | string[]) => (Array.isArray(value) ? [...value].sort().join('|') : value.trim().toLowerCase())
const answersMatch = (question: Question, answer: string | string[] | undefined) => {
  if (answer === undefined) return false
  if (question.type === 'match' && Array.isArray(question.answer) && Array.isArray(answer)) {
    return question.answer.length === answer.length && question.answer.every((value, index) => value === answer[index])
  }
  if (question.type === 'text' || question.type === 'date') {
    return typeof question.answer === 'string' && typeof answer === 'string' &&
      question.answer.trim().toLocaleLowerCase('ru') === answer.trim().toLocaleLowerCase('ru')
  }
  return sortedAnswer(answer) === sortedAnswer(question.answer)
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('letopis-theme') === 'dark' ? 'dark' : 'light')
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = loadJson<(Person | SessionUser) | null>('letopis-user', null)
    if (!saved) return null
    const session: SessionUser = { name: saved.name, role: saved.role }
    if ('password' in saved) persist('letopis-user', session)
    return session
  })
  const [page, setPage] = useState('home')
  const [loginRole, setLoginRole] = useState<'teacher' | 'student' | 'choose' | null>(null)
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [results, setResults] = useState<Result[]>(() => loadJson('letopis-results', []))
  const [active, setActive] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStudent, setFilterStudent] = useState('Все ученики')
  const [filterTest, setFilterTest] = useState('Все работы')
  const [filterDate, setFilterDate] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  const changeTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('letopis-theme', next)
  }
  const signOut = () => {
    localStorage.removeItem('letopis-user')
    setUser(null); setPage('home'); setMobileNav(false)
  }
  const nav = (destination: string) => { setPage(destination); setMobileNav(false); setActive(null); setShowResult(false) }
  const login = (event: React.FormEvent) => {
    event.preventDefault()
    const found = accounts.find((account) =>
      account.role === loginRole && account.name === loginName && account.password === loginPassword,
    )
    if (!found) { setLoginError('Имя или пароль не совпадают. Проверьте данные и попробуйте ещё раз.'); return }
    const session: SessionUser = { name: found.name, role: found.role }
    setUser(session); persist('letopis-user', session); setLoginRole(null); setLoginError(''); setLoginPassword(''); setPage('home')
  }
  const startAssessment = (assessment: Assessment) => {
    setActive(assessment); setAnswers({}); setQuestionIndex(0); setShowResult(false); setPage('assessment')
  }
  const currentQuestion = active?.questions[questionIndex]
  const computedScore = useMemo(() => active?.questions.reduce((sum, question, index) =>
    sum + (answersMatch(question, answers[index]) ? 1 : 0), 0) ?? 0, [active, answers])
  const finishAssessment = () => {
    if (!active || !user || user.role !== 'student') return
    const score = active.questions.reduce((sum, question, index) =>
      sum + (answersMatch(question, answers[index]) ? 1 : 0), 0)
    const result: Result = {
      id: crypto.randomUUID(), student: user.name, assessment: active.id, title: active.title,
      score, total: active.questions.length, grade: getGrade(score / active.questions.length * 100),
      date: new Date().toISOString().slice(0, 10),
    }
    const next = [result, ...results]
    setResults(next); persist('letopis-results', next); setShowResult(true)
  }
  const startHeader = (
    <header className="site-header">
      <button className="brand" onClick={() => nav('home')} aria-label="На главную">
        <span className="brand-mark"><History size={20} /></span>
        <span><b>Летопись</b><small>ИСТОРИЯ РОССИИ · 7 КЛАСС</small></span>
      </button>
      {user && <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Меню" aria-expanded={mobileNav}>{mobileNav ? <X /> : <Menu />}</button>}
      <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
        {user && <><button className={page === 'tests' ? 'nav-active' : ''} onClick={() => nav('tests')}>Тесты</button><button className={page === 'olympiads' ? 'nav-active' : ''} onClick={() => nav('olympiads')}>Олимпиады</button><button className={page === 'textbook' ? 'nav-active' : ''} onClick={() => nav('textbook')}>Учебник</button><button className={page === 'profile' ? 'nav-active' : ''} onClick={() => nav('profile')}>Профиль</button></>}
      </nav>
      <div className="header-actions">
        <button className="icon-button" onClick={changeTheme} aria-label="Переключить тему">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        {user ? <><button className="user-chip" onClick={() => nav('profile')}><span className="avatar">{user.name[0]}</span><span>{user.name}</span></button><button className="icon-button logout-button" onClick={signOut} title="Выйти"><LogOut size={17} /></button></> : <button className="button button-gold header-login" onClick={() => setLoginRole('choose')}>Войти <ArrowRight size={16} /></button>}
      </div>
    </header>
  )

  const footer = <footer className="site-footer"><span>© 2026 Летопись · Учимся понимать прошлое</span><div>{sourceLinks.slice(0, 2).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label.split('(')[0].trim()}</a>)}</div></footer>
  const loginModal = loginRole && <div className="modal-backdrop" onClick={() => setLoginRole(null)}><section className="login-modal glass-card" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setLoginRole(null)} aria-label="Закрыть"><X size={19} /></button>{loginRole === 'choose' ? <><div className="modal-emblem"><History /></div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>Рады видеть вас</h2><p className="muted">Выберите, как вы хотите войти на платформу.</p><div className="role-options"><button className="role-option" onClick={() => { setLoginRole('teacher'); setLoginName('') }}><span><GraduationCap /></span><b>Войти как учитель</b><small>Успеваемость и результаты класса</small><ArrowRight size={17} /></button><button className="role-option" onClick={() => { setLoginRole('student'); setLoginName('') }}><span><UserRound /></span><b>Войти как ученик</b><small>Тесты, олимпиады и личный прогресс</small><ArrowRight size={17} /></button></div></> : <><div className="modal-emblem">{loginRole === 'teacher' ? <GraduationCap /> : <UserRound />}</div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>{loginRole === 'teacher' ? 'Вход для учителя' : 'Вход для ученика'}</h2><p className="muted">Выберите имя и введите пароль, чтобы продолжить.</p><form onSubmit={login}><label>Имя пользователя<select value={loginName} onChange={(event) => setLoginName(event.target.value)} required><option value="">Выберите имя</option>{accounts.filter((account) => account.role === loginRole).map((account) => <option key={account.name}>{account.name}</option>)}</select></label><label>Пароль<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Введите пароль" required /></label>{loginError && <div className="error-note">{loginError}</div>}<button className="button button-gold button-wide" type="submit">Войти в кабинет <ArrowRight size={17} /></button></form><button className="modal-back-link" onClick={() => { setLoginRole('choose'); setLoginError('') }}><ArrowLeft size={14} /> Выбрать другую роль</button></>}<p className="security-note"><ShieldCheck size={15} /> Демо-вход для локального прототипа</p></section></div>

  const assessmentCard = (assessment: Assessment) => {
    const completed = user && results.some((result) => result.student === user.name && result.assessment === assessment.id)
    return <article className="assessment-card glass-card" key={assessment.id}><div className="card-topline"><span className={assessment.olympiad ? 'pill pill-purple' : 'pill'}>{assessment.olympiad ? 'ОЛИМПИАДА' : 'ПРОВЕРОЧНАЯ'}</span><span className="card-index">{assessment.olympiad ? <Trophy size={17} /> : <BookOpen size={17} />}</span></div><h3>{assessment.title}</h3><p className="card-unit">{assessment.unit}</p><p className="muted card-description">{assessment.description}</p><div className="assessment-meta"><span><Target size={15} /> {assessment.questions.length} заданий</span><span><Clock3 size={15} /> {assessment.olympiad ? '35' : '15'} мин</span></div><button className="card-action" disabled={user?.role === 'teacher'} onClick={() => user?.role === 'student' ? startAssessment(assessment) : !user && setLoginRole('student')}>{user?.role === 'teacher' ? 'Только для учеников' : completed ? 'Пройти ещё раз' : 'Начать работу'} {user?.role !== 'teacher' && <ArrowRight size={16} />}</button></article>
  }

  const renderQuestionInput = (question: Question, index: number) => {
    const isMulti = question.type === 'multi'
    const options = question.options ?? (question.type === 'match' ? ['Кузьма Минин — военный руководитель', 'Дмитрий Пожарский — сбор средств', 'Михаил Романов — первый Романов', 'Кузьма Минин — сбор средств', 'Дмитрий Пожарский — военный руководитель'] : [])
    if (question.type === 'match' && question.pairs) {
      const selected = Array.isArray(answers[index]) ? answers[index] as string[] : []
      return <div className="matching-options">{question.pairs.map((pair, pairIndex) => <label key={pair.label}>{pair.label}<select value={selected[pairIndex] ?? ''} onChange={(event) => { const next = [...selected]; next[pairIndex] = event.target.value; setAnswers({ ...answers, [index]: next }) }}><option value="">Выберите соответствие</option>{pair.options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>
    }
    if (question.type === 'text' || question.type === 'date') {
      return <label className="answer-input-label">{question.type === 'date' ? 'Год события:' : 'Ваш ответ:'}<input className="answer-input" value={typeof answers[index] === 'string' ? answers[index] as string : ''} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder={question.type === 'date' ? 'Например, 1612' : 'Введите ответ'} /></label>
    }
    return <div className="answer-options">{options.map((option) => {
      const selected = isMulti ? (answers[index] as string[] | undefined)?.includes(option) : answers[index] === option
      return <button key={option} className={`answer-option ${selected ? 'selected' : ''}`} onClick={() => setAnswers({ ...answers, [index]: isMulti ? selected ? (answers[index] as string[]).filter((answer) => answer !== option) : [...((answers[index] as string[]) ?? []), option] : option })}><span className="option-indicator">{selected && <Check size={14} />}</span><span>{option}</span></button>
    })}</div>
  }

  const renderHome = () => <main className="page-shell home-shell"><section className="hero">
    <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> ИСТОРИЯ РОССИИ · СЕЗОН 2026</div><h1>Прошлое — это<br /><em>начало будущего.</em></h1><p>Погрузитесь в историю России XVII века: разбирайте события, проверяйте знания и открывайте связи, которые меняли ход времени.</p><div className="hero-actions"><button className="button button-gold" onClick={() => user ? nav('tests') : setLoginRole('student')}>Начать обучение <ArrowRight size={17} /></button><button className="button button-outline" onClick={() => nav('textbook')}>Открыть учебник <BookOpen size={17} /></button></div><div className="hero-note"><span className="note-avatar"><Sparkles size={15} /></span><span>Короткие сессии · большие открытия</span></div></div>
    <div className="hero-art"><div className="art-glow" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-compass"><History size={52} strokeWidth={1.1} /></div><div className="art-years"><span>1601</span><i /><span>1612</span><i /><span>1613</span></div><div className="art-caption"><span className="gold-dot" /> СМУТНОЕ ВРЕМЯ <ArrowDownRight size={15} /></div><div className="art-side-label">РУССКОЕ ЦАРСТВО</div></div>
    <div className="hero-bottom"><div><strong>01—04</strong><span>ключевые главы</span></div><div><strong>10</strong><span>авторских тестов</span></div><div><strong>03</strong><span>олимпиады</span></div><span className="hero-bottom-seal"><History size={20} /></span></div>
  </section>
  <section className="section feature-section"><div className="section-heading"><div><span className="eyebrow">ВАШ МАРШРУТ</span><h2>Учитесь в своём ритме</h2></div><p>Три формата — одно большое путешествие<br />по истории страны.</p></div><div className="feature-grid"><button className="feature-card" onClick={() => user ? nav('tests') : setLoginRole('student')}><span className="feature-number">01</span><span className="feature-icon"><Target /></span><h3>Тесты</h3><p>Закрепляйте знания и сразу узнавайте результат.</p><span className="feature-link">Перейти к тестам <ArrowRight size={15} /></span></button><button className="feature-card" onClick={() => user ? nav('olympiads') : setLoginRole('student')}><span className="feature-number">02</span><span className="feature-icon"><Trophy /></span><h3>Олимпиады</h3><p>Задания повышенной сложности для пытливых умов.</p><span className="feature-link">Испытать себя <ArrowRight size={15} /></span></button><button className="feature-card" onClick={() => nav('textbook')}><span className="feature-number">03</span><span className="feature-icon"><BookOpen /></span><h3>Учебник</h3><p>Конспекты, даты и личности — всё важное в одном месте.</p><span className="feature-link">Открыть материалы <ArrowRight size={15} /></span></button></div></section>
  <section className="quote-banner"><span className="quote-mark">“</span><blockquote>История — это фонарь из прошлого,<br />который светит в будущее.</blockquote><span className="quote-attribution">— ВАСИЛИЙ КЛЮЧЕВСКИЙ</span><History className="quote-watermark" /></section>
  <section className="section topics-section"><div className="section-heading"><div><span className="eyebrow">ПЕРВАЯ ЧЕТВЕРТЬ</span><h2>От Смуты к новой династии</h2></div><button className="text-link" onClick={() => nav('textbook')}>Весь учебник <ArrowRight size={15} /></button></div><div className="topic-row">{textbook.slice(0, 3).map((topic, i) => <button className="topic-item" key={topic.title} onClick={() => nav('textbook')}><span className="topic-date">{['1598—1605', '1605—1611', '1611—1618'][i]}</span><b>{topic.title.replace(/^\d+\.\s*/, '')}</b><span className="topic-arrow"><ArrowRight size={15} /></span></button>)}</div></section>
  </main>

  const renderAssessmentList = (olympiad = false) => <main className="page-shell"><section className="page-intro"><div><span className="eyebrow">{olympiad ? 'ПРОВЕРЬТЕ СВОИ ГРАНИЦЫ' : 'ПЕРВАЯ ЧЕТВЕРТЬ · 10 РАБОТ'}</span><h1>{olympiad ? 'Олимпиады' : 'Тесты и проверочные'}</h1><p>{olympiad ? 'Задачи, где важны не только факты, но и умение мыслить исторически.' : 'Каждая работа — короткая остановка, чтобы лучше понять эпоху.'}</p></div><div className="intro-stamp">{olympiad ? <Trophy /> : <Target />}<span>{olympiad ? '3 уровня' : `${assessments.reduce((total, assessment) => total + assessment.questions.length, 0)} вопросов`}</span></div></section><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по темам и разделам" /><span>⌘ K</span></div><section className="assessment-grid">{(olympiad ? olympiads : assessments).filter((item) => `${item.title} ${item.unit}`.toLowerCase().includes(search.toLowerCase())).map(assessmentCard)}</section></main>

  const renderTextbook = () => <main className="page-shell"><section className="page-intro textbook-intro"><div><span className="eyebrow">КРАТКИЙ КУРС · ПЕРВАЯ ЧЕТВЕРТЬ</span><h1>Учебник эпохи</h1><p>Сжатые конспекты по темам курса: контекст, хронология и главные участники событий.</p></div><div className="intro-stamp"><BookOpen /><span>4 темы</span></div></section><div className="textbook-layout"><aside className="textbook-nav glass-card"><span className="eyebrow">СОДЕРЖАНИЕ</span>{textbook.map((chapter, index) => <a href={`#chapter-${index}`} key={chapter.title}><span>0{index + 1}</span>{chapter.title.replace(/^\d+\.\s*/, '')}</a>)}</aside><section className="chapters">{textbook.map((chapter, index) => <article className="chapter-card glass-card" id={`chapter-${index}`} key={chapter.title}><div className="chapter-head"><span className="chapter-number">ГЛАВА 0{index + 1}</span><span className="chapter-deco"><History size={19} /></span></div><h2>{chapter.title}</h2><p className="chapter-summary">{chapter.summary}</p><div className="chapter-columns"><div><h4>Хронология</h4>{chapter.dates.map((date) => <p className="bullet-row" key={date}><span className="gold-dot" />{date}</p>)}</div><div><h4>Термины и личности</h4>{chapter.terms.map((term) => <p className="glossary-entry" key={term}>{term}</p>)}<p className="people-list"><b>Личности:</b> {chapter.people.join(' · ')}</p></div></div><a className="source-note" href={sourceLinks[index % sourceLinks.length].url} target="_blank" rel="noreferrer">Материал подготовлен по программе курса <ArrowRight size={13} /></a></article>)}</section></div><section className="sources-panel glass-card"><h3>Источники и программа</h3><p className="muted">Материалы составлены по тематике первой четверти курса истории России для 7 класса. Состав учебника и последовательность тем могут отличаться в зависимости от года издания и календарного планирования школы.</p><div className="source-links">{sourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ArrowRight size={14} /></a>)}</div></section></main>

  const renderProfile = () => {
    if (!user) return <main className="page-shell"><section className="empty-state glass-card"><UserRound size={34} /><h2>Войдите в профиль</h2><p>Выберите роль, чтобы увидеть прогресс и личные результаты.</p><button className="button button-gold" onClick={() => setLoginRole('student')}>Войти как ученик</button></section></main>
    if (user.role === 'teacher') return renderTeacher()
    const mine = results.filter((result) => result.student === user.name)
    const average = mine.length ? Math.round(mine.reduce((sum, result) => sum + result.score / result.total * 100, 0) / mine.length) : 0
    const completedIds = new Set(mine.map((result) => result.assessment))
    return <main className="page-shell"><section className="profile-hero glass-card"><div className="profile-avatar">{user.name[0]}</div><div><span className="eyebrow">ЛИЧНЫЙ ПРОФИЛЬ</span><h1>{user.name}</h1><p className="muted">Ученик · история России, 7 класс</p></div><div className="profile-stat"><b>{average}%</b><span>средний результат</span></div><div className="profile-stat"><b>{completedIds.size}<small>/{assessments.length + olympiads.length}</small></b><span>работ пройдено</span></div></section><section className="dashboard-grid"><article className="glass-card progress-card"><div className="section-heading compact"><div><span className="eyebrow">ВАШ ПРОГРЕСС</span><h2>Путь обучения</h2></div><Award className="gold-icon" /></div><div className="progress-overview"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ value: completedIds.size || 0.01 }, { value: Math.max(assessments.length + olympiads.length - completedIds.size, 0.01) }]} innerRadius={67} outerRadius={80} dataKey="value" stroke="none" startAngle={90} endAngle={-270}><Cell fill={PALETTE[0]} /><Cell fill={PALETTE[1]} /></Pie></PieChart></ResponsiveContainer><div className="donut-label"><b>{completedIds.size}</b><span>работ</span></div></div><div><h3>Хорошее начало</h3><p className="muted">Каждая пройденная тема добавляет уверенности. Продолжайте в своём темпе.</p><div className="mini-progress"><span style={{ width: `${Math.max(completedIds.size / 13 * 100, 2)}%` }} /></div><small>{completedIds.size} из 13 работ</small></div></div></article><article className="glass-card profile-next"><span className="feature-icon"><Sparkles /></span><span className="eyebrow">СЛЕДУЮЩИЙ ШАГ</span><h2>Продолжим исследование?</h2><p className="muted">Выберите новую тему и получите обратную связь сразу после ответа.</p><button className="button button-gold" onClick={() => nav('tests')}>К тестам <ArrowRight size={16} /></button></article></section><section className="section"><div className="section-heading"><div><span className="eyebrow">ИСТОРИЯ ПОПЫТОК</span><h2>Ваши результаты</h2></div></div><ResultsTable results={mine} /></section></main>
  }

  function renderTeacher() {
    const teacherResults = results.filter((result) =>
      (filterStudent === 'Все ученики' || result.student === filterStudent) &&
      (filterTest === 'Все работы' || result.assessment === filterTest) &&
      (!filterDate || result.date >= filterDate))
    const names = accounts.filter((account) => account.role === 'student').map((account) => account.name)
    const average = teacherResults.length ? Math.round(teacherResults.reduce((sum, result) => sum + result.score / result.total * 100, 0) / teacherResults.length) : 0
    const completeByStudent = names.map((name) => ({ name, done: new Set(results.filter((result) => result.student === name).map((result) => result.assessment)).size }))
    const rankedStudents = names.map((name) => {
      const studentResults = teacherResults.filter((result) => result.student === name)
      return {
        name,
        count: studentResults.length,
        average: studentResults.length
          ? studentResults.reduce((sum, result) => sum + result.score / result.total, 0) / studentResults.length
          : 0,
      }
    }).filter((student) => student.count > 0).sort((a, b) => b.average - a.average)
    const best = rankedStudents[0]?.name ?? null
    const filtered = teacherResults
    return <main className="page-shell"><section className="page-intro"><div><span className="eyebrow">КАБИНЕТ ПРЕПОДАВАТЕЛЯ</span><h1>Здравствуйте, {user?.name}</h1><p>Общая картина успеваемости и индивидуальный прогресс класса.</p></div><div className="intro-stamp"><Users /><span>{names.length} ученика</span></div></section><section className="teacher-stats"><article className="stat-card glass-card"><span className="stat-icon"><Users /></span><span className="eyebrow">ПОПЫТОК</span><b>{teacherResults.length}</b><small>сохранённых результатов</small></article><article className="stat-card glass-card"><span className="stat-icon"><Target /></span><span className="eyebrow">СРЕДНИЙ БАЛЛ</span><b>{average}%</b><small>по выбранным результатам</small></article><article className="stat-card glass-card"><span className="stat-icon"><Trophy /></span><span className="eyebrow">ЛИДЕР КЛАССА</span><b className="stat-name">{best ?? '—'}</b><small>по среднему проценту</small></article></section><section className="dashboard-grid teacher-charts"><article className="glass-card chart-card"><div className="section-heading compact"><div><span className="eyebrow">ВЫПОЛНЕНИЕ ПРОГРАММЫ</span><h2>Работы по ученикам</h2></div></div>{completeByStudent.map((student) => <div className="student-progress" key={student.name}><div><b>{student.name}</b><span>{student.done} из 13</span></div><div className="mini-progress"><span style={{ width: `${student.done / 13 * 100}%` }} /></div></div>)}</article><article className="glass-card chart-card chart-donut"><div className="section-heading compact"><div><span className="eyebrow">РАСПРЕДЕЛЕНИЕ ОЦЕНОК</span><h2>Успеваемость</h2></div></div><div className="chart-content"><ResponsiveContainer width="55%" height={190}><PieChart><Pie data={['5','4','3','2'].map((grade) => ({ name: `Оценка ${grade}`, value: teacherResults.filter((result) => result.grade === grade).length || (grade === '2' ? 0.1 : 0) }))} innerRadius={52} outerRadius={76} paddingAngle={5} dataKey="value"><Cell fill="#d4af37" /><Cell fill="#7185a3" /><Cell fill="#956ea6" /><Cell fill="#a85c54" /></Pie><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }} /></PieChart></ResponsiveContainer><div className="grade-legend">{['5','4','3','2'].map((grade, i) => <span key={grade}><i style={{ background: ['#d4af37','#7185a3','#956ea6','#a85c54'][i] }} />Оценка {grade}<b>{teacherResults.filter((result) => result.grade === grade).length}</b></span>)}</div></div></article></section><section className="section results-section"><div className="section-heading"><div><span className="eyebrow">ЖУРНАЛ РЕЗУЛЬТАТОВ</span><h2>Работы класса</h2></div><span className="muted">{filtered.length} записей</span></div><div className="filters"><label>Ученик<select value={filterStudent} onChange={(event) => setFilterStudent(event.target.value)}><option>Все ученики</option>{names.map((name) => <option key={name}>{name}</option>)}</select></label><label>Работа<select value={filterTest} onChange={(event) => setFilterTest(event.target.value)}><option>Все работы</option>{[...assessments, ...olympiads].map((assessment) => <option value={assessment.id} key={assessment.id}>{assessment.title}</option>)}</select></label><label>Начиная с<input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></label><button className="button button-outline button-clear" onClick={() => { setFilterStudent('Все ученики'); setFilterTest('Все работы'); setFilterDate('') }}>Сбросить фильтры</button></div><ResultsTable results={filtered} /></section><section className="section"><div className="section-heading"><div><span className="eyebrow">КОНТРОЛЬ ПРОГРАММЫ</span><h2>Пройденные и ожидающие работы</h2></div></div><div className="coverage-grid">{names.map((name) => { const passed = new Set(results.filter((result) => result.student === name).map((result) => result.assessment)); return <article className="coverage-card glass-card" key={name}><b>{name}</b><span>{passed.size} / 13 работ</span><div className="coverage-tags">{[...assessments, ...olympiads].map((item) => <span className={passed.has(item.id) ? 'done-tag' : ''} title={item.title} key={`${name}-${item.id}`}>{passed.has(item.id) ? <Check size={12} /> : <Clock3 size={12} />}{item.title.replace('Проверочная работа ', '#')}</span>)}</div></article> })}</div></section></main>
  }

  const renderQuiz = () => {
    if (!active || !currentQuestion) return null
    if (showResult) {
      const percentage = Math.round(computedScore / active.questions.length * 100)
      const correctQuestions = active.questions.map((question, index) => ({ question, correct: answersMatch(question, answers[index]) }))
      return <main className="page-shell"><section className="result-hero glass-card"><button className="back-link" onClick={() => nav(active.olympiad ? 'olympiads' : 'tests')}><ArrowLeft size={15} /> К списку работ</button><div className="result-seal"><Award size={35} /></div><span className="eyebrow">РАБОТА ЗАВЕРШЕНА</span><h1>Ваш результат</h1><div className="result-score">{computedScore}<span>/{active.questions.length}</span></div><div className="result-grade">Оценка <b>{getGrade(percentage)}</b> <span>·</span> {percentage}%</div><div className="result-grade-scale"><span>90–100% · 5</span><span>75–89% · 4</span><span>60–74% · 3</span><span>0–59% · 2</span></div></section><section className="section explanations"><div className="section-heading"><div><span className="eyebrow">РАЗБОР ОТВЕТОВ</span><h2>Что важно запомнить</h2></div></div>{correctQuestions.map(({ question, correct }, index) => <article className={`explanation-card glass-card ${correct ? 'answer-correct' : 'answer-wrong'}`} key={index}><span className="explanation-number">{String(index + 1).padStart(2,'0')}</span><div><h3>{question.prompt}</h3><p><b>Правильный ответ:</b> {Array.isArray(question.answer) ? question.answer.join('; ') : question.answer}</p><p className="muted">{question.explanation}</p></div><span className="explanation-mark">{correct ? <Check /> : <X />}</span></article>)}</section></main>
    }
    return <main className="page-shell quiz-shell"><button className="back-link" onClick={() => nav(active.olympiad ? 'olympiads' : 'tests')}><ArrowLeft size={15} /> Назад к работам</button><section className="quiz-progress-head"><div><span className="eyebrow">{active.olympiad ? 'ОЛИМПИАДА' : 'ПРОВЕРОЧНАЯ РАБОТА'}</span><h1>{active.title}</h1></div><span className="question-count">{String(questionIndex + 1).padStart(2,'0')} <i>/</i> {String(active.questions.length).padStart(2,'0')}</span></section><div className="quiz-progress"><span style={{ width: `${(questionIndex + 1) / active.questions.length * 100}%` }} /></div><section className="question-card glass-card"><div className="question-top"><span className="pill">{formatQuestionType(currentQuestion.type)}</span><span className="question-points">1 балл</span></div><h2>{currentQuestion.prompt}</h2>{renderQuestionInput(currentQuestion, questionIndex)}<div className="quiz-navigation"><button className="button button-outline" disabled={questionIndex === 0} onClick={() => setQuestionIndex(questionIndex - 1)}><ArrowLeft size={16} /> Назад</button>{questionIndex < active.questions.length - 1 ? <button className="button button-gold" onClick={() => setQuestionIndex(questionIndex + 1)}>Далее <ArrowRight size={16} /></button> : <button className="button button-gold" onClick={finishAssessment}>Завершить работу <Check size={16} /></button>}</div></section><p className="quiz-hint"><ShieldCheck size={15} /> Результат проверяется автоматически и сохраняется в профиле.</p></main>
  }

  const pageContent = page === 'home' ? renderHome() : page === 'tests' ? renderAssessmentList() : page === 'olympiads' ? renderAssessmentList(true) : page === 'textbook' ? renderTextbook() : page === 'profile' ? renderProfile() : page === 'assessment' ? renderQuiz() : renderHome()
  return <div className={`app ${theme}`}><div className="ambient ambient-one" /><div className="ambient ambient-two" />{startHeader}{pageContent}{footer}{loginModal}</div>
}

function ResultsTable({ results }: { results: Result[] }) {
  if (!results.length) return <div className="empty-table glass-card"><BookOpen size={22} /><span>Пока нет результатов. Пройдите работу, чтобы увидеть здесь свой прогресс.</span></div>
  return <div className="results-table-wrap glass-card"><table className="results-table"><thead><tr><th>Ученик</th><th>Работа</th><th>Результат</th><th>Оценка</th><th>Дата</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}><td><span className="table-avatar">{result.student[0]}</span>{result.student}</td><td>{result.title}</td><td><div className="score-cell"><b>{result.score}/{result.total}</b><span className="mini-progress"><span style={{ width: `${result.score/result.total*100}%` }} /></span></div></td><td><span className={`grade-badge grade-${result.grade}`}>{result.grade}</span></td><td>{new Date(`${result.date}T12:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'})}</td></tr>)}</tbody></table></div>
}

export default App
