import type { FastifyInstance } from "fastify";
import { getAuthContext, requireSuperAdmin } from "../auth.js";
import {
  normalizeCampaignStatus,
  normalizeActivityType,
  normalizeHypothesisStatus,
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
  propertyId?: string;
  region?: string;
  rubric?: string;
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

type CampaignBody = {
  propertyId?: string;
  campaignName?: string;
  status?: string;
  objective?: string;
  startDate?: string;
  endDate?: string;
  briefText?: string;
  sourceVersion?: string;
  attachmentsSnapshot?: unknown;
  propertySnapshot?: Record<string, unknown>;
};

type CampaignHypothesisBody = {
  segmentName?: string;
  segmentType?: string;
  valueProp?: string;
  channel?: string;
  priority?: number | string;
  status?: string;
  reasoning?: string;
};

type CompanyPlaybookBody = {
  companyName?: string;
  status?: string;
  subject?: string;
  letterBody?: string;
  pingOne?: string;
  pingTwo?: string;
  pingThree?: string;
};

type CampaignTargetRow = {
  id: string;
  campaign_id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  source: string | null;
  object_role: string | null;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CampaignIndexRow = {
  id: string;
  campaign_name: string;
  property_id: string;
};

type PropertyIndexRow = {
  id: string;
  title: string | null;
  address: string | null;
  region: string | null;
};

type CompanyDirectoryRow = {
  id: string;
  company_name: string;
  email: string;
  site_title: string | null;
  company_type: string | null;
  city: string | null;
  city_district: string | null;
  region: string | null;
  federal_district: string | null;
  rubric: string | null;
  subrubric: string | null;
  subrubric_type: string | null;
  coordinates: string | null;
  working_hours: string | null;
  timezone: string | null;
  business_status: string | null;
  internet_rating: string | null;
  review_count_estimate: string | null;
  domain: string | null;
  source: string;
  source_file: string | null;
  import_batch: string | null;
  created_at: string;
  updated_at: string;
};

type BrokerClientIndexRow = {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  updated_at: string;
};

type BrokerDealIndexRow = {
  id: string;
  client_id: string;
  stage: string;
  updated_at: string;
};

type CompanyPlaybookRow = {
  id: string;
  company_key: string;
  company_name: string;
  status: string;
  subject: string | null;
  letter_body: string | null;
  ping_one: string | null;
  ping_two: string | null;
  ping_three: string | null;
  created_at: string;
  updated_at: string;
};

type AggregatedObjectRow = {
  id: string;
  campaign_name: string;
  property_id: string;
  property_ids: string[];
  property: PropertyIndexRow | null;
  status: string;
  objective: string;
  updated_at: string;
  stats?: ReturnType<typeof emptyCampaignStats>;
  _stats?: Array<ReturnType<typeof emptyCampaignStats>>;
};

const OBJECT_ALIASES: Record<string, string> = {
  Abbakumovo: "Аббакумово",
  "Suvorovskaya 1/52 k1": "Офисное здание на Суворовской площади",
  "Moskva 1905 goda 4s1": "Коммерческое помещение на ул. 1905 года",
  "Michurinskiy 3": "Мичуринский проспект",
  Pushkino: "Торговые помещения в Пушкино",
  "Pushkino Yaroslavskoe 194k1": "Торговые помещения в Пушкино",
  Stupino: "Ступино 12,97 га",
  "Stupino / Staraya Sitnya": "Ступино 12,97 га",
  Mozhaysk: "Можайск, 71,89 га",
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
      .select("*", { count: "exact" })
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

    const { data, error, count } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [], total: count ?? data?.length ?? 0 };
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
      `, { count: "exact" })
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

    const { data, error, count } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [], total: count ?? data?.length ?? 0 };
  });

  server.get<{ Querystring: ListQuery }>("/outreach/companies", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 250);
    const q = normalizeString(request.query.q, 120);
    let targetsQuery = server.db
      .from("broker_campaign_targets")
      .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
      .order("company_name", { ascending: true })
      .limit(5000);

    if (q) {
      const like = `%${escapeLike(q)}%`;
      targetsQuery = targetsQuery.or([
        `company_name.ilike.${like}`,
        `email.ilike.${like}`,
        `domain.ilike.${like}`,
      ].join(","));
    }

    const { data: targets, error: targetsError } = await targetsQuery.returns<CampaignTargetRow[]>();
    if (targetsError) return reply.status(500).send({ error: targetsError.message });

    const campaignIds = unique((targets || []).map((target) => target.campaign_id).filter(Boolean));
    const campaignsById = new Map<string, CampaignIndexRow>();
    const propertiesById = new Map<string, PropertyIndexRow>();
    if (campaignIds.length) {
      const { data: campaigns, error: campaignsError } = await server.db
        .from("broker_campaigns")
        .select("id,campaign_name,property_id")
        .in("id", campaignIds)
        .returns<CampaignIndexRow[]>();
      if (campaignsError) return reply.status(500).send({ error: campaignsError.message });
      for (const campaign of campaigns || []) campaignsById.set(campaign.id, campaign);

      const propertyIds = unique((campaigns || []).map((campaign) => campaign.property_id).filter(Boolean));
      if (propertyIds.length) {
        const { data: properties, error: propertiesError } = await server.db
          .from("properties")
          .select("id,title,address,region")
          .in("id", propertyIds)
          .returns<PropertyIndexRow[]>();
        if (propertiesError) return reply.status(500).send({ error: propertiesError.message });
        for (const property of properties || []) propertiesById.set(property.id, property);
      }
    }

    const byCompany = new Map<string, {
      companyName: string;
      firstTouchCount: number;
      followUpCount: number;
      repliedCount: number;
      bouncedCount: number;
      suppressedCount: number;
      uniqueEmails: Set<string>;
      objects: Set<string>;
      recipients: Array<Record<string, unknown>>;
    }>();

    for (const target of targets || []) {
      const key = target.company_name.trim().toLowerCase() || target.email.toLowerCase();
      const item = byCompany.get(key) || {
        companyName: target.company_name || target.email,
        firstTouchCount: 0,
        followUpCount: 0,
        repliedCount: 0,
        bouncedCount: 0,
        suppressedCount: 0,
        uniqueEmails: new Set<string>(),
        objects: new Set<string>(),
        recipients: [],
      };
      const campaign = campaignsById.get(target.campaign_id);
      const property = campaign?.property_id ? propertiesById.get(campaign.property_id) : null;
      const objectName = canonicalObjectTitle(property?.title || campaign?.campaign_name || "");

      if (isFirstTouchStatus(target.status)) item.firstTouchCount += 1;
      if (target.status === "followed_up") item.followUpCount += 1;
      if (target.status === "replied") item.repliedCount += 1;
      if (target.status === "bounced") item.bouncedCount += 1;
      if (target.status === "suppressed") item.suppressedCount += 1;
      item.uniqueEmails.add(target.email.toLowerCase());
      if (objectName) item.objects.add(objectName);
      item.recipients.push({
        email: target.email,
        contactName: target.contact_name,
        status: target.status,
        objectRole: target.object_role,
        campaignId: target.campaign_id,
        campaignName: campaign?.campaign_name || null,
        propertyId: campaign?.property_id || null,
        objectName,
        domain: target.domain,
      });
      byCompany.set(key, item);
    }

    const items = Array.from(byCompany.values())
      .map((item) => ({
        companyKey: normalizeString(item.companyName, 240).toLowerCase(),
        companyName: item.companyName,
        firstTouchCount: item.firstTouchCount,
        followUpCount: item.followUpCount,
        repliedCount: item.repliedCount,
        bouncedCount: item.bouncedCount,
        suppressedCount: item.suppressedCount,
        uniqueEmailCount: item.uniqueEmails.size,
        objects: Array.from(item.objects).sort(),
        recipients: item.recipients.sort((a, b) =>
          String(a.objectName || "").localeCompare(String(b.objectName || "")) ||
          String(a.email || "").localeCompare(String(b.email || "")),
        ),
      }))
      .sort((a, b) =>
        (b.firstTouchCount + b.followUpCount) - (a.firstTouchCount + a.followUpCount) ||
        a.companyName.localeCompare(b.companyName),
      );

    return { items: items.slice(0, limit), total: items.length };
  });

  server.get<{ Querystring: ListQuery }>("/company-directory", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 100);
    const q = normalizeString(request.query.q, 120);
    const region = normalizeString(request.query.region, 120);
    const rubric = normalizeString(request.query.rubric, 120);
    let query = server.db
      .from("broker_company_directory")
      .select(
        "id,company_name,email,site_title,company_type,city,city_district,region,federal_district,rubric,subrubric,subrubric_type,coordinates,working_hours,timezone,business_status,internet_rating,review_count_estimate,domain,source,source_file,import_batch,created_at,updated_at",
        { count: "exact" },
      )
      .order("company_name", { ascending: true })
      .limit(limit);

    if (region) {
      query = query.eq("region", region);
    }
    if (rubric) {
      query = query.eq("rubric", rubric);
    }
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or([
        `company_name.ilike.${like}`,
        `email.ilike.${like}`,
        `city.ilike.${like}`,
        `region.ilike.${like}`,
        `rubric.ilike.${like}`,
        `subrubric.ilike.${like}`,
      ].join(","));
    }

    const { data, error, count } = await query.returns<CompanyDirectoryRow[]>();
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [], total: count ?? data?.length ?? 0 };
  });

  server.get<{ Querystring: ListQuery }>("/company-registry", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 60);
    const q = normalizeString(request.query.q, 120);
    const fetchLimit = Math.min(limit * 12, 1800);
    let directoryQuery = server.db
      .from("broker_company_directory")
      .select(
        "id,company_name,email,site_title,company_type,city,city_district,region,federal_district,rubric,subrubric,subrubric_type,coordinates,working_hours,timezone,business_status,internet_rating,review_count_estimate,domain,source,source_file,import_batch,created_at,updated_at",
        { count: "exact" },
      )
      .order("company_name", { ascending: true })
      .limit(fetchLimit);

    if (q) {
      const like = `%${escapeLike(q)}%`;
      directoryQuery = directoryQuery.or([
        `company_name.ilike.${like}`,
        `email.ilike.${like}`,
        `city.ilike.${like}`,
        `region.ilike.${like}`,
        `rubric.ilike.${like}`,
        `subrubric.ilike.${like}`,
      ].join(","));
    }

    const { data: directoryRows, error: directoryError, count: directoryEntryTotal } = await directoryQuery.returns<CompanyDirectoryRow[]>();
    if (directoryError) return reply.status(500).send({ error: directoryError.message });

    const grouped = new Map<string, {
      companyKey: string;
      companyName: string;
      emails: Set<string>;
      domains: Set<string>;
      cities: Set<string>;
      regions: Set<string>;
      rubrics: Set<string>;
      subrubrics: Set<string>;
      latestUpdatedAt: string;
    }>();

    for (const row of directoryRows || []) {
      const companyKey = companyRegistryKey(row.company_name, row.email);
      const existing = grouped.get(companyKey) || {
        companyKey,
        companyName: row.company_name,
        emails: new Set<string>(),
        domains: new Set<string>(),
        cities: new Set<string>(),
        regions: new Set<string>(),
        rubrics: new Set<string>(),
        subrubrics: new Set<string>(),
        latestUpdatedAt: row.updated_at,
      };
      existing.companyName = preferLongerName(existing.companyName, row.company_name);
      existing.latestUpdatedAt = String(existing.latestUpdatedAt || "") > String(row.updated_at || "")
        ? existing.latestUpdatedAt
        : row.updated_at;
      existing.emails.add(row.email.toLowerCase());
      if (row.domain) existing.domains.add(row.domain.toLowerCase());
      if (row.city) existing.cities.add(row.city);
      if (row.region) existing.regions.add(row.region);
      if (row.rubric) existing.rubrics.add(row.rubric);
      if (row.subrubric) existing.subrubrics.add(row.subrubric);
      grouped.set(companyKey, existing);
    }

    const directoryGroups = Array.from(grouped.values());
    const companyNames = unique(directoryGroups.map((item) => item.companyName).filter(Boolean));
    const emails = unique(directoryGroups.flatMap((item) => Array.from(item.emails)).filter(Boolean));

    const crmClientsByCompany = new Map<string, BrokerClientIndexRow[]>();
    const dealsByClientId = new Map<string, BrokerDealIndexRow[]>();
    const outreachByCompanyKey = new Map<string, {
      firstTouchCount: number;
      followUpCount: number;
      repliedCount: number;
      bouncedCount: number;
      suppressedCount: number;
      objects: Set<string>;
      recipients: Array<Record<string, unknown>>;
    }>();

    const crmClients = await loadRegistryClients(server, companyNames, emails);
    for (const client of crmClients) {
      const keys = new Set<string>();
      if (client.company) keys.add(companyRegistryKey(client.company, client.email || ""));
      if (client.email) keys.add(companyRegistryKey("", client.email));
      for (const key of keys) {
        crmClientsByCompany.set(key, [...(crmClientsByCompany.get(key) || []), client]);
      }
    }

    const clientIds = unique(crmClients.map((client) => client.id));
    if (clientIds.length) {
      const { data: deals, error: dealsError } = await server.db
        .from("broker_deals")
        .select("id,client_id,stage,updated_at")
        .in("client_id", clientIds)
        .returns<BrokerDealIndexRow[]>();
      if (dealsError) return reply.status(500).send({ error: dealsError.message });
      for (const deal of deals || []) {
        dealsByClientId.set(deal.client_id, [...(dealsByClientId.get(deal.client_id) || []), deal]);
      }
    }

    const outreachTargets = await loadRegistryTargets(server, companyNames, emails);
    const campaignIds = unique(outreachTargets.map((target) => target.campaign_id).filter(Boolean));
    const campaignsById = new Map<string, CampaignIndexRow>();
    const propertiesById = new Map<string, PropertyIndexRow>();
    if (campaignIds.length) {
      const { data: campaigns, error: campaignsError } = await server.db
        .from("broker_campaigns")
        .select("id,campaign_name,property_id")
        .in("id", campaignIds)
        .returns<CampaignIndexRow[]>();
      if (campaignsError) return reply.status(500).send({ error: campaignsError.message });
      for (const campaign of campaigns || []) campaignsById.set(campaign.id, campaign);

      const propertyIds = unique((campaigns || []).map((campaign) => campaign.property_id).filter(Boolean));
      if (propertyIds.length) {
        const { data: properties, error: propertiesError } = await server.db
          .from("properties")
          .select("id,title,address,region")
          .in("id", propertyIds)
          .returns<PropertyIndexRow[]>();
        if (propertiesError) return reply.status(500).send({ error: propertiesError.message });
        for (const property of properties || []) propertiesById.set(property.id, property);
      }
    }

    for (const target of outreachTargets) {
      const companyKey = companyRegistryKey(target.company_name, target.email);
      const item = outreachByCompanyKey.get(companyKey) || {
        firstTouchCount: 0,
        followUpCount: 0,
        repliedCount: 0,
        bouncedCount: 0,
        suppressedCount: 0,
        objects: new Set<string>(),
        recipients: [],
      };
      const campaign = campaignsById.get(target.campaign_id);
      const property = campaign?.property_id ? propertiesById.get(campaign.property_id) : null;
      const objectName = canonicalObjectTitle(property?.title || campaign?.campaign_name || "");
      if (isFirstTouchStatus(target.status)) item.firstTouchCount += 1;
      if (target.status === "followed_up") item.followUpCount += 1;
      if (target.status === "replied") item.repliedCount += 1;
      if (target.status === "bounced") item.bouncedCount += 1;
      if (target.status === "suppressed") item.suppressedCount += 1;
      if (objectName) item.objects.add(objectName);
      item.recipients.push({
        email: target.email,
        status: target.status,
        objectName,
      });
      outreachByCompanyKey.set(companyKey, item);
    }

    const items = directoryGroups
      .map((item) => {
        const crmClientsForCompany = dedupeById(crmClientsByCompany.get(item.companyKey) || []);
        const deals = dedupeById(crmClientsForCompany.flatMap((client) => dealsByClientId.get(client.id) || []));
        const outreach = outreachByCompanyKey.get(item.companyKey) || {
          firstTouchCount: 0,
          followUpCount: 0,
          repliedCount: 0,
          bouncedCount: 0,
          suppressedCount: 0,
          objects: new Set<string>(),
          recipients: [],
        };
        return {
          companyKey: item.companyKey,
          companyName: item.companyName,
          directoryEmailCount: item.emails.size,
          emails: Array.from(item.emails).sort(),
          domains: Array.from(item.domains).sort(),
          cities: Array.from(item.cities).sort(),
          regions: Array.from(item.regions).sort(),
          rubrics: Array.from(item.rubrics).sort(),
          subrubrics: Array.from(item.subrubrics).sort(),
          crmClientCount: crmClientsForCompany.length,
          crmDealCount: deals.length,
          crmStages: unique(deals.map((deal) => deal.stage).filter(Boolean)).sort(),
          firstTouchCount: outreach.firstTouchCount,
          followUpCount: outreach.followUpCount,
          repliedCount: outreach.repliedCount,
          bouncedCount: outreach.bouncedCount,
          suppressedCount: outreach.suppressedCount,
          outreachObjects: Array.from(outreach.objects).sort(),
          recipients: outreach.recipients
            .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")))
            .slice(0, 8),
          latestUpdatedAt: item.latestUpdatedAt,
        };
      })
      .sort((a, b) =>
        (b.crmDealCount + b.firstTouchCount + b.followUpCount) - (a.crmDealCount + a.firstTouchCount + a.followUpCount) ||
        a.companyName.localeCompare(b.companyName),
      );

    return {
      items: items.slice(0, limit),
      total: items.length,
      directoryEntryTotal: directoryEntryTotal ?? directoryRows?.length ?? 0,
    };
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

  server.get<{ Querystring: ListQuery }>("/campaigns", async (request, reply) => {
    const limit = normalizeLimit(request.query.limit, 100);
    const q = normalizeString(request.query.q, 120);
    let query = server.db
      .from("broker_campaigns")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (request.query.propertyId) {
      query = query.eq("property_id", normalizeString(request.query.propertyId, 80));
    }
    if (request.query.stage) {
      query = query.eq("status", normalizeCampaignStatus(request.query.stage));
    }
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or([
        `campaign_name.ilike.${like}`,
        `objective.ilike.${like}`,
      ].join(","));
    }

    const { data, error, count } = await query;
    if (error) return reply.status(500).send({ error: error.message });
    const campaigns = data ?? [];
    const campaignIds = campaigns.map((item) => item.id).filter(Boolean);
    const statsByCampaignId = await loadCampaignTargetStats(server, campaignIds);
    const propertiesById = await loadPropertiesIndex(server, unique(campaigns.map((item) => item.property_id).filter(Boolean)));
    const grouped = groupCampaignsByObject(campaigns, propertiesById, statsByCampaignId);
    return {
      items: grouped.slice(0, limit),
      total: grouped.length > 0 ? grouped.length : (count ?? campaigns.length),
    };
  });

  server.post<{ Body: CampaignBody }>("/campaigns", async (request, reply) => {
    const auth = getAuthContext(request);
    const propertyId = normalizeString(request.body?.propertyId, 80);
    const campaignName = normalizeString(request.body?.campaignName, 240);
    if (!propertyId) {
      return reply.status(400).send({ error: "Требуется propertyId" });
    }
    if (!campaignName) {
      return reply.status(400).send({ error: "Требуется campaignName" });
    }

    const { data: property, error: propertyError } = await server.db
      .from("properties")
      .select("id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status")
      .eq("id", propertyId)
      .maybeSingle();
    if (propertyError) return reply.status(500).send({ error: propertyError.message });
    if (!property) return reply.status(404).send({ error: "Объект не найден" });

    const campaignPayload = buildCampaignPayload(request.body, propertyId, auth?.userId ?? null);
    const { data: campaign, error: campaignError } = await server.db
      .from("broker_campaigns")
      .insert(campaignPayload)
      .select("*")
      .single();
    if (campaignError) return reply.status(500).send({ error: campaignError.message });

    const briefPayload = {
      campaign_id: campaign.id,
      property_snapshot: request.body?.propertySnapshot ?? property,
      original_brief: normalizeNullableString(request.body?.briefText, 4000),
      attachments_snapshot: Array.isArray(request.body?.attachmentsSnapshot)
        ? request.body.attachmentsSnapshot
        : [],
      source_version: normalizeNullableString(request.body?.sourceVersion, 120),
    };
    await server.db.from("broker_campaign_briefs").upsert(briefPayload, { onConflict: "campaign_id" });

    const detail = await loadCampaignDetail(server, campaign.id);
    return reply.status(201).send(detail);
  });

  server.get<{ Params: { id: string } }>("/campaigns/:id", async (request, reply) => {
    if (request.params.id.startsWith("object:")) {
      const detail = await loadObjectDetail(server, request.params.id.slice("object:".length));
      if (!detail) {
        return reply.status(404).send({ error: "Объект не найден" });
      }
      return detail;
    }
    const detail = await loadCampaignDetail(server, request.params.id);
    if (!detail) {
      return reply.status(404).send({ error: "Кампания не найдена" });
    }
    return detail;
  });

  server.get<{ Params: { id: string } }>("/campaigns/:id/playbook", async (request, reply) => {
    const resolved = await resolvePlaybookTarget(server, request.params.id);
    if (!resolved) return reply.status(404).send({ error: "Объект не найден" });
    const { data, error } = await server.db
      .from("broker_company_playbooks")
      .select("id,company_key,company_name,status,subject,letter_body,ping_one,ping_two,ping_three,created_at,updated_at")
      .eq("company_key", resolved.companyKey)
      .maybeSingle<CompanyPlaybookRow>();
    if (error) return reply.status(500).send({ error: error.message });
    return data ?? {
      company_key: resolved.companyKey,
      company_name: resolved.companyName,
      status: "draft",
      subject: null,
      letter_body: null,
      ping_one: null,
      ping_two: null,
      ping_three: null,
    };
  });

  server.put<{ Params: { id: string }; Body: CompanyPlaybookBody }>("/campaigns/:id/playbook", async (request, reply) => {
    const resolved = await resolvePlaybookTarget(server, request.params.id);
    if (!resolved) return reply.status(404).send({ error: "Объект не найден" });
    const payload = {
      company_key: resolved.companyKey,
      company_name: normalizeString(request.body?.companyName, 240) || resolved.companyName,
      status: normalizeNullableString(request.body?.status, 80) || "draft",
      subject: normalizeNullableString(request.body?.subject, 4000),
      letter_body: normalizeNullableString(request.body?.letterBody, 20000),
      ping_one: normalizeNullableString(request.body?.pingOne, 20000),
      ping_two: normalizeNullableString(request.body?.pingTwo, 20000),
      ping_three: normalizeNullableString(request.body?.pingThree, 20000),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await server.db
      .from("broker_company_playbooks")
      .upsert(payload, { onConflict: "company_key" })
      .select("id,company_key,company_name,status,subject,letter_body,ping_one,ping_two,ping_three,created_at,updated_at")
      .maybeSingle<CompanyPlaybookRow>();
    if (error) return reply.status(500).send({ error: error.message });
    return data ?? payload;
  });

  server.patch<{ Params: { id: string }; Body: CampaignBody }>("/campaigns/:id", async (request, reply) => {
    const payload = buildCampaignPatchPayload(request.body);
    const { data, error } = await server.db
      .from("broker_campaigns")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();
    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Кампания не найдена" });

    const briefPayload = buildCampaignBriefPatchPayload(request.body);
    if (Object.keys(briefPayload).length > 0) {
      const { error: briefError } = await server.db
        .from("broker_campaign_briefs")
        .update(briefPayload)
        .eq("campaign_id", request.params.id);
      if (briefError) return reply.status(500).send({ error: briefError.message });
    }

    const detail = await loadCampaignDetail(server, request.params.id);
    return detail ?? data;
  });

  server.get<{ Params: { id: string } }>("/campaigns/:id/hypotheses", async (request, reply) => {
    const { data, error } = await server.db
      .from("broker_campaign_hypotheses")
      .select("*")
      .eq("campaign_id", request.params.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return { items: data ?? [] };
  });

  server.post<{ Params: { id: string }; Body: CampaignHypothesisBody }>("/campaigns/:id/hypotheses", async (request, reply) => {
    const auth = getAuthContext(request);
    const payload = buildCampaignHypothesisPayload(request.body, request.params.id, auth?.userId ?? null);
    if (!payload.segment_name) {
      return reply.status(400).send({ error: "Требуется segmentName" });
    }
    if (!payload.segment_type) {
      return reply.status(400).send({ error: "Требуется segmentType" });
    }

    const { data: campaign, error: campaignError } = await server.db
      .from("broker_campaigns")
      .select("id")
      .eq("id", request.params.id)
      .maybeSingle();
    if (campaignError) return reply.status(500).send({ error: campaignError.message });
    if (!campaign) return reply.status(404).send({ error: "Кампания не найдена" });

    const { data, error } = await server.db
      .from("broker_campaign_hypotheses")
      .insert(payload)
      .select("*")
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send(data);
  });

  server.patch<{ Params: { id: string }; Body: CampaignHypothesisBody }>("/campaign-hypotheses/:id", async (request, reply) => {
    const payload = buildCampaignHypothesisPatchPayload(request.body);
    const { data, error } = await server.db
      .from("broker_campaign_hypotheses")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();
    if (error) return reply.status(500).send({ error: error.message });
    if (!data) return reply.status(404).send({ error: "Гипотеза не найдена" });
    return data;
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

function buildCampaignPayload(body: CampaignBody | undefined, propertyId: string, brokerUserId: string | null) {
  return removeUndefined({
    property_id: propertyId,
    campaign_name: normalizeString(body?.campaignName, 240) || "Campaign",
    status: normalizeCampaignStatus(body?.status),
    objective: normalizeNullableString(body?.objective, 4000),
    owner_user_id: brokerUserId,
    start_date: normalizeNullableString(body?.startDate, 40),
    end_date: normalizeNullableString(body?.endDate, 40),
  });
}

function buildCampaignPatchPayload(body: CampaignBody | undefined) {
  return removeUndefined({
    property_id: body?.propertyId !== undefined ? normalizeString(body.propertyId, 80) : undefined,
    campaign_name: body?.campaignName !== undefined ? normalizeString(body.campaignName, 240) : undefined,
    status: body?.status !== undefined ? normalizeCampaignStatus(body.status) : undefined,
    objective: body?.objective !== undefined ? normalizeNullableString(body.objective, 4000) : undefined,
    start_date: body?.startDate !== undefined ? normalizeNullableString(body.startDate, 40) : undefined,
    end_date: body?.endDate !== undefined ? normalizeNullableString(body.endDate, 40) : undefined,
  });
}

function buildCampaignBriefPatchPayload(body: CampaignBody | undefined) {
  return removeUndefined({
    property_snapshot: body?.propertySnapshot !== undefined ? body.propertySnapshot : undefined,
    original_brief: body?.briefText !== undefined ? normalizeNullableString(body.briefText, 4000) : undefined,
    attachments_snapshot: body?.attachmentsSnapshot !== undefined
      ? (Array.isArray(body.attachmentsSnapshot) ? body.attachmentsSnapshot : [])
      : undefined,
    source_version: body?.sourceVersion !== undefined ? normalizeNullableString(body.sourceVersion, 120) : undefined,
  });
}

function buildCampaignHypothesisPayload(
  body: CampaignHypothesisBody | undefined,
  campaignId: string,
  createdBy: string | null,
) {
  return removeUndefined({
    campaign_id: campaignId,
    segment_name: normalizeString(body?.segmentName, 240),
    segment_type: normalizeString(body?.segmentType, 120),
    value_prop: normalizeNullableString(body?.valueProp, 4000),
    channel: normalizeNullableString(body?.channel, 120),
    priority: normalizeNumber(body?.priority) ?? 0,
    status: normalizeHypothesisStatus(body?.status),
    reasoning: normalizeNullableString(body?.reasoning, 4000),
    created_by: createdBy,
  });
}

function buildCampaignHypothesisPatchPayload(body: CampaignHypothesisBody | undefined) {
  return removeUndefined({
    segment_name: body?.segmentName !== undefined ? normalizeString(body.segmentName, 240) : undefined,
    segment_type: body?.segmentType !== undefined ? normalizeString(body.segmentType, 120) : undefined,
    value_prop: body?.valueProp !== undefined ? normalizeNullableString(body.valueProp, 4000) : undefined,
    channel: body?.channel !== undefined ? normalizeNullableString(body.channel, 120) : undefined,
    priority: body?.priority !== undefined ? normalizeNumber(body.priority) ?? 0 : undefined,
    status: body?.status !== undefined ? normalizeHypothesisStatus(body.status) : undefined,
    reasoning: body?.reasoning !== undefined ? normalizeNullableString(body.reasoning, 4000) : undefined,
  });
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(300, Math.round(parsed)));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function companyRegistryKey(companyName: string | null | undefined, email: string | null | undefined) {
  const name = normalizeString(companyName, 240).toLowerCase();
  if (name) return name;
  return normalizeString(email, 240).toLowerCase();
}

function objectGroupKey(value: string | null | undefined) {
  return canonicalObjectTitle(value).toLowerCase();
}

function stripHistoricalOutboundPrefix(value: string | null | undefined) {
  return normalizeString(value, 240).replace(/^historical outbound:\s*/i, "").trim();
}

function canonicalObjectTitle(value: string | null | undefined) {
  const stripped = stripHistoricalOutboundPrefix(value);
  return OBJECT_ALIASES[stripped] || stripped;
}

function preferLongerName(left: string, right: string) {
  return normalizeString(right).length > normalizeString(left).length ? right : left;
}

function mergeCampaignStats(items: Array<ReturnType<typeof emptyCampaignStats>>) {
  return items.reduce((acc, item) => ({
    firstTouchCount: acc.firstTouchCount + Number(item.firstTouchCount || 0),
    followUpCount: acc.followUpCount + Number(item.followUpCount || 0),
    repliedCount: acc.repliedCount + Number(item.repliedCount || 0),
    bouncedCount: acc.bouncedCount + Number(item.bouncedCount || 0),
    suppressedCount: acc.suppressedCount + Number(item.suppressedCount || 0),
    recipientCount: acc.recipientCount + Number(item.recipientCount || 0),
    companyCount: acc.companyCount + Number(item.companyCount || 0),
  }), emptyCampaignStats());
}

function isFirstTouchStatus(status: string) {
  return status === "sent" || status === "followed_up" || status === "replied" || status === "bounced";
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

async function loadCampaignDetail(server: FastifyInstance, campaignId: string) {
  const { data: campaign, error: campaignError } = await server.db
    .from("broker_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaign) return null;

  const [
    { data: property, error: propertyError },
    { data: brief, error: briefError },
    { data: hypotheses, error: hypothesesError },
    { data: targets, error: targetsError },
  ] = await Promise.all([
    server.db
      .from("properties")
      .select("id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status")
      .eq("id", campaign.property_id)
      .maybeSingle(),
    server.db
      .from("broker_campaign_briefs")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle(),
    server.db
      .from("broker_campaign_hypotheses")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    server.db
      .from("broker_campaign_targets")
      .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
      .eq("campaign_id", campaignId)
      .order("company_name", { ascending: true })
      .returns<CampaignTargetRow[]>(),
  ]);

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (briefError) {
    throw new Error(briefError.message);
  }
  if (hypothesesError) {
    throw new Error(hypothesesError.message);
  }
  if (targetsError) {
    throw new Error(targetsError.message);
  }

  const stats = summarizeCampaignTargets(targets || []);
  const companies = Array.from(groupCampaignTargetsByCompany(targets || []).values())
    .map((item) => ({
      companyName: item.companyName,
      firstTouchCount: item.firstTouchCount,
      followUpCount: item.followUpCount,
      uniqueEmailCount: item.uniqueEmails.size,
      recipients: item.recipients.sort((a, b) => String(a.email || "").localeCompare(String(b.email || ""))),
    }))
    .sort((a, b) =>
      (b.firstTouchCount + b.followUpCount) - (a.firstTouchCount + a.followUpCount) ||
      a.companyName.localeCompare(b.companyName),
    );

  return {
    ...campaign,
    campaign_name: canonicalObjectTitle(property?.title || campaign.campaign_name),
    property: property ?? null,
    brief: brief ?? null,
    hypotheses: hypotheses ?? [],
    stats,
    targetCompanies: companies,
    targets: targets ?? [],
  };
}

async function loadObjectDetail(server: FastifyInstance, objectKey: string) {
  const { data: campaigns, error } = await server.db
    .from("broker_campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const campaignRows = campaigns ?? [];
  const propertiesById = await loadPropertiesIndex(server, unique(campaignRows.map((item) => item.property_id).filter(Boolean)));
  const statsByCampaignId = await loadCampaignTargetStats(server, campaignRows.map((item) => item.id).filter(Boolean));
  const grouped = groupCampaignsByObject(campaignRows, propertiesById, statsByCampaignId);
  const objectSummary = grouped.find((item) => item.id === `object:${objectKey}`);
  if (!objectSummary) return null;

  const rawCampaigns = campaignRows.filter((campaign) =>
    objectGroupKey(propertiesById.get(campaign.property_id)?.title || campaign.campaign_name) === objectKey,
  );
  const rawCampaignIds = rawCampaigns.map((item) => item.id).filter(Boolean);

  const [
    { data: briefs, error: briefsError },
    { data: hypotheses, error: hypothesesError },
    { data: targets, error: targetsError },
  ] = await Promise.all([
    server.db.from("broker_campaign_briefs").select("*").in("campaign_id", rawCampaignIds),
    server.db
      .from("broker_campaign_hypotheses")
      .select("*")
      .in("campaign_id", rawCampaignIds)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    server.db
      .from("broker_campaign_targets")
      .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
      .in("campaign_id", rawCampaignIds)
      .order("company_name", { ascending: true })
      .returns<CampaignTargetRow[]>(),
  ]);

  if (briefsError) throw new Error(briefsError.message);
  if (hypothesesError) throw new Error(hypothesesError.message);
  if (targetsError) throw new Error(targetsError.message);

  const mergedTargets = targets ?? [];
  const targetCompanies = Array.from(groupCampaignTargetsByCompany(mergedTargets).values())
    .map((item) => ({
      companyName: item.companyName,
      firstTouchCount: item.firstTouchCount,
      followUpCount: item.followUpCount,
      uniqueEmailCount: item.uniqueEmails.size,
      recipients: item.recipients.sort((a, b) => String(a.email || "").localeCompare(String(b.email || ""))),
    }))
    .sort((a, b) =>
      (b.firstTouchCount + b.followUpCount) - (a.firstTouchCount + a.followUpCount) ||
      a.companyName.localeCompare(b.companyName),
    );

  return {
    id: objectSummary.id,
    campaign_name: objectSummary.campaign_name,
    property_id: objectSummary.property_id,
    property_ids: objectSummary.property_ids,
    campaign_ids: rawCampaignIds,
    status: objectSummary.status,
    objective: rawCampaigns.map((item) => normalizeString(item.objective, 4000)).filter(Boolean).join("\n\n"),
    property: objectSummary.property,
    brief: briefs?.[0] ?? null,
    briefs: briefs ?? [],
    hypotheses: hypotheses ?? [],
    stats: summarizeCampaignTargets(mergedTargets),
    targetCompanies,
    targets: mergedTargets,
  };
}

async function resolvePlaybookTarget(server: FastifyInstance, campaignId: string) {
  if (campaignId.startsWith("object:")) {
    const detail = await loadObjectDetail(server, campaignId.slice("object:".length));
    if (!detail) return null;
    return {
      companyKey: campaignId,
      companyName: String(detail.campaign_name || "Объект"),
    };
  }
  const detail = await loadCampaignDetail(server, campaignId);
  if (!detail) return null;
  const objectKey = `object:${objectGroupKey(detail.campaign_name || detail.property?.title || detail.property_id || campaignId)}`;
  return {
    companyKey: objectKey,
    companyName: String(detail.campaign_name || detail.property?.title || "Объект"),
  };
}

function emptyCampaignStats() {
  return {
    firstTouchCount: 0,
    followUpCount: 0,
    repliedCount: 0,
    bouncedCount: 0,
    suppressedCount: 0,
    recipientCount: 0,
    companyCount: 0,
  };
}

function summarizeCampaignTargets(targets: CampaignTargetRow[]) {
  const stats = emptyCampaignStats();
  stats.recipientCount = targets.length;
  stats.companyCount = unique(targets.map((item) => normalizeString(item.company_name, 240).toLowerCase()).filter(Boolean)).length;
  for (const target of targets) {
    if (isFirstTouchStatus(target.status)) stats.firstTouchCount += 1;
    if (target.status === "followed_up") stats.followUpCount += 1;
    if (target.status === "replied") stats.repliedCount += 1;
    if (target.status === "bounced") stats.bouncedCount += 1;
    if (target.status === "suppressed") stats.suppressedCount += 1;
  }
  return stats;
}

function groupCampaignTargetsByCompany(targets: CampaignTargetRow[]) {
  const byCompany = new Map<string, {
    companyName: string;
    firstTouchCount: number;
    followUpCount: number;
    uniqueEmails: Set<string>;
    recipients: Array<Record<string, unknown>>;
  }>();

  for (const target of targets) {
    const key = normalizeString(target.company_name, 240).toLowerCase() || target.email.toLowerCase();
    const item = byCompany.get(key) || {
      companyName: target.company_name || target.email,
      firstTouchCount: 0,
      followUpCount: 0,
      uniqueEmails: new Set<string>(),
      recipients: [],
    };
    if (isFirstTouchStatus(target.status)) item.firstTouchCount += 1;
    if (target.status === "followed_up") item.followUpCount += 1;
    item.uniqueEmails.add(target.email.toLowerCase());
    item.recipients.push({
      email: target.email,
      contactName: target.contact_name,
      status: target.status,
      objectRole: target.object_role,
      companyName: target.company_name,
    });
    byCompany.set(key, item);
  }

  return byCompany;
}

async function loadPropertiesIndex(server: FastifyInstance, propertyIds: string[]) {
  const result = new Map<string, PropertyIndexRow>();
  if (!propertyIds.length) return result;
  const { data, error } = await server.db
    .from("properties")
    .select("id,title,address,region")
    .in("id", propertyIds)
    .returns<PropertyIndexRow[]>();
  if (error) throw new Error(error.message);
  for (const item of data || []) result.set(item.id, item);
  return result;
}

function groupCampaignsByObject(
  campaigns: Array<Record<string, unknown>>,
  propertiesById: Map<string, PropertyIndexRow>,
  statsByCampaignId: Map<string, ReturnType<typeof emptyCampaignStats>>,
): AggregatedObjectRow[] {
  const grouped = new Map<string, AggregatedObjectRow>();

  for (const campaign of campaigns) {
    const propertyId = String(campaign.property_id || "");
    const property = propertyId ? propertiesById.get(propertyId) || null : null;
    const canonicalTitle = canonicalObjectTitle(property?.title || String(campaign.campaign_name || ""));
    const key = objectGroupKey(canonicalTitle);
    const current: AggregatedObjectRow = grouped.get(key) || {
      id: `object:${key}`,
      campaign_name: canonicalTitle,
      property_id: propertyId,
      property_ids: [],
      property: property,
      status: String(campaign.status || "draft"),
      objective: String(campaign.objective || ""),
      updated_at: String(campaign.updated_at || ""),
      _stats: [],
    };

    current.property_ids = unique([...current.property_ids, propertyId].filter(Boolean));
    if (!current.property_id) current.property_id = propertyId;
    if (!current.property && property) current.property = property;
    if (String(campaign.updated_at || "") > String(current.updated_at || "")) {
      current.updated_at = String(campaign.updated_at || "");
      current.status = String(campaign.status || current.status || "draft");
      current.objective = String(campaign.objective || current.objective || "");
    }
    current._stats?.push(
      statsByCampaignId.get(String(campaign.id || "")) || emptyCampaignStats(),
    );
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      stats: mergeCampaignStats(item._stats || []),
    }))
    .map(({ _stats, ...item }) => item)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

async function loadCampaignTargetStats(server: FastifyInstance, campaignIds: string[]) {
  const result = new Map<string, ReturnType<typeof emptyCampaignStats>>();
  if (!campaignIds.length) return result;
  const { data, error } = await server.db
    .from("broker_campaign_targets")
    .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
    .in("campaign_id", campaignIds)
    .returns<CampaignTargetRow[]>();
  if (error) throw new Error(error.message);
  const byCampaign = new Map<string, CampaignTargetRow[]>();
  for (const row of data || []) {
    byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) || []), row]);
  }
  for (const campaignId of campaignIds) {
    result.set(campaignId, summarizeCampaignTargets(byCampaign.get(campaignId) || []));
  }
  return result;
}

async function loadRegistryClients(server: FastifyInstance, companyNames: string[], emails: string[]) {
  const byId = new Map<string, BrokerClientIndexRow>();

  if (emails.length) {
    const { data: emailMatches, error: emailError } = await server.db
      .from("broker_clients")
      .select("id,full_name,company,email,updated_at")
      .in("email", emails)
      .returns<BrokerClientIndexRow[]>();
    if (emailError) throw new Error(emailError.message);
    for (const client of emailMatches || []) byId.set(client.id, client);
  }

  if (companyNames.length) {
    const { data: companyMatches, error: companyError } = await server.db
      .from("broker_clients")
      .select("id,full_name,company,email,updated_at")
      .in("company", companyNames)
      .returns<BrokerClientIndexRow[]>();
    if (companyError) throw new Error(companyError.message);
    for (const client of companyMatches || []) byId.set(client.id, client);
  }

  return Array.from(byId.values());
}

async function loadRegistryTargets(server: FastifyInstance, companyNames: string[], emails: string[]) {
  const byId = new Map<string, CampaignTargetRow>();

  if (emails.length) {
    const { data: emailMatches, error: emailError } = await server.db
      .from("broker_campaign_targets")
      .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
      .in("email", emails)
      .returns<CampaignTargetRow[]>();
    if (emailError) throw new Error(emailError.message);
    for (const target of emailMatches || []) byId.set(target.id, target);
  }

  if (companyNames.length) {
    const { data: companyMatches, error: companyError } = await server.db
      .from("broker_campaign_targets")
      .select("id,campaign_id,company_name,contact_name,email,source,object_role,domain,status,created_at,updated_at")
      .in("company_name", companyNames)
      .returns<CampaignTargetRow[]>();
    if (companyError) throw new Error(companyError.message);
    for (const target of companyMatches || []) byId.set(target.id, target);
  }

  return Array.from(byId.values());
}
