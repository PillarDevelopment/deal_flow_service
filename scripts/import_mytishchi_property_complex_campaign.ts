import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envLoader = (
  process as typeof process & { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
if (fs.existsSync(".env")) envLoader?.(".env");
if (fs.existsSync(".env.local")) envLoader?.(".env.local");

function requireEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const db = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

const campaignName = "Имущественный комплекс в г. Мытищи";
const objective = "Продажа промышленной площадки 11,8 га с имущественным комплексом 58 000 м², коммуникациями и железнодорожной веткой. Фокус: производственные компании, складские и логистические операторы, индустриальные девелоперы.";

const { data: property, error: propertyError } = await db
  .from("properties")
  .select("id,title,address,region,price_rub,area_sqm,price_per_sqm,attributes,curation_status")
  .eq("title", campaignName)
  .maybeSingle();

if (propertyError) throw propertyError;
if (!property) throw new Error(`Property not found: ${campaignName}`);

const { data: existing, error: existingError } = await db
  .from("broker_campaigns")
  .select("id")
  .eq("property_id", property.id)
  .eq("campaign_name", campaignName)
  .maybeSingle();

if (existingError) throw existingError;

const payload = {
  property_id: property.id,
  campaign_name: campaignName,
  status: "running",
  objective,
  start_date: "2026-05-13",
  updated_at: new Date().toISOString(),
};

const campaignResult = existing?.id
  ? await db.from("broker_campaigns").update(payload).eq("id", existing.id).select("*").single()
  : await db.from("broker_campaigns").insert(payload).select("*").single();

if (campaignResult.error) throw campaignResult.error;

const briefText = [
  "Имущественный комплекс в г. Мытищи.",
  "Площадь участка: 118 000 м² / 11,8 га.",
  "Площадь зданий и сооружений: 58 000 м².",
  "ВРИ: промышленное использование.",
  "Железнодорожная ветка на участке.",
  "Газ: 3 408,59 тыс. м³.",
  "Водопотребление: 27,972 тыс. м³.",
  "Водоотведение: 25,454 тыс. м³.",
  "Поверхностные и сточные воды: 38,386 тыс. м³.",
  "Теплоэнергия: 6 392,4 Гкал.",
  "Электроэнергия: разрешенная мощность 4,6 МВт.",
  "СЗЗ: 100 м от основной группы источников выбросов и 50 м от границы территории.",
  "Стоимость: по запросу.",
].join("\n");

const attachments = [
  {
    label: "HTML-бриф",
    path: "assets/briefs/mytishchi-property-complex.html",
  },
  {
    label: "PDF-бриф",
    path: "assets/briefs/mytishchi-property-complex.pdf",
  },
  {
    label: "Исходное описание TXT",
    path: "assets/objects/Industrial/mytishchi_property_complex/about.txt",
  },
];

const { error: briefError } = await db.from("broker_campaign_briefs").upsert(
  {
    campaign_id: campaignResult.data.id,
    property_snapshot: property,
    original_brief: briefText,
    attachments_snapshot: attachments,
    source_version: "mytishchi-property-complex-2026-05-13",
  },
  { onConflict: "campaign_id" },
);

if (briefError) throw briefError;

console.log(JSON.stringify({
  imported: {
    property_id: property.id,
    campaign_id: campaignResult.data.id,
    title: property.title,
    status: campaignResult.data.status,
  },
}, null, 2));
