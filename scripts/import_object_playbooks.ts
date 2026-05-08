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
  "Торговые помещения в Пушкино": "Торговые помещения в Пушкино",
  "Ступино 12,97 га": "Ступино 12,97 га",
  "Можайск, 71,89 га": "Можайск, 71,89 га",
  "Офисное здание на Суворовской площади": "Офисное здание на Суворовской площади",
  "Мичуринский проспект": "Мичуринский проспект",
  "Коммерческое помещение на ул. 1905 года": "Коммерческое помещение на ул. 1905 года",
  "Бизнес-квартал Прокшино": "Бизнес-квартал Прокшино",
  "Офисный центр на ул. Эдварда Грига": "Офисный центр на ул. Эдварда Грига",
  "Испанские кварталы, коммерческий лот": "Испанские кварталы, коммерческий лот",
  "Деснаречье, торговое помещение": "Деснаречье, торговое помещение",
  "Дзен-кварталы, торговое помещение": "Дзен-кварталы, торговое помещение",
  "Новый Арбат, 5": "Новый Арбат, 5",
  "Дмитрия Ульянова, 24": "Дмитрия Ульянова, 24",
  "Большая Полянка, 42 стр. 2": "Большая Полянка, 42 стр. 2",
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
      subject: "Дмитрия Ульянова, 24: малый street retail у метро Академическая",
      letterBody: "Ликвидный малый street retail напротив выхода из метро Академическая. Подходит под кофе to-go, табак, связь, оптику и быстрые сервисные форматы. Рабочий объект для быстрого брокерского дистрибута.",
      pingOne: "Возвращаюсь по объекту на Дмитрия Ульянова, 24. Если у вас есть активный запрос на малый ликвидный street retail у метро, это один из самых быстрых лотов в текущем пуле.",
      monthlyPlan: plan(90, 40, 70),
      weeklyPlan: plan(22, 10, 17),
      dailyPlan: plan(5, 2, 4),
    },
    {
      objectName: "Новый Арбат, 5",
      subject: "Новый Арбат, 5: крупный флагманский лот в центре Москвы",
      letterBody: "Крупный флагманский лот на Новом Арбате под restaurant group, flagship retail, showroom или private clinic. Длинный цикл сделки и адресная продажа через senior brokers и named brands.",
      pingOne: "Повторно направляю Новый Арбат, 5. Объект нужно вести адресно по флагманским брендам и крупным пользователям, а не через массовую рассылку.",
      monthlyPlan: plan(35, 18, 28),
      weeklyPlan: plan(9, 4, 7),
      dailyPlan: plan(2, 1, 1),
    },
    {
      objectName: "Бизнес-квартал Прокшино",
      subject: "Бизнес-квартал Прокшино: офисы класса A и ритейл у метро",
      letterBody: "Современный офисный продукт класса A в Прокшино. Основной buyer path: owner-user, HQ-relocation, private office, office investor и корпоративные брокеры.",
      pingOne: "Возвращаюсь по Бизнес-кварталу Прокшино. Если у вас есть клиент на покупку офиса для собственного размещения или ликвидный офисный актив у метро, это объект для приоритетного просмотра.",
      monthlyPlan: plan(70, 30, 52),
      weeklyPlan: plan(18, 8, 14),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Офисный центр на ул. Эдварда Грига",
      subject: "Офисный центр на ул. Эдварда Грига: здание целиком под owner-user",
      letterBody: "Отдельно стоящий офисный центр под клинику, школу, HQ или private campus use. Точечный продукт под конкретного пользователя, а не массовый рынок.",
      pingOne: "Повторно возвращаюсь по офисному центру на ул. Эдварда Грига. Если у вас есть реальный user на здание целиком, это формат для адресной проработки.",
      monthlyPlan: plan(55, 25, 42),
      weeklyPlan: plan(14, 6, 11),
      dailyPlan: plan(3, 1, 2),
    },
    {
      objectName: "Деснаречье, торговое помещение",
      subject: "Деснаречье: ранний вход в жилой ритейл Новой Москвы",
      letterBody: "Стартовый торговый лот в растущем жилом районе. Подходит под частного инвестора, франчайзи и local retail operators. Ключевая логика: ранний вход и рост потребительского кластера.",
      pingOne: "Возвращаюсь по лоту в Деснаречье. Для инвестора, который смотрит ранний вход в жилой ритейл с умеренным бюджетом, это один из самых рабочих форматов в текущем пуле.",
      monthlyPlan: plan(100, 40, 78),
      weeklyPlan: plan(25, 10, 20),
      dailyPlan: plan(5, 2, 4),
    },
    {
      objectName: "Дзен-кварталы, торговое помещение",
      subject: "Дзен-кварталы: торговое помещение для частного инвестора и сетевого сервиса",
      letterBody: "Торговый лот в жилом массиве с невысоким входным билетом. Основные сценарии: частный инвестор под арендатора, семейный капитал, франчайзи, кофейня, аптека или сервис у дома.",
      pingOne: "Повторно направляю лот в Дзен-кварталах. Это удобный объект для частного инвестора и небольшого сервисного формата в Новой Москве.",
      monthlyPlan: plan(110, 45, 85),
      weeklyPlan: plan(28, 12, 22),
      dailyPlan: plan(6, 2, 5),
    },
    {
      objectName: "Испанские кварталы, коммерческий лот",
      subject: "Испанские кварталы: готовый коммерческий лот в плотном жилом массиве",
      letterBody: "Готовая коммерция в сформированном жилом районе с понятной логикой под сетевой сервис, продуктовый формат и частного инвестора в ГАБ/ритейл.",
      pingOne: "Повторно направляю коммерческий лот в Испанских кварталах. Объект стоит показывать и инвесторам, и операторам с готовой tenant-логикой.",
      monthlyPlan: plan(75, 35, 58),
      weeklyPlan: plan(19, 9, 15),
      dailyPlan: plan(4, 2, 3),
    },
    {
      objectName: "Большая Полянка, 42 стр. 2",
      subject: "Большая Полянка, 42 стр. 2: ОСЗ 2 094 м² под клинику, HQ или статусный городской актив",
      letterBody: "Отдельно стоящее здание 2 094 м² на Большой Полянке, в контуре Садового кольца. Основной buyer path: частная клиника, owner-user, boutique HQ, family office и private investor под репозиционирование центрального актива.",
      pingOne: "Возвращаюсь по Большой Полянке, 42 стр. 2. Это адресный объект для медицинского пользователя, owner-user и инвестора, которому нужен центр, отдельное здание и сценарий адаптации под свой формат.",
      monthlyPlan: plan(42, 22, 32),
      weeklyPlan: plan(11, 6, 8),
      dailyPlan: plan(2, 1, 1),
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
