import type { FastifyInstance } from "fastify";
import { getAuthContext, requireSuperAdmin } from "../auth.js";
import {
  normalizeActivityType,
  normalizeBoolean,
  normalizeDealPropertyStatus,
  normalizeDealStage,
  normalizeNullableString,
  normalizeNumber,
  normalizeString,
  normalizeStringArray,
} from "../validation.js";

type ListQuery = {
  q?: string;
  limit?: string;
  stage?: string;
  clientId?: string;
};

type ClientBody = {
  fullName?: string;
  company?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  leadSource?: string;
  budgetFrom?: number | string;
  budgetTo?: number | string;
  regionsOfInterest?: string[];
  assetTypesOfInterest?: string[];
  investmentGoal?: string;
  status?: string;
  notes?: string;
};

type DealBody = {
  clientId?: string;
  title?: string;
  stage?: string;
  priority?: string;
  nextStep?: string;
  nextStepDueAt?: string;
  lastContactAt?: string;
  dealNotes?: string;
  isArchived?: boolean | string;
};

type DealPropertyBody = {
  propertyId?: string;
  status?: string;
  comment?: string;
  isPrimary?: boolean | string;
};

type ActivityBody = {
  clientId?: string;
  activityType?: string;
  comment?: string;
  payload?: Record<string, unknown>;
};

export async function brokerApiRoutes(server: FastifyInstance) {
  server.addHook("preHandler", requireSuperAdmin);

  server.get("/me", async (request) => {
    return getAuthContext(request);
  });

  server.get<{ Querystring: ListQuery }>("/clients", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 100);
    const q = normalizeString(request.query.q, 120);
    let query = server.db
      .from("broker_clients")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or([
        `full_name.ilike.${like}`,
        `company.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `telegram.ilike.${like}`,
      ].join(","));
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });

  server.post<{ Body: ClientBody }>("/clients", async (request, reply) => {
    const auth = getAuthContext(request);
    const payload = buildClientPayload(request.body, auth?.userId || null);
    if (!payload.full_name) {
      return reply.status(400).send({ error: "Требуется имя клиента" });
    }

    const { data, error } = await server.db
      .from("broker_clients")
      .insert(payload)
      .select("*")
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  server.get<{ Params: { id: string } }>("/clients/:id", async (request, reply) => {
    const { data, error } = await server.db
      .from("broker_clients")
      .select(`
        *,
        broker_deals (*)
      `)
      .eq("id", request.params.id)
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Клиент не найден" });
    return data;
  });

  server.patch<{ Params: { id: string }; Body: ClientBody }>("/clients/:id", async (request, reply) => {
    const payload = buildClientPatchPayload(request.body);
    const { data, error } = await server.db
      .from("broker_clients")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Клиент не найден" });
    return data;
  });

  server.get<{ Querystring: ListQuery }>("/deals", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 200);
    const q = normalizeString(request.query.q, 120);
    let query = server.db
      .from("broker_deals")
      .select(`
        *,
        client:broker_clients (*),
        deal_properties:broker_deal_properties (
          *,
          property:properties (id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status)
        )
      `)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (request.query.stage) {
      query = query.eq("stage", normalizeDealStage(request.query.stage));
    }
    if (request.query.clientId) {
      query = query.eq("client_id", request.query.clientId);
    }
    if (q) {
      query = query.ilike("title", `%${escapeLike(q)}%`);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });

  server.post<{ Body: DealBody }>("/deals", async (request, reply) => {
    const auth = getAuthContext(request);
    const clientId = normalizeString(request.body?.clientId, 80);
    if (!clientId) {
      return reply.status(400).send({ error: "Требуется clientId" });
    }

    const payload = buildDealPayload(request.body, clientId, auth?.userId || null);
    const { data, error } = await server.db
      .from("broker_deals")
      .insert(payload)
      .select("*")
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  server.get<{ Params: { id: string } }>("/deals/:id", async (request, reply) => {
    const { data, error } = await server.db
      .from("broker_deals")
      .select(`
        *,
        client:broker_clients (*),
        deal_properties:broker_deal_properties (
          *,
          property:properties (id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status)
        ),
        activities:broker_deal_activities (*)
      `)
      .eq("id", request.params.id)
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Сделка не найдена" });
    return data;
  });

  server.patch<{ Params: { id: string }; Body: DealBody }>("/deals/:id", async (request, reply) => {
    const payload = buildDealPatchPayload(request.body);
    const { data, error } = await server.db
      .from("broker_deals")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();

    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Сделка не найдена" });
    return data;
  });

  server.patch<{ Params: { id: string }; Body: { stage?: string } }>("/deals/:id/stage", async (request, reply) => {
    const auth = getAuthContext(request);
    const stage = normalizeDealStage(request.body?.stage);
    const now = new Date().toISOString();

    const { data: before, error: beforeError } = await server.db
      .from("broker_deals")
      .select("id,client_id,stage")
      .eq("id", request.params.id)
      .maybeSingle();
    if (beforeError) return reply.status(500).send({ error: beforeError.message });
    if (!before) return reply.status(404).send({ error: "Сделка не найдена" });

    const { data, error } = await server.db
      .from("broker_deals")
      .update({ stage, updated_at: now })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();
    if (error) return reply.status(500).send({ error: error.message });

    await server.db.from("broker_deal_activities").insert({
      deal_id: request.params.id,
      client_id: before.client_id,
      activity_type: "status_changed",
      comment: `Стадия изменена: ${before.stage} -> ${stage}`,
      created_by: auth?.userId ?? null,
      payload: { previous_stage: before.stage, next_stage: stage },
    });

    return data;
  });

  server.get<{ Params: { id: string } }>("/deals/:id/properties", async (request, reply) => {
    const { data, error } = await server.db
      .from("broker_deal_properties")
      .select(`
        *,
        property:properties (id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status)
      `)
      .eq("deal_id", request.params.id)
      .order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });

  server.post<{ Params: { id: string }; Body: DealPropertyBody }>("/deals/:id/properties", async (request, reply) => {
    const auth = getAuthContext(request);
    const propertyId = normalizeString(request.body?.propertyId, 80);
    if (!propertyId) {
      return reply.status(400).send({ error: "Требуется propertyId" });
    }

    const { data: deal, error: dealError } = await server.db
      .from("broker_deals")
      .select("id,client_id")
      .eq("id", request.params.id)
      .maybeSingle();
    if (dealError) return reply.status(500).send({ error: dealError.message });
    if (!deal) return reply.status(404).send({ error: "Сделка не найдена" });

    const payload = {
      deal_id: request.params.id,
      property_id: propertyId,
      status: normalizeDealPropertyStatus(request.body?.status),
      comment: normalizeNullableString(request.body?.comment, 2000),
      is_primary: normalizeBoolean(request.body?.isPrimary),
    };

    const { data, error } = await server.db
      .from("broker_deal_properties")
      .upsert(payload, { onConflict: "deal_id,property_id" })
      .select("*")
      .single();
    if (error) return reply.status(500).send({ error: error.message });

    await server.db.from("broker_deal_activities").insert({
      deal_id: request.params.id,
      client_id: deal.client_id,
      activity_type: "object_sent",
      comment: `Объект добавлен в сделку: ${propertyId}`,
      created_by: auth?.userId ?? null,
      payload: { property_id: propertyId, status: payload.status },
    });

    return reply.status(201).send(data);
  });

  server.patch<{ Params: { id: string }; Body: DealPropertyBody }>("/deal-properties/:id", async (request, reply) => {
    const payload = {
      status: request.body?.status ? normalizeDealPropertyStatus(request.body.status) : undefined,
      comment: request.body?.comment !== undefined ? normalizeNullableString(request.body.comment, 2000) : undefined,
      is_primary: request.body?.isPrimary !== undefined ? normalizeBoolean(request.body.isPrimary) : undefined,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await server.db
      .from("broker_deal_properties")
      .update(removeUndefined(payload))
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();
    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Связка не найдена" });
    return data;
  });

  server.delete<{ Params: { id: string } }>("/deal-properties/:id", async (request, reply) => {
    const { error } = await server.db
      .from("broker_deal_properties")
      .delete()
      .eq("id", request.params.id);
    if (error) return reply.status(500).send({ error: error.message });
    return { ok: true };
  });

  server.get<{ Params: { id: string } }>("/deals/:id/activities", async (request, reply) => {
    const { data, error } = await server.db
      .from("broker_deal_activities")
      .select("*")
      .eq("deal_id", request.params.id)
      .order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });

  server.post<{ Params: { id: string }; Body: ActivityBody }>("/deals/:id/activities", async (request, reply) => {
    const auth = getAuthContext(request);
    const activityType = normalizeActivityType(request.body?.activityType);
    const comment = normalizeString(request.body?.comment, 4000);
    if (!comment) {
      return reply.status(400).send({ error: "Требуется комментарий" });
    }

    const { data: deal, error: dealError } = await server.db
      .from("broker_deals")
      .select("id,client_id")
      .eq("id", request.params.id)
      .maybeSingle();
    if (dealError) return reply.status(500).send({ error: dealError.message });
    if (!deal) return reply.status(404).send({ error: "Сделка не найдена" });

    const { data, error } = await server.db
      .from("broker_deal_activities")
      .insert({
        deal_id: request.params.id,
        client_id: normalizeString(request.body?.clientId, 80) || deal.client_id,
        activity_type: activityType,
        comment,
        created_by: auth?.userId ?? null,
        payload: request.body?.payload && typeof request.body.payload === "object" ? request.body.payload : {},
      })
      .select("*")
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  server.get<{ Querystring: ListQuery }>("/catalog/properties", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 30);
    const q = normalizeString(request.query.q, 120);
    let query = server.db
      .from("properties")
      .select("id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status")
      .eq("curation_status", "published")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or([
        `title.ilike.${like}`,
        `address.ilike.${like}`,
        `region.ilike.${like}`,
      ].join(","));
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });
}

function buildClientPayload(body: ClientBody | undefined, brokerUserId: string | null | undefined) {
  return removeUndefined({
    full_name: normalizeString(body?.fullName, 240),
    company: normalizeNullableString(body?.company, 240),
    phone: normalizeNullableString(body?.phone, 80),
    email: normalizeNullableString(body?.email, 240)?.toLowerCase() ?? null,
    telegram: normalizeNullableString(body?.telegram, 120),
    lead_source: normalizeNullableString(body?.leadSource, 160),
    budget_from: normalizeNumber(body?.budgetFrom),
    budget_to: normalizeNumber(body?.budgetTo),
    regions_of_interest: normalizeStringArray(body?.regionsOfInterest),
    asset_types_of_interest: normalizeStringArray(body?.assetTypesOfInterest),
    investment_goal: normalizeNullableString(body?.investmentGoal, 1000),
    status: normalizeNullableString(body?.status, 80) || "active",
    notes: normalizeNullableString(body?.notes, 4000),
    broker_user_id: brokerUserId,
  });
}

function buildClientPatchPayload(body: ClientBody | undefined) {
  return removeUndefined({
    full_name: hasOwn(body, "fullName") ? normalizeString(body?.fullName, 240) : undefined,
    company: hasOwn(body, "company") ? normalizeNullableString(body?.company, 240) : undefined,
    phone: hasOwn(body, "phone") ? normalizeNullableString(body?.phone, 80) : undefined,
    email: hasOwn(body, "email") ? normalizeNullableString(body?.email, 240)?.toLowerCase() ?? null : undefined,
    telegram: hasOwn(body, "telegram") ? normalizeNullableString(body?.telegram, 120) : undefined,
    lead_source: hasOwn(body, "leadSource") ? normalizeNullableString(body?.leadSource, 160) : undefined,
    budget_from: hasOwn(body, "budgetFrom") ? normalizeNumber(body?.budgetFrom) : undefined,
    budget_to: hasOwn(body, "budgetTo") ? normalizeNumber(body?.budgetTo) : undefined,
    regions_of_interest: hasOwn(body, "regionsOfInterest") ? normalizeStringArray(body?.regionsOfInterest) : undefined,
    asset_types_of_interest: hasOwn(body, "assetTypesOfInterest") ? normalizeStringArray(body?.assetTypesOfInterest) : undefined,
    investment_goal: hasOwn(body, "investmentGoal") ? normalizeNullableString(body?.investmentGoal, 1000) : undefined,
    status: hasOwn(body, "status") ? normalizeNullableString(body?.status, 80) : undefined,
    notes: hasOwn(body, "notes") ? normalizeNullableString(body?.notes, 4000) : undefined,
  });
}

function buildDealPayload(body: DealBody | undefined, clientId: string, brokerUserId: string | null) {
  return {
    client_id: clientId,
    title: normalizeString(body?.title, 240) || "Новая сделка",
    stage: normalizeDealStage(body?.stage),
    priority: normalizeNullableString(body?.priority, 80) || "normal",
    broker_user_id: brokerUserId,
    next_step: normalizeNullableString(body?.nextStep, 1000),
    next_step_due_at: normalizeNullableString(body?.nextStepDueAt, 80),
    last_contact_at: normalizeNullableString(body?.lastContactAt, 80),
    deal_notes: normalizeNullableString(body?.dealNotes, 4000),
    is_archived: normalizeBoolean(body?.isArchived),
  };
}

function buildDealPatchPayload(body: DealBody | undefined) {
  return removeUndefined({
    client_id: body?.clientId ? normalizeString(body.clientId, 80) : undefined,
    title: body?.title !== undefined ? normalizeString(body.title, 240) : undefined,
    stage: body?.stage !== undefined ? normalizeDealStage(body.stage) : undefined,
    priority: body?.priority !== undefined ? normalizeNullableString(body.priority, 80) : undefined,
    next_step: body?.nextStep !== undefined ? normalizeNullableString(body.nextStep, 1000) : undefined,
    next_step_due_at: body?.nextStepDueAt !== undefined ? normalizeNullableString(body.nextStepDueAt, 80) : undefined,
    last_contact_at: body?.lastContactAt !== undefined ? normalizeNullableString(body.lastContactAt, 80) : undefined,
    deal_notes: body?.dealNotes !== undefined ? normalizeNullableString(body.dealNotes, 4000) : undefined,
    is_archived: body?.isArchived !== undefined ? normalizeBoolean(body.isArchived) : undefined,
  });
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(300, Math.round(parsed)));
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (char) => `\\${char}`);
}

function hasOwn(value: object | null | undefined, key: string) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
