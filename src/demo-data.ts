import { assessments, olympiads } from '../shared/assessments.js'

export { assessments, olympiads }

type DemoAccount = { name: string; role: 'teacher' | 'student'; password: string }
export const accounts: DemoAccount[] = [
  { name: 'Учитель', role: 'teacher', password: 'teacher-demo' },
  { name: 'Ученик 1', role: 'student', password: 'student1-demo' },
  { name: 'Ученик 2', role: 'student', password: 'student2-demo' },
  { name: 'Ученик 3', role: 'student', password: 'student3-demo' },
]
