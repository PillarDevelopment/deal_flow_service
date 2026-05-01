# Deal Flow Service

Отдельный сервис брокерского CRM-контура Sector8Estate.

Важно: сервис работает в той же Supabase-базе, что и `deal_worker`. Отдельную базу создавать не нужно.

Сервис отвечает за:
- клиентов брокера;
- сделки и воронку;
- связь сделки с объектами из каталога `properties`;
- timeline активностей;
- общий справочник компаний для отбора target lists;
- страницу `/broker`.

`properties` остаются в общей Supabase-базе и используются как единый каталог объектов. Этот сервис не владеет каталогом и не изменяет объекты.

## Запуск

```bash
npm install
npm run dev
```

По умолчанию сервис слушает `PORT=3010`.

В локальном dev-контуре обычно запускаются два процесса:

```bash
# terminal 1
cd ../deal_worker
npm run dev

# terminal 2
cd ../deal_flow_service
npm run dev
```

Ожидаемые адреса:

- `deal_worker`: `http://localhost:3000/app`
- `deal_flow_service`: `http://localhost:3010/broker`

## ENV

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
PORT=3010
DEAL_WORKER_BASE_URL=http://localhost:3000
```

`SUPABASE_ANON_KEY` нужен для проверки пользовательского bearer token через Supabase Auth.

`DEAL_WORKER_BASE_URL` используется UI `/broker` для ссылок обратно в каталог и карточки объектов.

## Auth flow

Первая версия доступна только `super_admin`.

1. Пользователь логинится в основной платформе `deal_worker`.
2. UI `deal_worker` сохраняет Supabase access token как `platform_token` в `localStorage`.
3. `/broker` читает тот же `platform_token` и отправляет API-запросы с заголовком:

```text
Authorization: Bearer <platform_token>
```

4. `deal_flow_service` проверяет token через `SUPABASE_ANON_KEY`.
5. Затем сервис читает роль из общей таблицы `user_roles`.
6. Если роль не `super_admin`, API возвращает `403`.

## База данных

Применить в той же Supabase-базе, где уже лежат `properties`, `user_roles` и пользователи платформы:

```text
supabase/schema.sql
```

Скрипт добавляет только CRM-таблицы `broker_*` и связь `broker_deal_properties.property_id -> properties.id`.

Минимальный контракт схемы:

- `broker_clients` хранит клиентов и интересы брокера.
- `broker_deals` хранит сделки, стадии, `next_step` и дедлайны.
- `broker_deal_properties` хранит только связь сделки с объектом из `properties` и deal-specific статус.
- `broker_deal_activities` хранит timeline сделки.
- `broker_campaigns` хранит объектные outbound-кампании.
- `broker_campaign_briefs` хранит snapshot брифа и объекта на момент создания кампании.
- `broker_campaign_hypotheses` хранит ICP-гипотезы и их согласование.
- `broker_campaign_targets`, `broker_message_*`, `broker_send_*`, `broker_mailboxes`, `broker_quota_windows`, `broker_amo_exports` и `broker_approvals` задают будущий контур отправок, квот, аналитики и AMO outbox.
- `broker_company_directory` хранит единую импортированную базу компаний и не смешивается с `broker_clients`.
- `properties` остается таблицей каталога во владении `deal_worker`; этот сервис ее не изменяет.

## Routes

- `GET /health`
- `GET /broker`
- `GET /broker/me`
- `GET /broker/clients`
- `POST /broker/clients`
- `GET /broker/clients/:id`
- `PATCH /broker/clients/:id`
- `GET /broker/deals`
- `POST /broker/deals`
- `GET /broker/deals/:id`
- `PATCH /broker/deals/:id`
- `PATCH /broker/deals/:id/stage`
- `GET /broker/deals/:id/properties`
- `POST /broker/deals/:id/properties`
- `PATCH /broker/deal-properties/:id`
- `DELETE /broker/deal-properties/:id`
- `GET /broker/deals/:id/activities`
- `POST /broker/deals/:id/activities`
- `GET /broker/catalog/properties`
- `GET /broker/campaigns`
- `POST /broker/campaigns`
- `GET /broker/campaigns/:id`
- `PATCH /broker/campaigns/:id`
- `GET /broker/campaigns/:id/hypotheses`
- `POST /broker/campaigns/:id/hypotheses`
- `PATCH /broker/campaign-hypotheses/:id`
- `GET /broker/company-directory`
- `GET /broker/company-registry`

## Проверка MVP

Автоматическая проверка:

```bash
npm test
npm run build
```

Покрытые сценарии:

- отказ без bearer token;
- отказ для роли не `super_admin`;
- `GET /broker/me`;
- создание и поиск клиента;
- создание сделки;
- смена стадии сделки и запись `status_changed` в timeline;
- привязка объекта из `properties`;
- `GET /broker/deals/:id` с клиентом, linked objects и activities;
- catalog bridge только по `published` объектам.
- создание кампании по объекту;
- snapshot брифа кампании;
- создание и согласование ICP-гипотез.

Ручной smoke test с реальной Supabase-базой:

1. Применить `supabase/schema.sql` в той же базе, где работает `deal_worker`.
2. Запустить `deal_worker` на `3000`.
3. Запустить `deal_flow_service` на `3010`.
4. Зайти в `http://localhost:3000/app` под пользователем с ролью `super_admin`.
5. Открыть `http://localhost:3010/broker`.
6. Создать клиента.
7. Создать сделку.
8. Найти опубликованный объект из каталога.
9. Привязать объект к сделке.
10. Проверить, что в карточке сделки появились linked object и activity timeline.

## Import from sales_campaigns

Источник для импорта:

- `../deal_worker/assets/sales_campaigns/2026-04-21_four_objects/05_crm/`

Dry run:

```bash
node --import tsx scripts/import_sales_campaign_crm.ts
```

Apply:

```bash
node --import tsx scripts/import_sales_campaign_crm.ts --apply
```

Карта полей и стадий:

- `docs/sales_campaign_import.md`

## Import unified company base

Источник по умолчанию:

- `../deal_worker/bases/companies_may.csv`

Dry run:

```bash
node --import tsx scripts/import_company_directory.ts
```

Apply:

```bash
node --import tsx scripts/import_company_directory.ts --apply
```

Важно: импорт идет в `broker_company_directory`, а не в `broker_clients`.

## Production notes

- Сервис можно держать отдельным Node-процессом рядом с `deal_worker`.
- Рекомендуемый public route: проксировать `/broker` на `deal_flow_service`.
- API `/broker/*` должен получать тот же bearer token, что и основной app.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` и `SUPABASE_ANON_KEY` должны указывать на ту же Supabase-базу, что и `deal_worker`.
- `deal_flow_service` не должен получать отдельную базу и не должен писать в `properties`.

## CTO plan

Целевой контур экрана, модели данных и MVP-спринта зафиксирован в:

- [`docs/campaign_os_cto_plan.md`](./docs/campaign_os_cto_plan.md)

## Ограничения MVP

- Доступ только для `super_admin`.
- Нет телефонии, email automation и Telegram reminders.
- Нет мульти-брокерного access management.
- Нет аналитики конверсии по воронке.
- `/broker` UI пока остается рабочим MVP; расширение карточек клиента/сделки вынесено в следующий UX-спринт.
