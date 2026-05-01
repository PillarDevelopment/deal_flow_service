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
const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const batchArg = process.argv.find((arg) => arg.startsWith("--batch="));
const workerRoot = workerRootArg
  ? path.resolve(process.cwd(), workerRootArg.replace("--deal-worker-root=", ""))
  : path.resolve(process.cwd(), "..", "deal_worker");
const csvPath = fileArg
  ? path.resolve(process.cwd(), fileArg.replace("--file=", ""))
  : path.join(workerRoot, "bases", "companies_may.csv");
const importBatch = normalizeString(batchArg?.replace("--batch=", "")) || new Date().toISOString().slice(0, 10);
const sourceFile = path.relative(workerRoot, csvPath);
const chunkSize = 500;

type CompanyDirectoryCsvRow = {
  "Название компании": string;
  "Эл. почта (email) компании": string;
  "Заголовок сайта (title)": string;
  "Тип компании": string;
  "Город": string;
  "Район города": string;
  "Регион": string;
  "Федеральный округ": string;
  "Рубрика": string;
  "Подрубрика": string;
  "Тип подрубрики *": string;
  "Координаты(x, y)": string;
  "Часы работы компании по местному времени": string;
  "Часовой пояс": string;
  "Статус": string;
  "Рейтинг компании в Интернете": string;
  "Примерное число отзывов в Интернете": string;
};

type CompanyDirectoryInsertRow = {
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
  source_file: string;
  import_batch: string;
  raw: Record<string, unknown>;
};

function requireEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeString(value: unknown, maxLength = 1000) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\uFEFF/g, "").trim().slice(0, maxLength);
}

function normalizeNullableString(value: unknown, maxLength = 1000) {
  const text = normalizeString(value, maxLength);
  return text || null;
}

function domainFromEmail(email: string) {
  return email.split("@")[1]?.toLowerCase() || null;
}

function headerKey(value: string) {
  return normalizeString(value).normalize("NFKC");
}

function readCsv<T>(filePath: string, delimiter = ";"): T[] {
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
    } else if (char === delimiter) {
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

  const [headerRow, ...bodyRows] = rows;
  const header = headerRow.map((value) => headerKey(value));
  return bodyRows
    .filter((item) => item.length === header.length)
    .map((item) =>
      Object.fromEntries(header.map((key, index) => [key, item[index] || ""])) as T,
    );
}

function extractEmails(value: string) {
  return Array.from(new Set(
    normalizeString(value, 1000)
      .split(/[,\\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.includes("@")),
  ));
}

function mapRow(row: CompanyDirectoryCsvRow): CompanyDirectoryInsertRow[] {
  const companyName = normalizeString(row["Название компании"], 240);
  const emails = extractEmails(row["Эл. почта (email) компании"]);
  if (!companyName || emails.length === 0) return [];

  return emails.map((email) => ({
    company_name: companyName,
    email,
    site_title: normalizeNullableString(row["Заголовок сайта (title)"], 240),
    company_type: normalizeNullableString(row["Тип компании"], 240),
    city: normalizeNullableString(row["Город"], 160),
    city_district: normalizeNullableString(row["Район города"], 160),
    region: normalizeNullableString(row["Регион"], 160),
    federal_district: normalizeNullableString(row["Федеральный округ"], 160),
    rubric: normalizeNullableString(row["Рубрика"], 240),
    subrubric: normalizeNullableString(row["Подрубрика"], 240),
    subrubric_type: normalizeNullableString(row["Тип подрубрики *"], 120),
    coordinates: normalizeNullableString(row["Координаты(x, y)"], 120),
    working_hours: normalizeNullableString(row["Часы работы компании по местному времени"], 4000),
    timezone: normalizeNullableString(row["Часовой пояс"], 120),
    business_status: normalizeNullableString(row["Статус"], 120),
    internet_rating: normalizeNullableString(row["Рейтинг компании в Интернете"], 120),
    review_count_estimate: normalizeNullableString(row["Примерное число отзывов в Интернете"], 120),
    domain: domainFromEmail(email),
    source: "companies_may_csv",
    source_file: sourceFile,
    import_batch: importBatch,
    raw: row,
  }));
}

async function upsertChunk(db: SupabaseClient, rows: CompanyDirectoryInsertRow[]) {
  const { error } = await db
    .from("broker_company_directory")
    .upsert(rows, { onConflict: "email,company_name" });
  if (error) throw error;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const rawRows = readCsv<CompanyDirectoryCsvRow>(csvPath, ";");
  const deduped = new Map<string, CompanyDirectoryInsertRow>();
  let skipped = 0;
  let explodedEmails = 0;

  for (const row of rawRows) {
    const mappedRows = mapRow(row);
    if (mappedRows.length === 0) {
      skipped += 1;
      continue;
    }
    explodedEmails += mappedRows.length;
    for (const mapped of mappedRows) {
      deduped.set(`${mapped.email}::${mapped.company_name.toLowerCase()}`, mapped);
    }
  }

  const rows = Array.from(deduped.values());
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    file: csvPath,
    sourceFile,
    importBatch,
    scanned: rawRows.length,
    explodedEmails,
    valid: rows.length,
    skipped,
  }, null, 2));

  if (!apply) return;

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let imported = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await upsertChunk(db, chunk);
    imported += chunk.length;
    console.log(`Imported ${imported}/${rows.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
