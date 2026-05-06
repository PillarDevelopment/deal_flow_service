import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envLoader = (
  process as typeof process & { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
if (fs.existsSync(".env")) envLoader?.(".env");
if (fs.existsSync(".env.local")) envLoader?.(".env.local");

const apply = process.argv.includes("--apply");
const workerRootArg = process.argv.find((arg) => arg.startsWith("--deal-worker-root="));
const workerRoot = workerRootArg
  ? path.resolve(process.cwd(), workerRootArg.replace("--deal-worker-root=", ""))
  : path.resolve(process.cwd(), "..", "deal_worker");
const salesCampaignRoot = path.join(workerRoot, "assets", "sales_campaigns");

type TrackerRow = {
  object: string;
  company: string;
  email: string;
  sent_date: string;
  reply_date: string;
  reply_type: string;
  interested: string;
  call_scheduled: string;
  materials_requested: string;
  status: string;
  next_action: string;
  notes: string;
};

type PropertyRow = {
  id: string;
  title: string;
  address: string | null;
  region: string | null;
  price_rub: number | null;
  area_sqm: number | null;
  price_per_sqm: number | null;
  attributes: Record<string, unknown> | null;
  curation_status: string | null;
};

const PROPERTY_ALIASES: Record<string, string> = {
  "Abbakumovo": "Аббакумово",
  "Suvorovskaya 1/52 k1": "Офисное здание на Суворовской площади",
  "Moskva 1905 goda 4s1": "Коммерческое помещение на ул. 1905 года",
  "Michurinskiy 3": "Мичуринский проспект",
  "Pushkino": "Торговые помещения в Пушкино",
  "Pushkino Yaroslavskoe 194k1": "Торговые помещения в Пушкино",
  "Stupino": "Ступино 12,97 га",
  "Stupino / Staraya Sitnya": "Ступино 12,97 га",
  "Mozhaysk": "Можайск, 71,89 га",
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
    if (char === '"') quoted = true;
    else if (char === ",") {
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

function findTrackerFiles() {
  const result: string[] = [];
  for (const entry of fs.readdirSync(salesCampaignRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const trackerPath = path.join(salesCampaignRoot, entry.name, "00_state", "response_tracker.csv");
    if (fs.existsSync(trackerPath)) result.push(trackerPath);
  }
  return result.sort();
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function domainFromEmail(email: string) {
  return String(email || "").split("@")[1]?.toLowerCase() || null;
}

function mapTargetStatus(status: string) {
  if (status === "followup_sent") return "followed_up";
  if (status === "published_but_bounced") return "bounced";
  if (status === "suppressed" || status === "complained" || status === "not_sendable_contact_form") return "suppressed";
  if (status.startsWith("replied") || status === "redirected" || status === "under_review") return "replied";
  return "sent";
}

function dateOrNull(value: string) {
  const text = String(value || "").trim();
  return text || null;
}

function trackerDateToIso(value: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  return `${text}T12:00:00.000+03:00`;
}

function campaignName(objectName: string) {
  return `Historical outbound: ${objectName}`;
}

function segmentFromNotes(notes: string) {
  const text = String(notes || "").trim();
  const [prefix] = text.split(":");
  const cleaned = prefix.trim();
  if (cleaned && cleaned.length <= 80 && cleaned !== text) return cleaned;
  return "historical_audience";
}

function buildOriginalBrief(rows: TrackerRow[], trackerPath: string) {
  const statuses = new Map<string, number>();
  for (const row of rows) {
    statuses.set(row.status, (statuses.get(row.status) || 0) + 1);
  }

  return compactLines([
    `Imported from ${path.relative(workerRoot, trackerPath)}`,
    `Companies/emails: ${unique(rows.map((row) => row.email.toLowerCase()).filter(Boolean)).length}`,
    `Rows: ${rows.length}`,
    `Statuses: ${Array.from(statuses.entries()).map(([key, count]) => `${key}=${count}`).join(", ")}`,
  ]);
}

async function getProperties(db: SupabaseClient) {
  const { data, error } = await db
    .from("properties")
    .select("id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status")
    .limit(1000)
    .returns<PropertyRow[]>();
  if (error) throw error;
  return data || [];
}

function propertyForObject(objectName: string, properties: PropertyRow[]) {
  const title = PROPERTY_ALIASES[objectName] || objectName;
  const property = properties.find((item) => item.title === title);
  if (!property) throw new Error(`No property mapping for object "${objectName}" -> "${title || ""}"`);
  return property;
}

async function upsertCampaign(db: SupabaseClient, property: PropertyRow, objectName: string, rows: TrackerRow[]) {
  const name = campaignName(objectName);
  const startDate = rows.map((row) => row.sent_date).filter(Boolean).sort()[0] || null;
  const endDate = rows
    .flatMap((row) => [row.reply_date, row.sent_date])
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  const payload = {
    property_id: property.id,
    campaign_name: name,
    status: "completed",
    objective: `Импорт исторической рассылки по объекту: ${objectName}`,
    owner_user_id: null,
    start_date: startDate,
    end_date: endDate,
  };

  const { data: existing, error: existingError } = await db
    .from("broker_campaigns")
    .select("id")
    .eq("property_id", property.id)
    .eq("campaign_name", name)
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await db
      .from("broker_campaigns")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, op: "updated" as const };
  }

  const { data, error } = await db
    .from("broker_campaigns")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return { id: data.id, op: "inserted" as const };
}

async function upsertBrief(db: SupabaseClient, campaignId: string, property: PropertyRow, rows: TrackerRow[], trackerPath: string) {
  const { error } = await db.from("broker_campaign_briefs").upsert({
    campaign_id: campaignId,
    property_snapshot: property,
    original_brief: buildOriginalBrief(rows, trackerPath),
    attachments_snapshot: [],
    source_version: "historical_response_tracker",
  }, { onConflict: "campaign_id" });
  if (error) throw error;
}

async function upsertHypotheses(db: SupabaseClient, campaignId: string, rows: TrackerRow[]) {
  const bySegment = new Map<string, TrackerRow[]>();
  for (const row of rows) {
    const segment = segmentFromNotes(row.notes);
    bySegment.set(segment, [...(bySegment.get(segment) || []), row]);
  }

  let count = 0;
  for (const [segment, segmentRows] of bySegment) {
    const example = segmentRows.find((row) => row.notes)?.notes || "";
    const payload = {
      campaign_id: campaignId,
      segment_name: segment,
      segment_type: segment,
      value_prop: example || `Historical segment ${segment}`,
      channel: "email",
      priority: segmentRows.length,
      status: "approved",
      reasoning: `Imported historical hypothesis from tracker rows: ${segmentRows.length}`,
      created_by: null,
    };

    const { data: existing, error: existingError } = await db
      .from("broker_campaign_hypotheses")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("segment_name", segment)
      .maybeSingle<{ id: string }>();
    if (existingError) throw existingError;

    if (existing?.id) {
      const { error } = await db
        .from("broker_campaign_hypotheses")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("broker_campaign_hypotheses").insert(payload);
      if (error) throw error;
    }
    count += 1;
  }
  return count;
}

async function upsertTargets(db: SupabaseClient, campaignId: string, rows: TrackerRow[]) {
  const byEmail = new Map<string, TrackerRow>();
  for (const row of rows) {
    const email = row.email.toLowerCase().trim();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (!existing || row.status === "followup_sent") byEmail.set(email, row);
  }

  const payload = Array.from(byEmail.values()).map((row) => ({
    campaign_id: campaignId,
    company_name: row.company || row.email,
    contact_name: null,
    email: row.email.toLowerCase().trim(),
    source: "historical_response_tracker",
    object_role: segmentFromNotes(row.notes),
    domain: domainFromEmail(row.email),
    status: mapTargetStatus(row.status),
    created_at: trackerDateToIso(row.sent_date) || trackerDateToIso(row.reply_date),
    updated_at: trackerDateToIso(row.reply_date) || trackerDateToIso(row.sent_date),
  }));

  if (!payload.length) return 0;
  const { error } = await db
    .from("broker_campaign_targets")
    .upsert(payload, { onConflict: "campaign_id,email" });
  if (error) throw error;
  return payload.length;
}

async function main() {
  const trackerFiles = findTrackerFiles();
  const allRows = trackerFiles.flatMap((trackerPath) =>
    readCsv<TrackerRow>(trackerPath).map((row) => ({ ...row, trackerPath })),
  );

  const rowsByObject = new Map<string, Array<TrackerRow & { trackerPath: string }>>();
  for (const row of allRows) {
    const objectName = row.object.trim();
    if (!objectName) continue;
    rowsByObject.set(objectName, [...(rowsByObject.get(objectName) || []), row]);
  }

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const properties = await getProperties(db);
  const summary = [];

  for (const [objectName, objectRows] of Array.from(rowsByObject.entries()).sort()) {
    const property = propertyForObject(objectName, properties);
    if (!apply) {
      summary.push({
        objectName,
        propertyTitle: property.title,
        rows: objectRows.length,
        targets: unique(objectRows.map((row) => row.email.toLowerCase()).filter(Boolean)).length,
        hypotheses: unique(objectRows.map((row) => segmentFromNotes(row.notes))).length,
      });
      continue;
    }

    const campaign = await upsertCampaign(db, property, objectName, objectRows);
    await upsertBrief(db, campaign.id, property, objectRows, objectRows[0].trackerPath);
    const hypotheses = await upsertHypotheses(db, campaign.id, objectRows);
    const targets = await upsertTargets(db, campaign.id, objectRows);
    summary.push({
      objectName,
      propertyTitle: property.title,
      campaignId: campaign.id,
      campaignOp: campaign.op,
      rows: objectRows.length,
      targets,
      hypotheses,
    });
  }

  console.log(JSON.stringify({ apply, campaigns: summary.length, summary }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
