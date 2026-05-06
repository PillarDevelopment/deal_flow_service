import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AmoCrmClient } from "../src/amocrm.js";
import { brokerApiRoutes } from "../src/routes/api.js";
import type { AppRole } from "../src/types.js";

type Row = Record<string, unknown>;
type TableName =
  | "user_roles"
  | "broker_clients"
  | "broker_deals"
  | "broker_deal_properties"
  | "broker_deal_activities"
  | "broker_campaigns"
  | "broker_campaign_briefs"
  | "broker_campaign_hypotheses"
  | "broker_campaign_targets"
  | "broker_company_directory"
  | "broker_company_playbooks"
  | "broker_message_threads"
  | "broker_message_versions"
  | "broker_sequence_steps"
  | "broker_send_jobs"
  | "broker_send_events"
  | "broker_mailboxes"
  | "broker_quota_windows"
  | "broker_amo_exports"
  | "broker_approvals"
  | "properties";

type Store = Record<TableName, Row[]>;

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ANALYST_ID = "00000000-0000-4000-8000-000000000002";
const PROPERTY_ID = "00000000-0000-4000-8000-000000000101";

test("broker API rejects missing and non-super-admin tokens", async () => {
  const app = await buildTestApp();

  const missing = await app.inject({ method: "GET", url: "/broker/me" });
  assert.equal(missing.statusCode, 401);

  const forbidden = await app.inject({
    method: "GET",
    url: "/broker/me",
    headers: { authorization: "Bearer analyst-token" },
  });
  assert.equal(forbidden.statusCode, 403);

  await app.close();
});

test("broker API supports client and deal MVP flow", async () => {
  const app = await buildTestApp();
  const headers = authHeaders();

  const me = await app.inject({ method: "GET", url: "/broker/me", headers });
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json(), {
    userId: SUPER_ADMIN_ID,
    email: "admin@example.com",
    role: "super_admin",
  });

  const createdClient = await app.inject({
    method: "POST",
    url: "/broker/clients",
    headers,
    payload: {
      fullName: " Иван Петров ",
      company: "Петров Инвест",
      email: "IVAN@EXAMPLE.COM",
      budgetFrom: "100000000",
      regionsOfInterest: [" Москва ", "Москва"],
    },
  });
  assert.equal(createdClient.statusCode, 201);
  const client = createdClient.json();
  assert.equal(client.full_name, "Иван Петров");
  assert.equal(client.email, "ivan@example.com");
  assert.equal(client.broker_user_id, SUPER_ADMIN_ID);
  assert.deepEqual(client.regions_of_interest, ["Москва"]);

  const clients = await app.inject({ method: "GET", url: "/broker/clients?q=Петров", headers });
  assert.equal(clients.statusCode, 200);
  assert.equal(clients.json().items.length, 1);

  const createdDeal = await app.inject({
    method: "POST",
    url: "/broker/deals",
    headers,
    payload: {
      clientId: client.id,
      title: "Сделка по складскому объекту",
      stage: "qualified",
      nextStep: "Отправить подборку",
      nextStepDueAt: "2026-04-24T12:00",
    },
  });
  assert.equal(createdDeal.statusCode, 201);
  const deal = createdDeal.json();
  assert.equal(deal.client_id, client.id);
  assert.equal(deal.stage, "qualified");
  assert.equal(deal.broker_user_id, SUPER_ADMIN_ID);

  const stageChanged = await app.inject({
    method: "PATCH",
    url: `/broker/deals/${deal.id}/stage`,
    headers,
    payload: { stage: "objects_sent" },
  });
  assert.equal(stageChanged.statusCode, 200);
  assert.equal(stageChanged.json().stage, "objects_sent");

  const activitiesAfterStage = await app.inject({
    method: "GET",
    url: `/broker/deals/${deal.id}/activities`,
    headers,
  });
  assert.equal(activitiesAfterStage.statusCode, 200);
  assert.equal(activitiesAfterStage.json().items[0].activity_type, "status_changed");

  const linkedProperty = await app.inject({
    method: "POST",
    url: `/broker/deals/${deal.id}/properties`,
    headers,
    payload: {
      propertyId: PROPERTY_ID,
      status: "sent",
      comment: "Подходит по бюджету",
      isPrimary: "true",
    },
  });
  assert.equal(linkedProperty.statusCode, 201);
  assert.equal(linkedProperty.json().property_id, PROPERTY_ID);
  assert.equal(linkedProperty.json().is_primary, true);

  const detail = await app.inject({ method: "GET", url: `/broker/deals/${deal.id}`, headers });
  assert.equal(detail.statusCode, 200);
  const detailBody = detail.json();
  assert.equal(detailBody.client.full_name, "Иван Петров");
  assert.equal(detailBody.deal_properties.length, 1);
  assert.equal(detailBody.deal_properties[0].property.title, "Складской комплекс");
  assert.equal(detailBody.activities.length, 2);

  await app.close();
});

test("broker catalog bridge returns published properties only", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/broker/catalog/properties?q=Склад",
    headers: authHeaders(),
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, PROPERTY_ID);
  assert.equal(body.items[0].curation_status, "published");

  await app.close();
});

test("broker company directory returns imported base rows", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/broker/company-directory?q=Логистика",
    headers: authHeaders(),
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.total, 1);
  assert.equal(body.items[0].company_name, "Склад Логистика");
  assert.equal(body.items[0].email, "hello@warehouse.example");

  await app.close();
});

test("broker company registry merges directory with CRM and outreach data", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/broker/company-registry?q=Логистика",
    headers: authHeaders(),
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].companyName, "Склад Логистика");
  assert.equal(body.items[0].crmClientCount, 1);
  assert.equal(body.items[0].crmDealCount, 1);
  assert.equal(body.items[0].firstTouchCount, 1);
  assert.equal(body.items[0].followUpCount, 1);

  await app.close();
});

test("broker campaign API creates an object campaign and manages hypotheses", async () => {
  const app = await buildTestApp();
  const headers = authHeaders();

  const created = await app.inject({
    method: "POST",
    url: "/broker/campaigns",
    headers,
    payload: {
      propertyId: PROPERTY_ID,
      campaignName: "Складской комплекс — outbound wave",
      objective: "Проверить спрос у складских операторов",
      briefText: "Объект 2400 м², складской формат.",
      sourceVersion: "test-brief-v1",
    },
  });
  assert.equal(created.statusCode, 201);
  const campaign = created.json();
  assert.equal(campaign.property_id, PROPERTY_ID);
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.property.title, "Складской комплекс");
  assert.equal(campaign.brief.original_brief, "Объект 2400 м², складской формат.");

  const hypothesis = await app.inject({
    method: "POST",
    url: `/broker/campaigns/${campaign.id}/hypotheses`,
    headers,
    payload: {
      segmentName: "Складские операторы",
      segmentType: "tenant",
      valueProp: "Готовый складской объем в Москве",
      channel: "email",
      priority: "10",
      reasoning: "Профильный спрос на площадь и локацию",
    },
  });
  assert.equal(hypothesis.statusCode, 201);
  assert.equal(hypothesis.json().segment_name, "Складские операторы");
  assert.equal(hypothesis.json().created_by, SUPER_ADMIN_ID);

  const updatedHypothesis = await app.inject({
    method: "PATCH",
    url: `/broker/campaign-hypotheses/${hypothesis.json().id}`,
    headers,
    payload: { status: "approved", priority: 12 },
  });
  assert.equal(updatedHypothesis.statusCode, 200);
  assert.equal(updatedHypothesis.json().status, "approved");
  assert.equal(updatedHypothesis.json().priority, 12);

  const detail = await app.inject({
    method: "GET",
    url: `/broker/campaigns/${campaign.id}`,
    headers,
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().hypotheses.length, 1);
  assert.equal(detail.json().hypotheses[0].status, "approved");

  const campaigns = await app.inject({
    method: "GET",
    url: `/broker/campaigns?propertyId=${PROPERTY_ID}`,
    headers,
  });
  assert.equal(campaigns.statusCode, 200);
  assert.equal(campaigns.json().items.length, 1);

  await app.close();
});

test("broker object playbook reads and saves real object content", async () => {
  const app = await buildTestApp();
  const headers = authHeaders();

  const campaigns = await app.inject({
    method: "GET",
    url: "/broker/campaigns",
    headers,
  });
  assert.equal(campaigns.statusCode, 200);
  const objectId = campaigns.json().items[0].id;
  assert.match(objectId, /^object:/);

  const initial = await app.inject({
    method: "GET",
    url: `/broker/campaigns/${encodeURIComponent(objectId)}/playbook`,
    headers,
  });
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().company_key, objectId);

  const saved = await app.inject({
    method: "PUT",
    url: `/broker/campaigns/${encodeURIComponent(objectId)}/playbook`,
    headers,
    payload: {
      status: "running",
      subject: "Тестовая тема",
      letterBody: "Тестовое письмо",
      pingOne: "Пинг 1",
      monthlyPlan: { firstTouchTarget: 40, followUpTarget: 12, uniqueCompaniesTarget: 25 },
      weeklyPlan: { firstTouchTarget: 10, followUpTarget: 3, uniqueCompaniesTarget: 8 },
      dailyPlan: { firstTouchTarget: 2, followUpTarget: 1, uniqueCompaniesTarget: 2 },
    },
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().company_key, objectId);
  assert.equal(saved.json().subject, "Тестовая тема");
  assert.equal(saved.json().letter_body, "Тестовое письмо");
  assert.equal(saved.json().ping_one, "Пинг 1");
  assert.equal(saved.json().status, "running");
  assert.deepEqual(saved.json().monthly_plan, { firstTouchTarget: 40, followUpTarget: 12, uniqueCompaniesTarget: 25 });
  assert.equal(saved.json().monthly_progress.target.firstTouchTarget, 40);
  assert.equal(typeof saved.json().monthly_progress.pace_status, "string");
  assert.equal(typeof saved.json().monthly_progress.completion_ratio, "number");

  const fetched = await app.inject({
    method: "GET",
    url: `/broker/campaigns/${encodeURIComponent(objectId)}/playbook`,
    headers,
  });
  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.json().subject, "Тестовая тема");
  assert.deepEqual(fetched.json().weekly_plan, { firstTouchTarget: 10, followUpTarget: 3, uniqueCompaniesTarget: 8 });
  assert.equal(typeof fetched.json().daily_progress.status, "string");
  assert.equal(typeof fetched.json().daily_progress.elapsed_ratio, "number");

  await app.close();
});

test("broker hypothesis generator builds ICP seeds for a campaign", async () => {
  const app = await buildTestApp();
  const headers = authHeaders();

  const created = await app.inject({
    method: "POST",
    url: "/broker/campaigns",
    headers,
    payload: {
      propertyId: PROPERTY_ID,
      campaignName: "Складской комплекс — hypothesis generation",
      objective: "Собрать ICP для outbound по складу",
      briefText: "Готовый складской объем для операторов и инвесторов.",
      sourceVersion: "test-generator-v1",
    },
  });
  assert.equal(created.statusCode, 201);
  const campaign = created.json();

  const generated = await app.inject({
    method: "POST",
    url: `/broker/campaigns/${campaign.id}/hypotheses/generate`,
    headers,
  });
  assert.equal(generated.statusCode, 200);
  assert.equal(generated.json().generated >= 3, true);
  assert.equal(generated.json().items[0].campaign_id, campaign.id);

  const detail = await app.inject({
    method: "GET",
    url: `/broker/campaigns/${campaign.id}`,
    headers,
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().hypotheses.length >= 3, true);
  assert.equal(detail.json().hypotheses.some((item: Record<string, unknown>) => item.segment_name === "Складские операторы"), true);

  await app.close();
});

test("broker amo export sends replied companies once and skips duplicates", async () => {
  const app = await buildTestApp();
  const headers = authHeaders();

  const firstExport = await app.inject({
    method: "POST",
    url: "/broker/campaigns/00000000-0000-4000-8000-000000000303/amo/export-replied",
    headers,
    payload: {
      baseUrl: "https://test.amocrm.ru",
      accessToken: "token",
      pipelineId: 11,
      statusId: 22,
    },
  });
  assert.equal(firstExport.statusCode, 200);
  assert.equal(firstExport.json().summary.totalCandidates, 2);
  assert.equal(firstExport.json().summary.exportedCount, 1);
  assert.equal(firstExport.json().summary.skippedExistingCount, 1);
  assert.equal(firstExport.json().summary.failedCount, 0);

  const secondExport = await app.inject({
    method: "POST",
    url: "/broker/campaigns/00000000-0000-4000-8000-000000000303/amo/export-replied",
    headers,
    payload: {
      baseUrl: "https://test.amocrm.ru",
      accessToken: "token",
      pipelineId: 11,
      statusId: 22,
    },
  });
  assert.equal(secondExport.statusCode, 200);
  assert.equal(secondExport.json().summary.exportedCount, 0);
  assert.equal(secondExport.json().summary.skippedLocalCount, 2);

  const detail = await app.inject({
    method: "GET",
    url: "/broker/campaigns/00000000-0000-4000-8000-000000000303",
    headers,
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().amoExportStats.exportedCount, 1);
  assert.equal(detail.json().amoExportStats.needsReviewCount, 1);

  await app.close();
});

async function buildTestApp() {
  const app = Fastify({ logger: false });
  const store = createStore();

  app.decorate("db", createFakeDb(store));
  app.decorate("auth", createFakeAuth());
  app.decorate("amoCrm", createFakeAmoCrm());
  await app.register(brokerApiRoutes, { prefix: "/broker" });

  return app;
}

function authHeaders() {
  return { authorization: "Bearer super-admin-token" };
}

function createStore(): Store {
  return {
    user_roles: [
      { user_id: SUPER_ADMIN_ID, role: "super_admin" },
      { user_id: ANALYST_ID, role: "analyst" },
    ],
    broker_clients: [
      {
        id: "00000000-0000-4000-8000-000000000301",
        full_name: "Складской контакт",
        company: "Склад Логистика",
        email: "hello@warehouse.example",
        updated_at: "2026-05-01T10:00:00.000Z",
      },
    ],
    broker_deals: [
      {
        id: "00000000-0000-4000-8000-000000000302",
        client_id: "00000000-0000-4000-8000-000000000301",
        title: "Сделка по складу",
        stage: "qualified",
        updated_at: "2026-05-01T11:00:00.000Z",
      },
    ],
    broker_deal_properties: [],
    broker_deal_activities: [],
    broker_campaigns: [
      {
        id: "00000000-0000-4000-8000-000000000303",
        property_id: "00000000-0000-4000-8000-000000000102",
        campaign_name: "Wave 1",
        status: "completed",
        updated_at: "2026-05-01T12:00:00.000Z",
      },
    ],
    broker_campaign_briefs: [],
    broker_campaign_hypotheses: [],
    broker_campaign_targets: [
      {
        id: "00000000-0000-4000-8000-000000000304",
        campaign_id: "00000000-0000-4000-8000-000000000303",
        company_name: "Склад Логистика",
        contact_name: "Иван",
        email: "hello@warehouse.example",
        domain: "warehouse.example",
        status: "followed_up",
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T13:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000305",
        campaign_id: "00000000-0000-4000-8000-000000000303",
        company_name: "Новый логистический партнер",
        contact_name: "Мария",
        email: "reply@warehouse.example",
        domain: "warehouse.example",
        status: "replied",
        created_at: "2026-05-01T14:00:00.000Z",
        updated_at: "2026-05-01T14:30:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000306",
        campaign_id: "00000000-0000-4000-8000-000000000303",
        company_name: "Уже в amo",
        contact_name: "Олег",
        email: "existing@warehouse.example",
        domain: "existing.example",
        status: "replied",
        created_at: "2026-05-01T15:00:00.000Z",
        updated_at: "2026-05-01T15:30:00.000Z",
      },
    ],
    broker_company_directory: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        company_name: "Склад Логистика",
        email: "hello@warehouse.example",
        city: "Москва",
        region: "Москва",
        rubric: "Склады",
        subrubric: "3PL",
        created_at: "2026-05-01T09:00:00.000Z",
        updated_at: "2026-05-01T09:00:00.000Z",
      },
    ],
    broker_company_playbooks: [],
    broker_message_threads: [],
    broker_message_versions: [],
    broker_sequence_steps: [],
    broker_send_jobs: [],
    broker_send_events: [],
    broker_mailboxes: [],
    broker_quota_windows: [],
    broker_amo_exports: [],
    broker_approvals: [],
    properties: [
      {
        id: PROPERTY_ID,
        title: "Складской комплекс",
        address: "Москва, Складская 1",
        region: "Москва",
        price_rub: 120000000,
        area_sqm: 2400,
        price_per_sqm: 50000,
        attributes: { asset_type: "warehouse" },
        curation_status: "published",
        updated_at: "2026-04-23T09:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        title: "Черновик объекта",
        address: "Москва",
        region: "Москва",
        curation_status: "draft",
        updated_at: "2026-04-23T09:00:00.000Z",
      },
    ],
  };
}

function createFakeAuth() {
  return {
    auth: {
      async getUser(token: string) {
        if (token === "super-admin-token") {
          return { data: { user: { id: SUPER_ADMIN_ID, email: "admin@example.com" } }, error: null };
        }
        if (token === "analyst-token") {
          return { data: { user: { id: ANALYST_ID, email: "analyst@example.com" } }, error: null };
        }
        return { data: { user: null }, error: new Error("invalid token") };
      },
    },
  } as unknown as SupabaseClient;
}

function createFakeAmoCrm() {
  return {
    async getAccount() {
      return {
        id: 1,
        name: "Test amoCRM",
        subdomain: "test",
      };
    },
    async findDuplicate(_config, input) {
      if (input.email === "existing@warehouse.example") {
        return { exists: true, entityType: "lead", externalId: "amo-existing-1" };
      }
      return { exists: false, entityType: null, externalId: null };
    },
    async createLead(_config, input) {
      return { id: `lead:${input.email}` };
    },
  } as AmoCrmClient;
}

function createFakeDb(store: Store) {
  return {
    from(table: TableName) {
      return new FakeQuery(store, table);
    },
  } as unknown as SupabaseClient;
}

class FakeQuery implements PromiseLike<{ data: unknown; error: Error | null }> {
  private selectText = "";
  private filters: Array<(row: Row) => boolean> = [];
  private limitCount: number | null = null;
  private orderField: string | null = null;
  private orderAscending = true;
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private conflictKeys: string[] = [];

  constructor(private readonly store: Store, private readonly table: TableName) {}

  select(value = "*") {
    this.selectText = value;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  ilike(field: string, pattern: string) {
    this.filters.push((row) => matchesLike(row[field], pattern));
    return this;
  }

  or(expression: string) {
    const clauses = expression.split(",").map((clause) => {
      const [field, operator, ...rest] = clause.split(".");
      return { field, operator, pattern: rest.join(".") };
    });

    this.filters.push((row) =>
      clauses.some((clause) => clause.operator === "ilike" && matchesLike(row[clause.field], clause.pattern)),
    );
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  returns<T>() {
    return this as unknown as PromiseLike<{ data: T; error: Error | null; count?: number | null }>;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row, options?: { onConflict?: string }) {
    this.operation = "upsert";
    this.payload = payload;
    this.conflictKeys = options?.onConflict?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  async single() {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return { data: rows[0] ?? null, error: result.error };
  }

  async maybeSingle() {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return { data: rows[0] ?? null, error: result.error };
  }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.operation === "insert") return this.executeInsert();
    if (this.operation === "update") return this.executeUpdate();
    if (this.operation === "upsert") return this.executeUpsert();
    if (this.operation === "delete") return this.executeDelete();
    const data = this.applySelect();
    return { data, error: null, count: Array.isArray(data) ? data.length : 0 };
  }

  private executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload || {}];
    const now = new Date().toISOString();
    const inserted = rows.map((row) => ({
      id: row.id ?? nextId(this.table),
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
      ...row,
    }));
    this.store[this.table].push(...inserted);
    return { data: inserted.map((row) => this.hydrate(row)), error: null };
  }

  private executeUpdate() {
    const rows = this.store[this.table].filter((row) => this.filters.every((filter) => filter(row)));
    for (const row of rows) {
      Object.assign(row, this.payload || {});
    }
    return { data: rows.map((row) => this.hydrate(row)), error: null };
  }

  private executeUpsert() {
    const payload = this.payload as Row;
    const existing = this.store[this.table].find((row) =>
      this.conflictKeys.length
        ? this.conflictKeys.every((key) => row[key] === payload[key])
        : row.id === payload.id,
    );

    if (existing) {
      Object.assign(existing, payload, { updated_at: new Date().toISOString() });
      return { data: [this.hydrate(existing)], error: null };
    }

    return this.executeInsert();
  }

  private executeDelete() {
    const tableRows = this.store[this.table];
    const remaining = tableRows.filter((row) => !this.filters.every((filter) => filter(row)));
    this.store[this.table] = remaining;
    return { data: [], error: null };
  }

  private applySelect() {
    let rows = this.store[this.table].filter((row) => this.filters.every((filter) => filter(row)));

    if (this.orderField) {
      const field = this.orderField;
      const direction = this.orderAscending ? 1 : -1;
      rows = [...rows].sort((left, right) =>
        String(left[field] || "").localeCompare(String(right[field] || "")) * direction,
      );
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => this.hydrate(row));
  }

  private hydrate(row: Row) {
    const hydrated = { ...row };

    if (this.table === "broker_deals" && this.selectText.includes("broker_clients")) {
      hydrated.client = this.store.broker_clients.find((client) => client.id === row.client_id) || null;
    }

    if (this.table === "broker_deals" && this.selectText.includes("broker_deal_properties")) {
      hydrated.deal_properties = this.store.broker_deal_properties
        .filter((item) => item.deal_id === row.id)
        .map((item) => ({
          ...item,
          property: this.store.properties.find((property) => property.id === item.property_id) || null,
        }));
    }

    if (this.table === "broker_deals" && this.selectText.includes("broker_deal_activities")) {
      hydrated.activities = this.store.broker_deal_activities.filter((item) => item.deal_id === row.id);
    }

    if (this.table === "broker_deal_properties" && this.selectText.includes("properties")) {
      hydrated.property = this.store.properties.find((property) => property.id === row.property_id) || null;
    }

    return hydrated;
  }
}

function matchesLike(value: unknown, pattern: string) {
  const needle = pattern.replaceAll("%", "").replaceAll("\\_", "_").replaceAll("\\%", "%").toLowerCase();
  return String(value || "").toLowerCase().includes(needle);
}

function nextId(table: string) {
  return `${table}-${Math.random().toString(36).slice(2, 10)}`;
}
