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

const campaignName = "Волоколамск, 21,7 га у озера";
const objective = "Продажа закрытого земельного массива 21,7 га у озера. Фокус: частные покупатели крупной земли, семейные офисы, инвесторы в загородные проекты, девелоперы камерных поселков.";

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
  "Волоколамск, 21,7 га у озера.",
  "Локация: деревня Власьево, Волоколамский муниципальный округ, Московская область.",
  "Цена: 140 000 000 рублей.",
  "Площадь: 217 000 м² / 21,7 га.",
  "Кадастровые номера: 50:07:0000000:24532; 50:07:0060311:268.",
  "Назначение: 14,38 га под дачное строительство; 7,3 га земли сельхозназначения.",
  "Инфраструктура: ограждение, гравийная дорога, электроподстанция с трансформатором, скважина, большая баня, двухэтажный дом для персонала.",
  "Сценарии: частное поместье, семейная резиденция, клубная усадьба, камерный загородный проект.",
].join("\n");

const attachments = [
  {
    label: "HTML-бриф",
    path: "assets/briefs/volokolamsk.html",
  },
  {
    label: "PDF-бриф",
    path: "assets/briefs/volokolamsk.pdf",
  },
  {
    label: "Исходное описание TXT",
    path: "assets/objects/Land/Volokolamsk/about.txt",
  },
];

const { error: briefError } = await db.from("broker_campaign_briefs").upsert(
  {
    campaign_id: campaignResult.data.id,
    property_snapshot: property,
    original_brief: briefText,
    attachments_snapshot: attachments,
    source_version: "volokolamsk-2026-05-13",
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
