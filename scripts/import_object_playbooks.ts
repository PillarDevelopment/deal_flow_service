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
const PLAYBOOK_PLAN_MARKER_PREFIX = "\n<!--broker_plan:";
const PLAYBOOK_PLAN_MARKER_SUFFIX = "-->";

type PlaybookSeed = {
  objectName: string;
  subject: string;
  letterBody: string;
  pingOne?: string;
  pingTwo?: string;
  pingThree?: string;
  monthlyPlan: {
    firstTouchTarget: number;
    followUpTarget: number;
    uniqueCompaniesTarget: number;
  };
  weeklyPlan: {
    firstTouchTarget: number;
    followUpTarget: number;
    uniqueCompaniesTarget: number;
  };
  dailyPlan: {
    firstTouchTarget: number;
    followUpTarget: number;
    uniqueCompaniesTarget: number;
  };
};

const OBJECT_ALIASES: Record<string, string> = {
  "Аббакумово": "Аббакумово",
  "Abbakumovo": "Аббакумово",
  "Торговые помещения в Пушкино": "Торговые помещения в Пушкино",
  "Pushkino": "Торговые помещения в Пушкино",
  "Ступино 12,97 га": "Ступино 12,97 га",
  "Stupino / Staraya Sitnya": "Ступино 12,97 га",
  "Можайск, 71,89 га": "Можайск, 71,89 га",
  "Mozhaysk": "Можайск, 71,89 га",
  "Офисное здание на Суворовской площади": "Офисное здание на Суворовской площади",
  "Мичуринский проспект": "Мичуринский проспект",
  "Michurinskiy 3": "Мичуринский проспект",
  "Коммерческое помещение на ул. 1905 года": "Коммерческое помещение на ул. 1905 года",
  "Moskva 1905 goda 4s1": "Коммерческое помещение на ул. 1905 года",
  "Бизнес-квартал Прокшино": "Бизнес-квартал Прокшино",
  "Офисный центр на ул. Эдварда Грига": "Офисный центр на ул. Эдварда Грига",
  "Испанские кварталы, коммерческий лот": "Испанские кварталы, коммерческий лот",
  "Деснаречье, торговое помещение": "Деснаречье, торговое помещение",
  "Дзен-кварталы, торговое помещение": "Дзен-кварталы, торговое помещение",
  "Новый Арбат, 5": "Новый Арбат, 5",
  "Дмитрия Ульянова, 24": "Дмитрия Ульянова, 24",
  "Большая Полянка, 42 стр. 2": "Большая Полянка, 42 стр. 2",
  "Полянка 42": "Большая Полянка, 42 стр. 2",
  "Раменское, СП Рыболовское, 22,3 га": "Раменское, СП Рыболовское, 22,3 га",
  "Раменское": "Раменское, СП Рыболовское, 22,3 га",
  "Ramenskoe": "Раменское, СП Рыболовское, 22,3 га",
};

type CsvRow = Record<string, string>;

type WeekPlanOverride = {
  weeklyFirstTouchTarget: number;
  dailyFirstTouchTarget: number;
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

function plan(firstTouchTarget: number, followUpTarget: number, uniqueCompaniesTarget: number) {
  return { firstTouchTarget, followUpTarget, uniqueCompaniesTarget };
}

function parseCsv(text: string) {
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

  const [header = [], ...body] = rows;
  return body
    .filter((item) => item.length === header.length)
    .map((item) => Object.fromEntries(header.map((key, index) => [key, item[index] || ""])) as CsvRow);
}

function isMissingPlaybookPlanColumnError(error: { message?: string; code?: string } | null) {
  const message = String(error?.message || "");
  return message.includes("monthly_plan") || message.includes("weekly_plan") || message.includes("daily_plan");
}

function embedPlansInLetterBody(seed: PlaybookSeed) {
  const serialized = JSON.stringify({
    monthlyPlan: seed.monthlyPlan,
    weeklyPlan: seed.weeklyPlan,
    dailyPlan: seed.dailyPlan,
  });
  return `${seed.letterBody.trimEnd()}${PLAYBOOK_PLAN_MARKER_PREFIX}${serialized}${PLAYBOOK_PLAN_MARKER_SUFFIX}`;
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

function loadCurrentWeekOverrides() {
  const planPath = path.join(
    salesRoot,
    "2026-05-11_15_week_new_companies_plan",
    "03_lists",
    "week_allocation_2026-05-11_15.csv",
  );

  if (!fs.existsSync(planPath)) return new Map<string, WeekPlanOverride>();

  const rows = parseCsv(readText(planPath));
  const targetDate = "2026-05-11";
  const bucket = new Map<string, WeekPlanOverride>();

  for (const row of rows) {
    const objectName = canonicalObjectTitle(String(row.object || ""));
    const newCompanies = Number(String(row.new_companies || "0"));
    if (!objectName || !Number.isFinite(newCompanies) || newCompanies <= 0) continue;

    const current = bucket.get(objectName) || {
      weeklyFirstTouchTarget: 0,
      dailyFirstTouchTarget: 0,
    };
    current.weeklyFirstTouchTarget += newCompanies;
    if (String(row.date || "") === targetDate) current.dailyFirstTouchTarget += newCompanies;
    bucket.set(objectName, current);
  }

  return bucket;
}

function buildSeeds(): PlaybookSeed[] {
  const emailTemplates = path.join(salesRoot, "2026-04-21_four_objects", "01_templates", "email_templates.md");
  const followupTemplates = path.join(salesRoot, "2026-04-21_four_objects", "01_templates", "followup_templates.md");
  const planTemplates = path.join(salesRoot, "2026-04-29_30_followup_plan", "01_templates");
  const april28Templates = path.join(salesRoot, "2026-04-28_plan", "01_templates");
  const may11Templates = path.join(salesRoot, "2026-05-11_15_week_new_companies_plan", "01_templates");
  const premisesTemplates = path.join(salesRoot, "2026-05-07_premises_7_objects_200", "01_templates");

  const abbakumovo = parseSectionTemplate(emailTemplates, "Abbakumovo Land");
  const pushkino = parseSingleTemplate(path.join(salesRoot, "2026-05-04_weekly_7_objects", "01_templates", "pushkino_first_touch.md"));
  const michurinskiy = parseSingleTemplate(path.join(salesRoot, "2026-05-04_weekly_7_objects", "01_templates", "michurinskiy_first_touch.md"));
  const suvorovskaya = parseSingleTemplate(path.join(salesRoot, "2026-04-24_suvorovskaya_1_52k1", "01_templates", "first_touch.md"));
  const stupino = parseSectionTemplate(emailTemplates, "Stupino Land");
  const mozhaysk = parseSectionTemplate(emailTemplates, "Mozhaysk Land");
  const year1905 = parseSingleTemplate(path.join(salesRoot, "2026-04-29_moskva_1905_goda_4s1", "01_templates", "first_touch_1905_goda.md"));
  const dmitriya = parseSingleTemplate(path.join(premisesTemplates, "dmitriya_ulyanova_24_first_touch.md"));
  const novyyArbat = parseSingleTemplate(path.join(premisesTemplates, "novyy_arbat_5_first_touch.md"));
  const prokshino = parseSingleTemplate(path.join(premisesTemplates, "biznes_kvartal_prokshino_first_touch.md"));
  const griga = parseSingleTemplate(path.join(premisesTemplates, "edvarda_griga_first_touch.md"));
  const desnareche = parseSingleTemplate(path.join(premisesTemplates, "desnareche_first_touch.md"));
  const dzen = parseSingleTemplate(path.join(premisesTemplates, "dzen_kvartaly_first_touch.md"));
  const ispanskie = parseSingleTemplate(path.join(premisesTemplates, "ispanskie_kvartaly_first_touch.md"));
  const polyanka = parseSingleTemplate(path.join(may11Templates, "polyanka_42_first_touch.md"));

  const abbakumovoFollowup = parseSectionTemplate(followupTemplates, "Abbakumovo Follow-up 1");
  const pushkinoFollowup = parseSingleTemplate(path.join(planTemplates, "pushkino_followup_1.md"));
  const michurinskiyFollowup = parseSingleTemplate(path.join(planTemplates, "michurinskiy_followup_1.md"));
  const stupinoFollowup = parseSingleTemplate(path.join(planTemplates, "staraya_sitnya_followup_1.md"));
  const suvorovskayaFollowup = parseSingleTemplate(path.join(april28Templates, "suvorovskaya_followup_1.md"));
  const weekOverrides = loadCurrentWeekOverrides();

  const seeds: PlaybookSeed[] = [
    {
      objectName: "Аббакумово",
      subject: abbakumovo.subject,
      letterBody: abbakumovo.body,
      pingOne: abbakumovoFollowup.body,
      monthlyPlan: plan(45, 30, 35),
      weeklyPlan: plan(12, 8, 10),
      dailyPlan: plan(3, 2, 3),
    },
    {
      objectName: "Торговые помещения в Пушкино",
      subject: pushkino.subject,
      letterBody: pushkino.body,
      pingOne: pushkinoFollowup.body,
      monthlyPlan: plan(90, 45, 70),
      weeklyPlan: plan(24, 12, 18),
      dailyPlan: plan(5, 2, 4),
    },
    {
      objectName: "Ступино 12,97 га",
      subject: stupino.subject,
      letterBody: stupino.body,
      pingOne: stupinoFollowup.body,
      monthlyPlan: plan(75, 35, 60),
      weeklyPlan: plan(20, 9, 15),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Можайск, 71,89 га",
      subject: mozhaysk.subject,
      letterBody: mozhaysk.body,
      monthlyPlan: plan(120, 45, 90),
      weeklyPlan: plan(30, 12, 22),
      dailyPlan: plan(6, 2, 5),
    },
    {
      objectName: "Офисное здание на Суворовской площади",
      subject: suvorovskaya.subject,
      letterBody: suvorovskaya.body,
      pingOne: suvorovskayaFollowup.body,
      monthlyPlan: plan(60, 55, 50),
      weeklyPlan: plan(15, 14, 12),
      dailyPlan: plan(3, 3, 3),
    },
    {
      objectName: "Мичуринский проспект",
      subject: michurinskiy.subject,
      letterBody: michurinskiy.body,
      pingOne: michurinskiyFollowup.body,
      monthlyPlan: plan(70, 35, 55),
      weeklyPlan: plan(18, 9, 14),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Коммерческое помещение на ул. 1905 года",
      subject: year1905.subject,
      letterBody: year1905.body,
      monthlyPlan: plan(110, 50, 85),
      weeklyPlan: plan(28, 13, 21),
      dailyPlan: plan(6, 3, 5),
    },
    {
      objectName: "Дмитрия Ульянова, 24",
      subject: dmitriya.subject,
      letterBody: dmitriya.body,
      pingOne: "Возвращаюсь по помещению на Дмитрия Ульянова, 24. Если вам нужен небольшой понятный формат у метро, это один из самых удобных вариантов для быстрого запуска.",
      monthlyPlan: plan(90, 40, 70),
      weeklyPlan: plan(22, 10, 17),
      dailyPlan: plan(5, 2, 4),
    },
    {
      objectName: "Новый Арбат, 5",
      subject: novyyArbat.subject,
      letterBody: novyyArbat.body,
      pingOne: "Возвращаюсь по Новому Арбату, 5. Это объект для крупных брендов, ресторанных групп и покупки под собственное размещение.",
      monthlyPlan: plan(35, 18, 28),
      weeklyPlan: plan(9, 4, 7),
      dailyPlan: plan(2, 1, 1),
    },
    {
      objectName: "Бизнес-квартал Прокшино",
      subject: prokshino.subject,
      letterBody: prokshino.body,
      pingOne: "Возвращаюсь по Бизнес-кварталу Прокшино. Если вам нужен офис для своей компании или понятный объект у метро, его стоит посмотреть в числе первых.",
      monthlyPlan: plan(70, 30, 52),
      weeklyPlan: plan(18, 8, 14),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Офисный центр на ул. Эдварда Грига",
      subject: griga.subject,
      letterBody: griga.body,
      pingOne: "Возвращаюсь по офисному центру на ул. Эдварда Грига. Если вам нужно здание целиком под свои задачи, это хороший вариант для предметного разговора.",
      monthlyPlan: plan(55, 25, 42),
      weeklyPlan: plan(14, 6, 11),
      dailyPlan: plan(3, 1, 2),
    },
    {
      objectName: "Деснаречье, торговое помещение",
      subject: desnareche.subject,
      letterBody: desnareche.body,
      pingOne: "Возвращаюсь по помещению в Деснаречье. Для тех, кто ищет ранний вход в жилой район с понятным бюджетом, это один из самых удобных вариантов.",
      monthlyPlan: plan(100, 40, 78),
      weeklyPlan: plan(25, 10, 20),
      dailyPlan: plan(5, 2, 4),
    },
    {
      objectName: "Дзен-кварталы, торговое помещение",
      subject: dzen.subject,
      letterBody: dzen.body,
      pingOne: "Возвращаюсь по помещению в Дзен-кварталах. Это удобный вариант для частного покупателя и небольшого формата услуг в Новой Москве.",
      monthlyPlan: plan(110, 45, 85),
      weeklyPlan: plan(28, 12, 22),
      dailyPlan: plan(6, 2, 5),
    },
    {
      objectName: "Испанские кварталы, коммерческий лот",
      subject: ispanskie.subject,
      letterBody: ispanskie.body,
      pingOne: "Возвращаюсь по помещению в Испанских кварталах. Его стоит смотреть и тем, кто сам открывает точку, и тем, кто покупает под аренду.",
      monthlyPlan: plan(75, 35, 58),
      weeklyPlan: plan(19, 9, 15),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Большая Полянка, 42 стр. 2",
      subject: polyanka.subject,
      letterBody: polyanka.body,
      pingOne: "Возвращаюсь по Большой Полянке, 42 стр. 2. Это объект для клиники, представительства компании или покупки под собственное размещение в центре Москвы.",
      monthlyPlan: plan(42, 22, 32),
      weeklyPlan: plan(11, 6, 8),
      dailyPlan: plan(2, 1, 1),
    },
    {
      objectName: "Раменское, СП Рыболовское, 22,3 га",
      subject: "Раменское: 22,3 га под жилой квартал и КРТ",
      letterBody: `Добрый день.

Вижу, что вы работаете с жилыми проектами и земельными площадками в Московской области.

Есть площадка в Раменском направлении: 22,3 га, 4 смежных участка в СП Рыболовское. Цена 150 млн рублей. По материалам продавца объект подходит под комплексное развитие территории: жилой квартал, среднеэтажная застройка, детский сад, набережная, дворы без машин.

По концепции рассчитано 119 426 м² жилой продаваемой площади, максимальная высотность до 4-5 этажей, 3 981 житель, ДОО на 259 мест, школа на 537 мест и 1 424 машино-места.

Сильная сторона объекта - уже подготовлены градостроительный и инвестиционный анализы. Покупателю остается проверить путь по ГЗК / КРТ, инженерные условия и очередность реализации.

Если вам интересны такие площадки, могу отправить короткий бриф, схему участка и исходный градостроительный анализ.`,
      pingOne: "Возвращаюсь по площадке в Раменском: 22,3 га под жилой квартал и КРТ. Если вы рассматриваете земельные проекты в Московской области, могу отправить бриф и градостроительный анализ.",
      monthlyPlan: plan(80, 35, 65),
      weeklyPlan: plan(20, 9, 16),
      dailyPlan: plan(4, 2, 3),
    },
  ];

  return seeds.map((seed) => {
    const override = weekOverrides.get(canonicalObjectTitle(seed.objectName));
    if (!override) return seed;

    return {
      ...seed,
      monthlyPlan: plan(
        Math.max(seed.monthlyPlan.firstTouchTarget, override.weeklyFirstTouchTarget),
        seed.monthlyPlan.followUpTarget,
        Math.max(seed.monthlyPlan.uniqueCompaniesTarget, override.weeklyFirstTouchTarget),
      ),
      weeklyPlan: plan(override.weeklyFirstTouchTarget, 0, override.weeklyFirstTouchTarget),
      dailyPlan: plan(override.dailyFirstTouchTarget, 0, override.dailyFirstTouchTarget),
    };
  });
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
    monthly_plan: seed.monthlyPlan,
    weekly_plan: seed.weeklyPlan,
    daily_plan: seed.dailyPlan,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("broker_company_playbooks")
    .upsert(payload, { onConflict: "company_key" })
    .select("company_key,company_name,status")
    .maybeSingle();
  if (error && !isMissingPlaybookPlanColumnError(error)) throw error;
  if (!error) return data ?? payload;

  const legacyPayload = {
    company_key: objectKey(seed.objectName),
    company_name: canonicalObjectTitle(seed.objectName),
    status: "running",
    subject: seed.subject,
    letter_body: embedPlansInLetterBody(seed),
    ping_one: seed.pingOne ?? null,
    ping_two: seed.pingTwo ?? null,
    ping_three: seed.pingThree ?? null,
    updated_at: new Date().toISOString(),
  };

  const fallback = await db
    .from("broker_company_playbooks")
    .upsert(legacyPayload, { onConflict: "company_key" })
    .select("company_key,company_name,status")
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  return fallback.data ?? legacyPayload;
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
        monthly_plan: item.monthlyPlan,
        weekly_plan: item.weeklyPlan,
        daily_plan: item.dailyPlan,
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
