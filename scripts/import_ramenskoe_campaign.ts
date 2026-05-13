import fs from "node:fs";
import path from "node:path";
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

const campaignName = "Раменское, СП Рыболовское, 22,3 га";
const objective = "Продажа земельного массива 22,3 га под жилой квартал / КРТ. Первичный фокус: девелоперы жилых кварталов, игроки КРТ, застройщики малоэтажного жилья и земельные инвесторы.";

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
  "Раменское, СП Рыболовское, 22,3 га.",
  "4 смежных земельных участка под комплексное развитие территории.",
  "Цена: 150 000 000 рублей.",
  "Площадь: 223 000 м² / 22,3 га.",
  "Кадастровые номера: 50:23:0000000:153793; 50:23:0050373:2238; 50:23:0000000:153762; 50:23:0050373:2235.",
  "По концепции: 119 426 м² жилой продаваемой площади, максимальная высотность до 4-5 этажей, 3 981 житель, ДОО на 259 мест, школа на 537 мест, 1 424 машино-места.",
  "Ключевая задача покупателя: подтвердить градостроительный путь, КРТ / ГЗК, инженерные условия и финансовую модель очередности.",
].join("\n");

const attachments = [
  {
    label: "HTML-бриф",
    path: "assets/briefs/ramenskoe.html",
  },
  {
    label: "PDF-бриф",
    path: "assets/briefs/ramenskoe.pdf",
  },
  {
    label: "Реестр активов PDF",
    path: "assets/objects/Land/Ramenskoe/Реестр активов на реализацию_.pdf",
  },
  {
    label: "Градостроительный анализ PDF",
    path: "assets/objects/Land/Ramenskoe/Градостроительный анализ_от 30.09.pdf",
  },
  {
    label: "Инвестиционный и градостроительный анализ PDF",
    path: "assets/objects/Land/Ramenskoe/Концепция_№2_Градостроительный_и_инвестиционный_ан.pdf",
  },
];

const { error: briefError } = await db.from("broker_campaign_briefs").upsert(
  {
    campaign_id: campaignResult.data.id,
    property_snapshot: property,
    original_brief: briefText,
    attachments_snapshot: attachments,
    source_version: "ramenskoe-2026-05-13",
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
