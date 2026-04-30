import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brokerApiRoutes } from "../src/routes/api.js";
import type { AppRole } from "../src/types.js";

type Row = Record<string, unknown>;
type TableName =
  | "user_roles"
  | "broker_clients"
  | "broker_deals"
  | "broker_deal_properties"
  | "broker_deal_activities"
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

async function buildTestApp() {
  const app = Fastify({ logger: false });
  const store = createStore();

  app.decorate("db", createFakeDb(store));
  app.decorate("auth", createFakeAuth());
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
    broker_clients: [],
    broker_deals: [],
    broker_deal_properties: [],
    broker_deal_activities: [],
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
    return { data: this.applySelect(), error: null };
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
