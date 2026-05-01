import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envLoader = (
  process as typeof process & { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
if (fs.existsSync(".env")) envLoader?.(".env");
if (fs.existsSync(".env.local")) envLoader?.(".env.local");

const apply = process.argv.includes("--apply");
const workerRoot = path.resolve(process.cwd(), "..", "deal_worker");
const salesRoot = path.join(workerRoot, "assets", "sales_campaigns");

type PlaybookSeed = {
  objectName: string;
  subject: string;
  letterBody: string;
  pingOne?: string;
  pingTwo?: string;
  pingThree?: string;
};

const OBJECT_ALIASES: Record<string, string> = {
  "Аббакумово": "Аббакумово",
  "Торговые помещения в Пушкино": "Торговые помещения в Пушкино",
  "Ступино 12,97 га": "Ступино 12,97 га",
  "Можайск, 71,89 га": "Можайск, 71,89 га",
  "Офисное здание на Суворовской площади": "Офисное здание на Суворовской площади",
  "Мичуринский проспект": "Мичуринский проспект",
  "Коммерческое помещение на ул. 1905 года": "Коммерческое помещение на ул. 1905 года",
};

function requireEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function canonicalObjectTitle(value: string) {
  return OBJECT_ALIASES[value] || value;
}

function objectKey(value: string) {
  return `object:${canonicalObjectTitle(value).toLowerCase()}`;
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function parseSingleTemplate(filePath: string) {
  const raw = readText(filePath);
  const match = raw.match(/^Subject:\s*(.+?)\n\n([\s\S]+)$/);
  if (!match) throw new Error(`Template must start with 'Subject: ...' in ${filePath}`);
  return {
    subject: match[1].trim(),
    body: match[2].trim(),
  };
}

function parseSectionTemplate(filePath: string, sectionName: string) {
  const raw = readText(filePath);
  const pattern = new RegExp(`## ${escapeRegExp(sectionName)}\\n\\nSubject: ([^\\n]+)\\n\\n([\\s\\S]*?)(?=\\n---\\n|\\n## |$)`);
  const match = raw.match(pattern);
  if (!match) throw new Error(`Section ${sectionName} not found in ${filePath}`);
  return {
    subject: match[1].trim(),
    body: match[2].trim(),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSeeds(): PlaybookSeed[] {
  const emailTemplates = path.join(salesRoot, "2026-04-21_four_objects", "01_templates", "email_templates.md");
  const followupTemplates = path.join(salesRoot, "2026-04-21_four_objects", "01_templates", "followup_templates.md");
  const planTemplates = path.join(salesRoot, "2026-04-29_30_followup_plan", "01_templates");
  const april28Templates = path.join(salesRoot, "2026-04-28_plan", "01_templates");

  const abbakumovo = parseSectionTemplate(emailTemplates, "Abbakumovo Land");
  const pushkino = parseSingleTemplate(path.join(salesRoot, "2026-04-27_pushkino_yaroslavskoe_194k1", "01_templates", "first_touch.md"));
  const michurinskiy = parseSingleTemplate(path.join(salesRoot, "2026-04-27_michurinskiy_3", "01_templates", "first_touch.md"));
  const suvorovskaya = parseSingleTemplate(path.join(salesRoot, "2026-04-24_suvorovskaya_1_52k1", "01_templates", "first_touch.md"));
  const stupino = parseSectionTemplate(emailTemplates, "Stupino Land");
  const mozhaysk = parseSectionTemplate(emailTemplates, "Mozhaysk Land");
  const year1905 = parseSingleTemplate(path.join(salesRoot, "2026-04-29_moskva_1905_goda_4s1", "01_templates", "first_touch_1905_goda.md"));

  const abbakumovoFollowup = parseSectionTemplate(followupTemplates, "Abbakumovo Follow-up 1");
  const pushkinoFollowup = parseSingleTemplate(path.join(planTemplates, "pushkino_followup_1.md"));
  const michurinskiyFollowup = parseSingleTemplate(path.join(planTemplates, "michurinskiy_followup_1.md"));
  const stupinoFollowup = parseSingleTemplate(path.join(planTemplates, "staraya_sitnya_followup_1.md"));
  const suvorovskayaFollowup = parseSingleTemplate(path.join(april28Templates, "suvorovskaya_followup_1.md"));

  return [
    {
      objectName: "Аббакумово",
      subject: abbakumovo.subject,
      letterBody: abbakumovo.body,
      pingOne: abbakumovoFollowup.body,
    },
    {
      objectName: "Торговые помещения в Пушкино",
      subject: pushkino.subject,
      letterBody: pushkino.body,
      pingOne: pushkinoFollowup.body,
    },
    {
      objectName: "Ступино 12,97 га",
      subject: stupino.subject,
      letterBody: stupino.body,
      pingOne: stupinoFollowup.body,
    },
    {
      objectName: "Можайск, 71,89 га",
      subject: mozhaysk.subject,
      letterBody: mozhaysk.body,
    },
    {
      objectName: "Офисное здание на Суворовской площади",
      subject: suvorovskaya.subject,
      letterBody: suvorovskaya.body,
      pingOne: suvorovskayaFollowup.body,
    },
    {
      objectName: "Мичуринский проспект",
      subject: michurinskiy.subject,
      letterBody: michurinskiy.body,
      pingOne: michurinskiyFollowup.body,
    },
    {
      objectName: "Коммерческое помещение на ул. 1905 года",
      subject: year1905.subject,
      letterBody: year1905.body,
    },
  ];
}

async function upsertPlaybook(db: SupabaseClient, seed: PlaybookSeed) {
  const payload = {
    company_key: objectKey(seed.objectName),
    company_name: canonicalObjectTitle(seed.objectName),
    status: "running",
    subject: seed.subject,
    letter_body: seed.letterBody,
    ping_one: seed.pingOne ?? null,
    ping_two: seed.pingTwo ?? null,
    ping_three: seed.pingThree ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("broker_company_playbooks")
    .upsert(payload, { onConflict: "company_key" })
    .select("company_key,company_name,status")
    .maybeSingle();
  if (error) throw error;
  return data ?? payload;
}

async function main() {
  const seeds = buildSeeds();
  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      playbooks: seeds.map((item) => ({
        company_key: objectKey(item.objectName),
        company_name: canonicalObjectTitle(item.objectName),
        subject: item.subject,
        has_ping_one: Boolean(item.pingOne),
      })),
    }, null, 2));
    return;
  }

  const db = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const results = [];
  for (const seed of seeds) {
    results.push(await upsertPlaybook(db, seed));
  }
  console.log(JSON.stringify({ imported: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
