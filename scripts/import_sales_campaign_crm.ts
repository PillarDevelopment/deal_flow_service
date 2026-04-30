import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envLoader = (
  process as typeof process & { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
if (fs.existsSync(".env")) envLoader?.(".env");
if (fs.existsSync(".env.local")) envLoader?.(".env.local");

const campaignDirArg = process.argv.find((arg) => arg.startsWith("--campaign-dir="));
const apply = process.argv.includes("--apply");
const defaultCampaignDir = path.resolve(
  process.cwd(),
  "..",
  "deal_worker",
  "assets",
  "sales_campaigns",
  "2026-04-21_four_objects",
  "05_crm",
);
const campaignDir = campaignDirArg
  ? path.resolve(process.cwd(), campaignDirArg.replace("--campaign-dir=", ""))
  : defaultCampaignDir;

type Campaign = {
  campaign_id: string;
  campaign_name: string;
};

type CrmObject = {
  object_id: string;
  object_name: string;
  asset_type: string;
  region: string;
};

type Company = {
  company_id: string;
  company_name: string;
  segment: string;
  source_url: string;
  fit_notes: string;
};

type Contact = {
  contact_id: string;
  company_id: string;
  company_name: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  contact_type: string;
  source_url: string;
  status: string;
};

type Deal = {
  deal_id: string;
  campaign_id: string;
  object_id: string;
  object_name: string;
  company_id: string;
  company_name: string;
  primary_contact_id: string;
  stage: string;
  interest_level: string;
  first_touch_date: string;
  last_event_date: string;
  last_sender_domain: string;
  materials_requested: string;
  brief_sent: string;
  cadastre_sent: string;
  touch_count: string;
  reply_count: string;
  bounce_count: string;
  next_action: string;
  notes: string;
};

type Event = {
  event_id: string;
  campaign_id: string;
  object_id: string;
  object_name: string;
  company_id: string;
  company_name: string;
  contact_id: string;
  email: string;
  event_date: string;
  event_type: string;
  event_status: string;
  sender_domain: string;
  source_file: string;
  details: string;
};

type BrokerClientRow = {
  id: string;
  full_name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  lead_source: string | null;
  budget_from: number | null;
  budget_to: number | null;
  regions_of_interest: string[];
  asset_types_of_interest: string[];
  investment_goal: string | null;
  status: string;
  notes: string | null;
  broker_user_id: string | null;
};

type BrokerDealRow = {
  id: string;
  client_id: string;
  title: string;
  stage: string;
  priority: string;
  broker_user_id: string | null;
  next_step: string | null;
  next_step_due_at: string | null;
  last_contact_at: string | null;
  deal_notes: string | null;
  is_archived: boolean;
};

type BrokerActivityRow = {
  id: string;
  deal_id: string;
  client_id: string | null;
  activity_type: string;
  comment: string;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

function requireEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readCsv<T>(filePath: string): T[] {
  const text = fs.readFileSync(filePath, "utf8");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((item) => item.length === header.length)
    .map((item) => Object.fromEntries(header.map((key, index) => [key, item[index] || ""])) as T);
}

function isoDateToTs(value: string) {
  const text = String(value || "").trim();
  return text ? `${text}T12:00:00.000Z` : null;
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function mapDealStage(stage: string) {
  switch (stage) {
    case "prospect_not_contacted":
      return "new_lead";
    case "first_touch_sent":
    case "followup_1_sent":
    case "redirected":
      return "contacted";
    case "under_review":
    case "interested":
      return "qualified";
    case "materials_requested":
      return "objects_sent";
    case "not_fit":
      return "lost";
    case "needs_alt_contact":
      return "new_lead";
    default:
      return "new_lead";
  }
}

function mapPriority(deal: Deal) {
  if (deal.stage === "materials_requested" || deal.stage === "interested") return "high";
  if (deal.stage === "not_fit") return "low";
  return "normal";
}

function mapActivityType(eventType: string) {
  if (eventType === "first_touch" || eventType === "followup_1") return "message";
  if (eventType === "materials_request" || eventType === "positive_interest" || eventType === "not_fit_current_criteria" || eventType === "redirect_to_other_contact" || eventType === "forwarded_internal") return "feedback";
  if (eventType === "contact_form_only") return "note";
  if (eventType === "bounce") return "note";
  return "note";
}

function makeClientLeadSource(campaignId: string, companyId: string) {
  return `sales_campaign:${campaignId}:${companyId}`;
}

function makeDealTitle(objectName: string, companyName: string) {
  return `${objectName} — ${companyName}`;
}

function makeDealNotes(deal: Deal, company: Company, contacts: Contact[]) {
  const knownContacts = contacts
    .map((contact) => {
      const name = contact.full_name || "";
      const email = contact.email || "";
      const phone = contact.phone || "";
      return [name, email, phone].filter(Boolean).join(" / ");
    })
    .filter(Boolean);

  return compactLines([
    `source_deal_id=${deal.deal_id}`,
    company.fit_notes,
    deal.notes,
    knownContacts.length ? `Known contacts:\n- ${knownContacts.join("\n- ")}` : "",
  ]);
}

function buildClientNotes(company: Company, contacts: Contact[]) {
  const lines = contacts.map((contact) => {
    const roleBits = [contact.full_name, contact.role, contact.contact_type, contact.email, contact.phone]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return roleBits.join(" / ");
  });

  return compactLines([
    company.fit_notes,
    company.source_url ? `source_url=${company.source_url}` : "",
    lines.length ? `Contacts:\n- ${lines.join("\n- ")}` : "",
  ]);
}

async function findExistingClient(db: SupabaseClient, leadSource: string) {
  const { data, error } = await db
    .from("broker_clients")
    .select("id, full_name, company, email, phone, lead_source, regions_of_interest, asset_types_of_interest, notes")
    .eq("lead_source", leadSource)
    .limit(1)
    .maybeSingle<BrokerClientRow>();
  if (error) throw error;
  return data;
}

async function upsertClient(db: SupabaseClient, payload: Omit<BrokerClientRow, "id">) {
  const existing = await findExistingClient(db, String(payload.lead_source || ""));
  if (existing) {
    const { data, error } = await db
      .from("broker_clients")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    return { id: String(data?.id || existing.id), op: "updated" as const };
  }
  const { data, error } = await db
    .from("broker_clients")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return { id: String(data.id), op: "inserted" as const };
}

async function findExistingDeal(db: SupabaseClient, clientId: string, title: string) {
  const { data, error } = await db
    .from("broker_deals")
    .select("id, title, client_id, deal_notes")
    .eq("client_id", clientId)
    .eq("title", title)
    .limit(1)
    .maybeSingle<BrokerDealRow>();
  if (error) throw error;
  return data;
}

async function upsertDeal(db: SupabaseClient, payload: Omit<BrokerDealRow, "id">) {
  const existing = await findExistingDeal(db, payload.client_id, payload.title);
  if (existing) {
    const { data, error } = await db
      .from("broker_deals")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) throw error;
    return { id: String(data?.id || existing.id), op: "updated" as const };
  }
  const { data, error } = await db
    .from("broker_deals")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return { id: String(data.id), op: "inserted" as const };
}

async function getExistingActivities(db: SupabaseClient, dealId: string) {
  const { data, error } = await db
    .from("broker_deal_activities")
    .select("id, payload")
    .eq("deal_id", dealId)
    .limit(1000)
    .returns<Array<Pick<BrokerActivityRow, "id" | "payload">>>();
  if (error) throw error;
  return new Map(
    (data || []).map((row) => [String((row.payload || {})["source_event_id"] || ""), row.id]),
  );
}

async function insertActivity(db: SupabaseClient, payload: Omit<BrokerActivityRow, "id">) {
  const { error } = await db.from("broker_deal_activities").insert(payload);
  if (error) throw error;
}

async function main() {
  const campaign = readCsv<Campaign>(path.join(campaignDir, "campaigns.csv"))[0];
  const objects = readCsv<CrmObject>(path.join(campaignDir, "objects.csv"));
  const companies = readCsv<Company>(path.join(campaignDir, "companies.csv"));
  const contacts = readCsv<Contact>(path.join(campaignDir, "contacts.csv"));
  const deals = readCsv<Deal>(path.join(campaignDir, "deals.csv"));
  const events = readCsv<Event>(path.join(campaignDir, "outreach_events.csv"));

  const objectsById = new Map(objects.map((row) => [row.object_id, row]));
  const companyById = new Map(companies.map((row) => [row.company_id, row]));
  const contactsByCompany = new Map<string, Contact[]>();
  const contactsById = new Map(contacts.map((row) => [row.contact_id, row]));
  for (const contact of contacts) {
    const bucket = contactsByCompany.get(contact.company_id) || [];
    bucket.push(contact);
    contactsByCompany.set(contact.company_id, bucket);
  }
  const eventsByDealSource = new Map<string, Event[]>();
  for (const event of events) {
    const bucket = eventsByDealSource.get(`${event.company_id}|${event.object_id}`) || [];
    bucket.push(event);
    eventsByDealSource.set(`${event.company_id}|${event.object_id}`, bucket);
  }

  const summary = {
    clientsInserted: 0,
    clientsUpdated: 0,
    dealsInserted: 0,
    dealsUpdated: 0,
    activitiesInserted: 0,
    activitiesSkipped: 0,
  };

  if (!apply) {
    console.log(`dry-run campaign=${campaign.campaign_id}`);
    console.log(`companies=${companies.length} contacts=${contacts.length} deals=${deals.length} events=${events.length}`);
    for (const deal of deals.slice(0, 10)) {
      const company = companyById.get(deal.company_id);
      const object = objectsById.get(deal.object_id);
      const dealContacts = contactsByCompany.get(deal.company_id) || [];
      const primary = contactsById.get(deal.primary_contact_id) || dealContacts[0];
      console.log(JSON.stringify({
        client: {
          full_name: primary?.full_name || company?.company_name || deal.company_name,
          company: company?.company_name || deal.company_name,
          email: primary?.email || null,
          phone: primary?.phone || null,
          lead_source: makeClientLeadSource(campaign.campaign_id, deal.company_id),
        },
        deal: {
          title: makeDealTitle(deal.object_name, deal.company_name),
          stage: mapDealStage(deal.stage),
          priority: mapPriority(deal),
          next_step: deal.next_action || null,
          region: object?.region || "",
          asset_type: object?.asset_type || "",
        },
      }));
    }
    return;
  }

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  for (const deal of deals) {
    const company = companyById.get(deal.company_id);
    if (!company) throw new Error(`Company not found for deal ${deal.deal_id}`);
    const object = objectsById.get(deal.object_id);
    if (!object) throw new Error(`Object not found for deal ${deal.deal_id}`);

    const companyContacts = contactsByCompany.get(deal.company_id) || [];
    const primary = contactsById.get(deal.primary_contact_id) || companyContacts[0];

    const clientPayload: Omit<BrokerClientRow, "id"> = {
      full_name: primary?.full_name || deal.company_name,
      company: deal.company_name,
      phone: primary?.phone || null,
      email: primary?.email || null,
      telegram: null,
      lead_source: makeClientLeadSource(campaign.campaign_id, deal.company_id),
      budget_from: null,
      budget_to: null,
      regions_of_interest: unique([object.region].filter(Boolean)),
      asset_types_of_interest: unique([object.asset_type].filter(Boolean)),
      investment_goal: null,
      status: deal.stage === "not_fit" ? "archived" : "active",
      notes: buildClientNotes(company, companyContacts),
      broker_user_id: null,
    };

    const clientResult = await upsertClient(db, clientPayload);
    if (clientResult.op === "inserted") summary.clientsInserted += 1;
    else summary.clientsUpdated += 1;

    const dealPayload: Omit<BrokerDealRow, "id"> = {
      client_id: clientResult.id,
      title: makeDealTitle(deal.object_name, deal.company_name),
      stage: mapDealStage(deal.stage),
      priority: mapPriority(deal),
      broker_user_id: null,
      next_step: deal.next_action || null,
      next_step_due_at: null,
      last_contact_at: isoDateToTs(deal.last_event_date),
      deal_notes: makeDealNotes(deal, company, companyContacts),
      is_archived: deal.stage === "not_fit",
    };

    const dealResult = await upsertDeal(db, dealPayload);
    if (dealResult.op === "inserted") summary.dealsInserted += 1;
    else summary.dealsUpdated += 1;

    const existingActivities = await getExistingActivities(db, dealResult.id);
    const sourceEvents = (eventsByDealSource.get(`${deal.company_id}|${deal.object_id}`) || [])
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    for (const event of sourceEvents) {
      if (existingActivities.has(event.event_id)) {
        summary.activitiesSkipped += 1;
        continue;
      }
      const activityPayload: Omit<BrokerActivityRow, "id"> = {
        deal_id: dealResult.id,
        client_id: clientResult.id,
        activity_type: mapActivityType(event.event_type),
        comment: compactLines([
          `${event.event_type}: ${event.details}`,
          event.email ? `email=${event.email}` : "",
          event.sender_domain ? `sender_domain=${event.sender_domain}` : "",
        ]),
        payload: {
          source_event_id: event.event_id,
          source_event_type: event.event_type,
          source_event_status: event.event_status,
          source_email: event.email,
          source_sender_domain: event.sender_domain,
          source_file: event.source_file,
          object_name: event.object_name,
          company_name: event.company_name,
        },
        created_by: null,
        created_at: isoDateToTs(event.event_date) || new Date().toISOString(),
      };
      await insertActivity(db, activityPayload);
      summary.activitiesInserted += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
