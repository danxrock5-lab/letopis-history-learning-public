export type Question = {
  type: 'single' | 'multi' | 'text' | 'date' | 'match'
  prompt: string
  options?: string[]
  answer?: string | string[]
  explanation?: string
  pairs?: { label: string; options: string[]; answer?: string }[]
}

export type Assessment = {
  id: string
  title: string
  unit: string
  description: string
  questions: Question[]
  olympiad?: boolean
}

export const getGrade = (percentage: number) =>
  percentage >= 90 ? '5' : percentage >= 75 ? '4' : percentage >= 60 ? '3' : '2'

export const formatQuestionType = (type: Question['type']) => ({
  single: 'Один ответ',
  multi: 'Несколько ответов',
  text: 'Короткий ответ',
  date: 'Хронология',
  match: 'Соответствие',
})[type]

export const sourceLinks = [
  { label: 'Учебник 2025 · Мединский, Чубарьян, 7 класс', url: 'https://prosv.ru/product/istoriya-vseobschaya-istoriya-istoriya-novogo-vremeni-konets-xv-xvii-vek-7-klass-uchebnik01/' },
  { label: 'Английская революция · UK Parliament', url: 'https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/revolution/' },
  { label: 'История Польши · Encyclopaedia Britannica', url: 'https://www.britannica.com/place/Poland/History' },
  { label: 'Тридцатилетняя война · Encyclopaedia Britannica', url: 'https://www.britannica.com/event/Thirty-Years-War' },
  { label: 'Оглавление и нумерация тем · Всеобщая история, 7 класс', url: 'https://7класс.рф/vseobshhaja-istorija-otvety-po-11/' },
  { label: '§ 12 · Век революций в Англии', url: 'https://7класс.рф/vseobshhaja-istorija-otvety-po-12/' },
  { label: '§ 13 · Сила и слабость Речи Посполитой', url: 'https://7класс.рф/vseobshhaja-istorija-otvety-po-13/' },
  { label: '§§ 14–15 · Международные отношения в XVI–XVII веках', url: 'https://7класс.рф/vseobshhaja-istorija-otvety-po-14/' },
  { label: 'История Англии · Encyclopaedia Britannica', url: 'https://www.britannica.com/place/United-Kingdom/History' },
  { label: 'Билль о правах 1689 года · UK Parliament', url: 'https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/revolution/collections1/collections-glorious-revolution/billofrights/' },
  { label: 'Вестфальский мир · Encyclopaedia Britannica', url: 'https://www.britannica.com/event/Peace-of-Westphalia' },
]

export const textbook = [
  {
    title: '§ 11. Англия в XVI — начале XVII века',
    date: '1485–1625',
    summary: 'Укрепление власти Тюдоров, английская Реформация и утверждение англиканской церкви, политика Елизаветы I, перемены в хозяйстве и обществе, переход короны к Стюартам.',
    terms: ['Тюдоры', 'англиканская церковь', 'огораживания', 'протекционизм', 'абсолютизм'],
    people: ['Генрих VIII', 'Елизавета I', 'Яков I', 'Мария Стюарт'],
    dates: ['1534 — Акт о супрематии', '1588 — разгром испанской Армады', '1603 — начало правления Стюартов'],
  },
  {
    title: '§ 12. Век революций в Англии',
    date: '1625–1689',
    summary: 'Конфликт короны и парламента, гражданская война, республика и протекторат Кромвеля, реставрация Стюартов и переход к ограниченной монархии.',
    terms: ['Долгий парламент', 'кавалеры', 'круглоголовые', 'протекторат', 'конституционная монархия'],
    people: ['Карл I', 'Оливер Кромвель', 'Карл II', 'Вильгельм III Оранский'],
    dates: ['1640 — созыв Долгого парламента', '1642–1651 — гражданские войны', '1649 — казнь Карла I', '1660 — реставрация монархии', '1688–1689 — Славная революция и Билль о правах'],
  },
  {
    title: '§ 13. Сила и слабость Речи Посполитой',
    date: 'XVI–XVII века',
    summary: 'Особое устройство сословной республики, ведущая роль шляхты и сейма, выборность короля, а также внутренние конфликты и войны, ослаблявшие государство.',
    terms: ['шляхта', 'сейм', 'элекционная монархия', 'liberum veto', 'Речь Посполитая'],
    people: ['Ян II Казимир', 'Богдан Хмельницкий', 'Ян III Собеский'],
    dates: ['1569 — Люблинская уния', '1648 — начало восстания под руководством Хмельницкого', '1655–1660 — война со Швецией', '1667 — Андрусовское перемирие'],
  },
  {
    title: '§ 14–15. Международные отношения в XVI–XVII веках',
    date: 'XVI–XVII века',
    summary: 'Соперничество европейских держав, Реформация и религиозные войны, Тридцатилетняя война и становление системы межгосударственных отношений после Вестфальского мира.',
    terms: ['гегемония', 'коалиция', 'Тридцатилетняя война', 'Вестфальская система', 'баланс сил'],
    people: ['Карл V', 'Густав II Адольф', 'Арман Жан дю Плесси Ришельё'],
    dates: ['1618–1648 — Тридцатилетняя война', '1648 — Вестфальский мир'],
  },
]
