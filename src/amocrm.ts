import type { FastifyInstance } from "fastify";

export type AmoCrmConfig = {
  baseUrl: string;
  accessToken: string;
  pipelineId: number;
  statusId: number;
  responsibleUserId: number | null;
};

export type AmoAccountInfo = {
  id: number | null;
  name: string;
  subdomain: string;
};

export type AmoDuplicateResult = {
  exists: boolean;
  entityType: "lead" | "contact" | null;
  externalId: string | null;
};

export type AmoLeadInput = {
  leadName: string;
  companyName: string;
  contactName: string | null;
  email: string;
  objectName: string;
  note: string | null;
};

export type AmoLeadResult = {
  id: string;
};

export interface AmoCrmClient {
  getAccount(config: AmoCrmConfig): Promise<AmoAccountInfo>;
  findDuplicate(config: AmoCrmConfig, input: AmoLeadInput): Promise<AmoDuplicateResult>;
  createLead(config: AmoCrmConfig, input: AmoLeadInput): Promise<AmoLeadResult>;
}

type FetchLike = typeof fetch;

export function normalizeAmoCrmConfig(value: Record<string, unknown>) {
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const accessToken = String(value.accessToken || "").trim();
  const pipelineId = normalizePositiveInteger(value.pipelineId);
  const statusId = normalizePositiveInteger(value.statusId);
  const responsibleUserId = normalizePositiveInteger(value.responsibleUserId);

  if (!baseUrl) {
    throw new Error("Укажите base URL amoCRM");
  }
  if (!accessToken) {
    throw new Error("Укажите access token amoCRM");
  }
  if (!pipelineId) {
    throw new Error("Укажите pipeline ID amoCRM");
  }
  if (!statusId) {
    throw new Error("Укажите status ID amoCRM");
  }

  return {
    baseUrl,
    accessToken,
    pipelineId,
    statusId,
    responsibleUserId,
  } satisfies AmoCrmConfig;
}

export function getAmoCrmClient(server: FastifyInstance) {
  return server.amoCrm || defaultAmoCrmClient;
}

export const defaultAmoCrmClient = createAmoCrmClient();

export function createAmoCrmClient(fetchImpl: FetchLike = fetch): AmoCrmClient {
  return {
    async getAccount(config) {
      const payload = await amoRequest<{ id?: number; name?: string; subdomain?: string }>(
        fetchImpl,
        config,
        "/api/v4/account",
      );
      return {
        id: Number.isFinite(payload?.id) ? Number(payload.id) : null,
        name: String(payload?.name || ""),
        subdomain: String(payload?.subdomain || ""),
      };
    },

    async findDuplicate(config, input) {
      const candidates = uniqueStrings([input.email, input.companyName, input.leadName]);
      for (const query of candidates) {
        const lead = await amoSearchEntity(fetchImpl, config, "/api/v4/leads", query);
        if (lead) {
          return { exists: true, entityType: "lead", externalId: String(lead.id || "") || null };
        }
      }
      for (const query of uniqueStrings([input.email, input.companyName])) {
        const contact = await amoSearchEntity(fetchImpl, config, "/api/v4/contacts", query);
        if (contact) {
          return { exists: true, entityType: "contact", externalId: String(contact.id || "") || null };
        }
      }
      return { exists: false, entityType: null, externalId: null };
    },

    async createLead(config, input) {
      const payload = [{
        name: input.leadName,
        pipeline_id: config.pipelineId,
        status_id: config.statusId,
        ...(config.responsibleUserId ? { responsible_user_id: config.responsibleUserId } : {}),
        _embedded: {
          contacts: [{
            name: input.contactName || input.companyName,
            custom_fields_values: [{
              field_code: "EMAIL",
              values: [{ value: input.email, enum_code: "WORK" }],
            }],
          }],
          companies: [{ name: input.companyName }],
          tags: [{ name: "Sector8Estate" }, { name: "qualified_reply" }],
        },
      }];

      const response = await amoRequest<{ _embedded?: { leads?: Array<{ id?: number | string }> } }>(
        fetchImpl,
        config,
        "/api/v4/leads/complex",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      const createdLeadId = response?._embedded?.leads?.[0]?.id;
      if (!createdLeadId) {
        throw new Error("amoCRM не вернул ID созданного лида");
      }

      if (input.note) {
        await amoRequest(
          fetchImpl,
          config,
          `/api/v4/leads/${encodeURIComponent(String(createdLeadId))}/notes`,
          {
            method: "POST",
            body: JSON.stringify([{
              note_type: "common",
              params: {
                text: input.note,
              },
            }]),
          },
        );
      }

      return { id: String(createdLeadId) };
    },
  };
}

async function amoSearchEntity(fetchImpl: FetchLike, config: AmoCrmConfig, path: string, query: string) {
  if (!query.trim()) return null;
  const search = new URLSearchParams({ query }).toString();
  const payload = await amoRequest<{ _embedded?: { [key: string]: Array<Record<string, unknown>> } }>(
    fetchImpl,
    config,
    `${path}?${search}`,
  );
  const firstCollection = payload?._embedded ? Object.values(payload._embedded)[0] : null;
  return Array.isArray(firstCollection) ? firstCollection[0] || null : null;
}

async function amoRequest<T>(
  fetchImpl: FetchLike,
  config: AmoCrmConfig,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetchImpl(config.baseUrl + path, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `amoCRM ответил кодом ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function normalizeBaseUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

declare module "fastify" {
  interface FastifyInstance {
    amoCrm?: AmoCrmClient;
  }
}
