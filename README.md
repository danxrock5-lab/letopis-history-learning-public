# Летопись — всеобщая история, 7 класс

Школьная платформа с тестами, олимпиадами, конспектами и кабинетами ученика и учителя. Материалы охватывают §§ 11–15 учебника В. Р. Мединского и А. О. Чубарьяна «История. Всеобщая история. История Нового времени. Конец XV–XVII век», 7 класс (издание 2025): Англия, Речь Посполитая и международные отношения. Задания и пояснения написаны самостоятельно, а не скопированы из учебника.

## Быстрый запуск демо

```bash
npm ci
npm run dev
```

В локальном демо четыре пробные учётные записи и результаты в `localStorage`:

| Роль | Имя | Пароль |
| --- | --- | --- |
| Учитель | Учитель | `teacher-demo` |
| Ученик | Ученик 1 | `student1-demo` |
| Ученик | Ученик 2 | `student2-demo` |
| Ученик | Ученик 3 | `student3-demo` |

**Демо-режим не предназначен для выставления защищённых оценок.** В браузерной версии ключи нужны только для локальной демонстрации, а данные остаются на устройстве. Для реальных ученических аккаунтов используйте серверный режим ниже.

## Серверный режим

Express API оценивает ответы на сервере, хранит результаты в SQLite и не отправляет ключи ответов в каталог тестов. Пароли хешируются через scrypt; сессии хранятся как хеши случайных токенов и выдаются в HttpOnly/SameSite cookies; изменяющие запросы защищены CSRF- и Origin-проверками. Добавлены лимиты запросов, security headers, серверная проверка роли и входных данных, ограничение размера JSON и постоянный диск в Render Blueprint.

### Развёртывание на Render

1. Создайте Render Web Service из этого репозитория и выберите Blueprint по `render.yaml`.
2. Задайте секретные переменные `INITIAL_ADMIN_NAME` и `INITIAL_ADMIN_PASSWORD` (пароль минимум 12 символов). Не помещайте секреты в Git, README, CI-логи или клиентский код.
3. Убедитесь, что `APP_ORIGIN` соответствует публичному HTTPS-адресу сервиса. Blueprint задаёт адрес по умолчанию; измените его, если Render присвоил другой домен.
4. Проверьте `https://<адрес-сервиса>/api/health`, затем войдите под первым учителем и создайте ученические аккаунты из панели преподавателя.
5. Подключите постоянный диск по `/data`. База не должна размещаться на эфемерной файловой системе контейнера.

Render Blueprint подготавливает конфигурацию, но **сам по себе не создаёт сервис в аккаунте Render**. Серверный режим не считается развёрнутым, пока ресурс не создан и переменные окружения не заданы.

### Локальный API

Создайте локальный `.env` (файл игнорируется Git) и задайте:

```env
INITIAL_ADMIN_NAME=Teacher
INITIAL_ADMIN_PASSWORD=replace-with-a-unique-password-at-least-12-chars
APP_DB_PATH=./data/letopis.sqlite
PORT=3001
```

Запустите API:

```bash
npm start
```

Для локального Vite-клиента в PowerShell включите API-флаг и запустите Vite в отдельном терминале:

```powershell
$env:VITE_API_ENABLED = 'true'
npm run dev
```

Vite проксирует `/api` на `localhost:3001`. Для production-клиента Dockerfile уже собирает приложение с `VITE_API_ENABLED=true` и корневым URL-путём.

Учитель может добавить ученика из панели преподавателя. Для административного создания из командной строки доступна команда `npm run user:add`; пароль вводится в терминале и не сохраняется в открытом виде в базе.

## Учебные материалы и источники

- [Официальная карточка учебника 2025 года — издательство «Просвещение»](https://prosv.ru/product/istoriya-vseobschaya-istoriya-istoriya-novogo-vremeni-konets-xv-xvii-vek-7-klass-uchebnik01/)
- [§ 11 — Англия в XVI — начале XVII века](https://7класс.рф/vseobshhaja-istorija-otvety-po-11/)
- [§ 12 — Век революций в Англии](https://7класс.рф/vseobshhaja-istorija-otvety-po-12/)
- [§ 13 — Сила и слабость Речи Посполитой](https://7класс.рф/vseobshhaja-istorija-otvety-po-13/)
- [§§ 14–15 — Международные отношения в XVI–XVII веках](https://7класс.рф/vseobshhaja-istorija-otvety-po-14/)
- [Английская революция — UK Parliament](https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/revolution/)
- [Билль о правах 1689 года — UK Parliament](https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/revolution/collections1/collections-glorious-revolution/billofrights/)
- [Тридцатилетняя война — Encyclopaedia Britannica](https://www.britannica.com/event/Thirty-Years-War)
- [Вестфальский мир — Encyclopaedia Britannica](https://www.britannica.com/event/Peace-of-Westphalia)
- [История Польши — Encyclopaedia Britannica](https://www.britannica.com/place/Poland/History)

Точное распределение тем по четвертям может различаться по школьному календарному плану.

## Проверки

```bash
npm run build
npm run test:api
npm audit --omit=dev
```

## GitHub Pages

GitHub Pages остаётся статической демонстрацией и не может запускать Express или SQLite. Для защищённого входа и серверного оценивания размещайте SPA вместе с API на Render/Docker; не используйте GitHub Pages как реальный журнал оценок.

Исходный код: [danxrock5-lab/letopis-history-learning-public](https://github.com/danxrock5-lab/letopis-history-learning-public).
