# Sales Campaign Import Mapping

Источник: `../deal_worker/assets/sales_campaigns/2026-04-21_four_objects/05_crm/`

## Mapping

### `companies.csv` + `contacts.csv` -> `broker_clients`

В `deal_flow_service` нет отдельной таблицы контактов компании, поэтому импорт делает 1 `broker_client` на 1 компанию.

Поля:
- `broker_clients.full_name` <- primary contact full name, иначе company name
- `broker_clients.company` <- `company_name`
- `broker_clients.email` <- primary contact email
- `broker_clients.phone` <- primary contact phone
- `broker_clients.lead_source` <- `sales_campaign:<campaign_id>:<company_id>`
- `broker_clients.regions_of_interest` <- уникальные регионы по сделкам компании
- `broker_clients.asset_types_of_interest` <- уникальные asset types по сделкам компании
- `broker_clients.notes` <- fit notes + source url + список известных контактов

### `deals.csv` -> `broker_deals`

1 строка `05_crm/deals.csv` = 1 `broker_deal`.

Поля:
- `title` <- `<object_name> — <company_name>`
- `stage` <- mapped stage
- `priority` <- derived from crm stage
- `next_step` <- `next_action`
- `last_contact_at` <- `last_event_date`
- `deal_notes` <- source ids + notes + known contacts
- `is_archived` <- `true` only for `not_fit`

### `outreach_events.csv` -> `broker_deal_activities`

Импортируются все события по сделке.

Mapping activity type:
- `first_touch`, `followup_1` -> `message`
- `materials_request`, `positive_interest`, `not_fit_current_criteria`, `redirect_to_other_contact`, `forwarded_internal` -> `feedback`
- `bounce`, `contact_form_only` -> `note`

Для идемпотентности в `payload.source_event_id` хранится ID события источника.

## Stage Mapping

- `prospect_not_contacted` -> `new_lead`
- `needs_alt_contact` -> `new_lead`
- `first_touch_sent` -> `contacted`
- `followup_1_sent` -> `contacted`
- `redirected` -> `contacted`
- `under_review` -> `qualified`
- `interested` -> `qualified`
- `materials_requested` -> `objects_sent`
- `not_fit` -> `lost`

## Import Command

Dry run:

```bash
cd Apps/deal_flow_service
node --import tsx scripts/import_sales_campaign_crm.ts
```

Apply:

```bash
cd Apps/deal_flow_service
node --import tsx scripts/import_sales_campaign_crm.ts --apply
```
