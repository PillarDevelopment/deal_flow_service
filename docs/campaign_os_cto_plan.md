# Campaign Operating System CTO Plan

Дата: `2026-04-30`

Источник референсов экранов: `../refer/`

## Контекст

`deal_flow_service` должен стать не просто CRM, а операционной системой брокера для работы по объекту:

- принять бриф объекта;
- сформировать и согласовать гипотезы;
- собрать планы на месяц, неделю и день;
- сгенерировать письмо и цепочку follow-up / ping;
- запустить отправку с квотами и safety-guardrails;
- собрать статистику по Resend;
- выгрузить результат в AMO CRM.

`deal_worker` остается источником истины по объектам, брифам и каталогу.

## 1. Целевая карта экранов

### Навигация

Базовая навигация должна повторять сильные паттерны из `refer`, но быть адаптированной под брокерский поток:

- `Control Room` — глобальная операционная панель по всем объектам, кампаниям и лимитам.
- `Inbox` — очередь ответов, редиректов, пингов, ручных действий и триажа.
- `Campaigns` — список кампаний по объектам, их состояние, runway, send-rate и reply-rate.
- `Mailboxes` — пул ящиков, warming, deliverability, suppression и доменные ограничения.
- `Imports` — intake новых брифов, исторических кампаний, CSV, AMO sync.
- `Settings` — квоты, роли, шаблоны, policy rules, approval levels.

### Обязательные доменные экраны

#### `Object Workbench`

Экран одного объекта. На нем живут:

- бриф объекта;
- список гипотез;
- согласование гипотез;
- календарь отправок;
- письмо в текущей версии;
- цепочка follow-up и ping;
- linked contacts / companies;
- статус кампании;
- итоговая статистика.

#### `Hypothesis Studio`

Экран генерации и редактирования гипотез.

Основные блоки:

- сегменты ICP;
- каналы;
- обещание / angle;
- целевое действие;
- риск / блокер;
- статус согласования.

#### `Content Studio`

Экран редактирования текста.

Основные блоки:

- письмо первого касания;
- follow-up 1 / follow-up 2 / follow-up 3;
- ping variations;
- subject lines;
- preview before send;
- approve / reject / revise.

#### `Sequence Builder`

Экран конструирования цепочки.

Основные блоки:

- шаги по времени;
- условия перехода;
- стоп-условия;
- retry policy;
- suppression rules;
- split by object segment or mailbox pool.

#### `Quota Dashboard`

Экран контроля ограничений.

Нужно показывать:

- письма в день;
- письма в месяц;
- уникальные email в месяц;
- лимит по mailbox/domain;
- текущую загрузку;
- прогноз превышения;
- паузы и блокировки.

#### `Resend Analytics`

Экран результата кампании.

Нужно показывать:

- sent;
- delivered;
- bounced;
- suppressed;
- complained;
- redirected;
- replied positive;
- replied not fit;
- follow-up sent;
- reply rate;
- delivered rate;
- bounced rate;
- unique contacts reached.

#### `AMO Export Queue`

Экран выгрузки в AMO CRM.

Нужно показывать:

- какие сделки / лиды подготовлены;
- какие уже экспортированы;
- что требует ручного маппинга;
- что не прошло валидацию;
- что отправлено повторно.

## 2. Модель данных

Текущие таблицы `broker_clients`, `broker_deals`, `broker_deal_properties`, `broker_deal_activities` остаются базой CRM.

Для кампаний нужно добавить слой сущностей.

### Campaign core

#### `broker_campaigns`

Одна кампания на объект или на объект + крупный сегмент.

Поля:

- `id`
- `property_id`
- `campaign_name`
- `status` (`draft`, `needs_review`, `approved`, `scheduled`, `running`, `paused`, `completed`, `archived`)
- `objective`
- `start_date`
- `end_date`
- `owner_user_id`
- `created_at`
- `updated_at`

#### `broker_campaign_briefs`

Снимок входного брифа на момент запуска кампании.

Поля:

- `campaign_id`
- `property_snapshot`
- `original_brief`
- `attachments_snapshot`
- `source_version`
- `created_at`

### Hypotheses and audience

#### `broker_campaign_hypotheses`

Гипотезы по ICP / сегментам.

Поля:

- `campaign_id`
- `segment_name`
- `segment_type`
- `value_prop`
- `channel`
- `priority`
- `status` (`draft`, `approved`, `rejected`, `deprecated`)
- `reasoning`
- `created_by`

#### `broker_campaign_targets`

Контакты, которым можно отправлять.

Поля:

- `campaign_id`
- `company_name`
- `contact_name`
- `email`
- `source`
- `object_role`
- `domain`
- `status` (`eligible`, `sent`, `followed_up`, `suppressed`, `bounced`, `replied`)

### Content and sequence

#### `broker_message_threads`

Логическая цепочка сообщений по контакту.

Поля:

- `campaign_id`
- `target_id`
- `thread_type` (`first_touch`, `followup`, `ping`)
- `status`
- `current_step`
- `last_sent_at`
- `next_send_at`

#### `broker_message_versions`

Версии контента с возможностью редактирования.

Поля:

- `thread_id`
- `version_number`
- `subject`
- `body_html`
- `body_text`
- `tone`
- `status` (`draft`, `approved`, `scheduled`, `sent`, `failed`)
- `edited_by`
- `approved_by`

#### `broker_sequence_steps`

Отдельные шаги в цепочке.

Поля:

- `thread_id`
- `step_order`
- `delay_hours`
- `step_type` (`first_touch`, `followup`, `ping`)
- `template_version_id`
- `send_window`
- `stop_on_reply`
- `stop_on_bounce`
- `stop_on_suppression`

### Send execution

#### `broker_send_jobs`

Одна запись на одну попытку отправки.

Поля:

- `campaign_id`
- `thread_id`
- `message_version_id`
- `mailbox_id`
- `scheduled_at`
- `sent_at`
- `status`
- `provider_message_id`
- `provider_response`
- `error`

#### `broker_send_events`

Provider-level events from Resend.

Поля:

- `send_job_id`
- `event_type`
- `event_at`
- `payload`

### Mailboxes and quotas

#### `broker_mailboxes`

Пул отправителей.

Поля:

- `email`
- `domain`
- `status` (`active`, `warming`, `cooling`, `paused`, `quarantined`)
- `daily_cap`
- `monthly_cap`
- `unique_cap`
- `health_score`
- `last_seen_at`

#### `broker_quota_windows`

Агрегированные счетчики для дневного и месячного лимита.

Поля:

- `window_type` (`day`, `month`)
- `window_start`
- `sent_count`
- `unique_email_count`
- `active_campaign_count`

### AMO sync

#### `broker_amo_exports`

Outbox для AMO.

Поля:

- `campaign_id`
- `deal_id`
- `contact_id`
- `export_type`
- `payload`
- `status` (`pending`, `exported`, `failed`, `needs_review`)
- `external_id`
- `last_error`

### Audit and approvals

#### `broker_approvals`

Согласование человеком.

Поля:

- `entity_type`
- `entity_id`
- `approval_type` (`hypothesis`, `message`, `sequence`, `campaign`)
- `status` (`draft`, `needs_approval`, `approved`, `rejected`)
- `approver_user_id`
- `comment`

## 3. MVP Sprint

### Цель спринта

Сделать первый рабочий контур по одному объекту:

- объектный бриф;
- гипотезы;
- письмо первого касания;
- одна follow-up цепочка;
- план на месяц / неделю / день;
- запуск ограниченной кампании;
- получение Resend-статусов;
- базовый дашборд;
- черновой AMO export outbox.

### Scope first sprint

1. `Object Workbench`
   - карточка объекта;
   - бриф;
   - гипотезы;
   - статус кампании.
2. `Content Studio`
   - редактор first touch;
   - редактор follow-up;
   - approve / edit / revert.
3. `Sequence Builder`
   - шаги цепочки;
   - delay rules;
   - stop rules.
4. `Campaign Planner`
   - month / week / day view;
   - quota checks;
   - queue preview.
5. `Send Orchestrator`
   - schedule;
   - dispatch;
   - retry;
   - stop on bounce / reply / suppression.
6. `Resend Analytics`
   - sent / bounced / replied / suppressed;
   - breakdown by object.
7. `AMO Export Outbox`
   - pending export;
   - exported;
   - failed.

### Definition of done

Спринт закрыт, если:

- по одному объекту можно создать кампанию;
- можно сгенерировать и отредактировать письмо;
- можно собрать follow-up цепочку;
- можно пройти approval;
- можно поставить кампанию в расписание;
- можно отправить ограниченную партию;
- можно увидеть статусы по Resend;
- можно увидеть дневной / недельный / месячный план;
- можно увидеть готовность выгрузки в AMO.

## 4. Порядок реализации

### Phase A. Schema and state

- добавить таблицы кампаний, гипотез, контента, очередей, квот и outbox;
- определить статусы и переходы;
- зафиксировать idempotency keys;
- описать retention и suppression rules.

### Phase B. Object workbench

- связать объект из `deal_worker` с кампанией;
- дать создание кампании из объекта;
- показать гипотезы и статус approval;
- показать текущий план и ближайшие действия.

### Phase C. Content and sequence

- добавить редактор письма;
- добавить редактор follow-up и ping;
- сохранить версии;
- добавить ручное согласование;
- подключить шаблоны.

### Phase D. Execution and analytics

- подключить send queue;
- учитывать дневной и месячный лимит;
- принимать provider events;
- строить объектные и глобальные дашборды;
- писать AMO outbox.

### Risks

- риск перепутать CRM с campaign engine;
- риск допустить отправку сверх квоты;
- риск потерять связность между объектом, кампанией и отправкой;
- риск сделать UI только “табличным” без workflow;
- риск не зафиксировать suppression / bounce / reply как отдельные состояния.

### Mitigations

- все отправки только через явный campaign entity;
- quota check до постановки в send queue;
- immutable log of send jobs and provider events;
- approval gates before send;
- separate analytics model from CRM model.

## Вывод

`deal_flow_service` должен развиваться как брокерский campaign OS, а не как набор CRUD-таблиц.
Нужны экраны управления потоком, а не только карточки клиентов и сделок.
Референсы из `refer` подходят как язык интерфейса: плотный, операционный, с KPI, очередями и тревогами.
