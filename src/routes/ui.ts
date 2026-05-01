import type { FastifyInstance } from "fastify";
import { getOptionalEnv } from "../env.js";

type BrokerLoginBody = {
  email?: string;
  password?: string;
};

const STAGES = [
  ["new_lead", "Новый лид"],
  ["contacted", "Контакт установлен"],
  ["qualified", "Потребность уточнена"],
  ["objects_sent", "Объекты отправлены"],
  ["discussion", "Идет обсуждение"],
  ["meeting", "Показ / встреча"],
  ["negotiation", "Переговоры"],
  ["won", "Сделка закрыта"],
  ["lost", "Потеряно"],
];

export async function brokerUiRoutes(server: FastifyInstance) {
  server.get("/broker", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderBrokerPage());
  });

  server.post<{ Body: BrokerLoginBody }>("/broker/login", async (request, reply) => {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    if (!email || !password) {
      return reply.status(400).send({ error: "Введите email и пароль" });
    }

    const { data, error } = await server.auth.auth.signInWithPassword({ email, password });
    const token = data.session?.access_token;
    const user = data.user;
    if (error || !token || !user) {
      return reply.status(401).send({ error: "Не авторизован" });
    }

    const { data: roleRow, error: roleError } = await server.db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();
    if (roleError) {
      return reply.status(500).send({ error: roleError.message });
    }
    if (roleRow?.role !== "super_admin") {
      return reply.status(403).send({ error: "Доступ только для super_admin" });
    }

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email || email,
        role: roleRow.role,
      },
    };
  });
}

function renderBrokerPage() {
  const dealWorkerBaseUrl = JSON.stringify(getOptionalEnv("DEAL_WORKER_BASE_URL", "http://localhost:3000"));

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sector8Estate — Broker Deal Flow</title>
    <style>
      :root {
        --bg: #f2f0ea;
        --paper: #fffaf0;
        --card: #ffffff;
        --ink: #1e2723;
        --muted: #69746d;
        --line: #dfd6c7;
        --accent: #176b4d;
        --accent-dark: #0b3f2d;
        --gold: #dba84a;
        --danger: #a7503b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Serif", "Georgia", serif;
        color: var(--ink);
        background:
          radial-gradient(900px 520px at 8% -10%, rgba(219,168,74,0.22), transparent 64%),
          linear-gradient(135deg, #f8f4ea 0%, var(--bg) 62%, #e9efe8 100%);
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid rgba(223,214,199,0.9);
        background: rgba(255,250,240,0.88);
        backdrop-filter: blur(16px);
      }
      .topbar-inner,
      .container {
        width: min(1440px, calc(100% - 32px));
        margin: 0 auto;
      }
      .topbar-inner {
        min-height: 76px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .brand {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .brand strong {
        font-size: 24px;
        letter-spacing: -0.04em;
      }
      .brand span,
      .small {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .btn {
        border: 1px solid var(--line);
        background: var(--card);
        border-radius: 999px;
        padding: 10px 14px;
        cursor: pointer;
        color: var(--ink);
        font-weight: 700;
      }
      .btn.primary {
        border-color: var(--accent);
        background: var(--accent);
        color: #fff;
      }
      .btn.danger {
        border-color: rgba(167,80,59,0.3);
        color: var(--danger);
      }
      .container {
        padding: 24px 0 40px;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) 360px;
        gap: 18px;
        align-items: stretch;
        margin-bottom: 18px;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,250,240,0.92));
        box-shadow: 0 18px 60px rgba(58, 48, 30, 0.08);
        padding: 20px;
      }
      h1 {
        margin: 0;
        font-size: clamp(34px, 5vw, 68px);
        letter-spacing: -0.07em;
        line-height: 0.95;
      }
      h2, h3 {
        margin: 0 0 12px;
        letter-spacing: -0.035em;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 22px;
      }
      .stat {
        border: 1px solid rgba(223,214,199,0.9);
        border-radius: 18px;
        padding: 14px;
        background: rgba(255,255,255,0.72);
      }
      .stat span {
        display: block;
        color: var(--muted);
        font-size: 12px;
      }
      .stat strong {
        display: block;
        margin-top: 6px;
        font-size: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }
      .campaign-grid {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr) 360px;
        gap: 18px;
        align-items: start;
        margin-bottom: 18px;
      }
      .outreach-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 12px;
      }
      .recipient-list {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }
      .recipient-row {
        border-top: 1px solid rgba(223,214,199,0.72);
        padding-top: 7px;
        font-size: 13px;
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      input, textarea, select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 11px 12px;
        background: rgba(255,255,255,0.94);
        color: var(--ink);
        font: inherit;
      }
      textarea {
        min-height: 88px;
        resize: vertical;
      }
      .board {
        display: grid;
        grid-template-columns: repeat(9, minmax(220px, 1fr));
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 12px;
      }
      .column {
        min-height: 420px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: rgba(255,255,255,0.56);
        padding: 12px;
      }
      .column h3 {
        font-size: 15px;
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .deal-card,
      .client-card,
      .property-card,
      .campaign-card,
      .activity-row {
        border: 1px solid rgba(223,214,199,0.92);
        border-radius: 18px;
        background: var(--card);
        padding: 12px;
        cursor: pointer;
      }
      .deal-card {
        margin-bottom: 10px;
      }
      .deal-card.active,
      .client-card.active,
      .campaign-card.active,
      .property-card.active {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(23,107,77,0.12);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 4px 8px;
        font-size: 12px;
        color: var(--muted);
        background: #fff;
      }
      .detail {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 18px;
        margin-top: 18px;
      }
      .hidden { display: none !important; }
      .muted { color: var(--muted); }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .row > * { flex: 1; }
      .message {
        min-height: 20px;
        color: var(--muted);
        font-size: 13px;
      }
      .access-form {
        display: grid;
        gap: 10px;
      }
      .access-divider {
        height: 1px;
        background: var(--line);
        margin: 4px 0;
      }
      @media (max-width: 980px) {
        .hero,
        .grid,
        .campaign-grid,
        .detail {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <strong>Sector8Estate Broker</strong>
          <span>Deal Flow CRM: клиенты, сделки, объекты и следующие шаги</span>
        </div>
        <div class="actions">
          <button class="btn" id="refreshBtn">Обновить</button>
          <button class="btn primary" id="newClientFocusBtn">Новый клиент</button>
          <span class="badge" id="authBadge">Проверяем доступ</span>
        </div>
      </div>
    </header>

    <main class="container">
      <section class="hero">
        <div class="panel">
          <h1>Broker Deal Flow</h1>
          <p class="small">Первый контур CRM для брокера. Доступ только для super_admin. Объекты подтягиваются из каталога properties, CRM хранит только сделки и статусы работы.</p>
          <div class="stats">
            <div class="stat"><span>Клиенты</span><strong id="clientsCount">0</strong></div>
            <div class="stat"><span>Сделки</span><strong id="dealsCount">0</strong></div>
            <div class="stat"><span>Кампании</span><strong id="campaignsCount">0</strong></div>
            <div class="stat"><span>Единая база</span><strong id="companyDirectoryCount">0</strong></div>
          </div>
        </div>
        <div class="panel">
          <h2>Доступ</h2>
          <p class="small">Войдите под super_admin. Токен сохранится для этого адреса и портa.</p>
          <div class="access-form">
            <input id="loginEmailInput" type="email" autocomplete="username" placeholder="Email" />
            <input id="loginPasswordInput" type="password" autocomplete="current-password" placeholder="Пароль" />
            <button class="btn primary" id="brokerLoginBtn">Войти</button>
          </div>
          <div class="access-divider"></div>
          <p class="small">Можно также вставить готовый platform_token.</p>
          <div class="row">
            <input id="platformTokenInput" placeholder="platform_token" />
            <button class="btn" id="savePlatformTokenBtn">Token</button>
          </div>
          <button class="btn danger" id="clearPlatformTokenBtn">Сбросить token</button>
          <div class="message" id="globalMsg"></div>
        </div>
      </section>

      <section class="panel stack" style="margin-bottom:18px;">
        <div class="row">
          <div>
            <h2>Единая база компаний</h2>
            <div class="small">Справочник компаний для отбора новых target lists без засорения CRM-лидов.</div>
          </div>
          <input id="companyDirectorySearchInput" placeholder="Найти компанию, email, рубрику, регион" />
        </div>
        <div class="small" id="companyDirectorySummaryMeta"></div>
        <div id="companyDirectoryList" class="outreach-grid"></div>
      </section>

      <section class="panel stack" style="margin-bottom:18px;">
        <div class="row">
          <div>
            <h2>Outreach по компаниям</h2>
            <div class="small">Сколько первых писем и follow-up ушло по каждой компании, на какие email и по каким объектам.</div>
          </div>
          <input id="outreachSearchInput" placeholder="Найти компанию или email" />
        </div>
        <div class="small" id="outreachSummaryMeta"></div>
        <div id="outreachCompaniesList" class="outreach-grid"></div>
      </section>

      <section class="campaign-grid">
        <aside class="panel stack">
          <h2>Object Workbench</h2>
          <input id="campaignPropertySearchInput" placeholder="Найти объект для кампании" />
          <button class="btn" id="searchCampaignPropertiesBtn">Искать объект</button>
          <div id="campaignPropertyResults" class="stack"></div>
          <input id="campaignNameInput" placeholder="Название кампании" />
          <textarea id="campaignObjectiveInput" placeholder="Цель кампании"></textarea>
          <textarea id="campaignBriefInput" placeholder="Краткий бриф / sales angle"></textarea>
          <button class="btn primary" id="createCampaignBtn">Создать кампанию</button>
        </aside>

        <section class="panel stack">
          <div class="row">
            <div>
              <h2>Campaigns</h2>
              <div class="small">Кампании привязаны к объектам из deal_worker и живут в deal_flow_service.</div>
            </div>
            <button class="btn" id="refreshCampaignsBtn">Обновить</button>
          </div>
          <div id="campaignsList" class="stack"></div>
        </section>

        <aside class="panel stack" id="campaignDetailPanel">
          <h2 id="campaignDetailTitle">Hypothesis Studio</h2>
          <div id="campaignDetailBody" class="small">Выберите кампанию.</div>
          <input id="hypothesisSegmentNameInput" placeholder="Сегмент" />
          <input id="hypothesisSegmentTypeInput" placeholder="Тип сегмента" />
          <textarea id="hypothesisValuePropInput" placeholder="Value prop"></textarea>
          <textarea id="hypothesisReasoningInput" placeholder="Почему эта гипотеза релевантна"></textarea>
          <div class="row">
            <input id="hypothesisChannelInput" placeholder="Канал" />
            <input id="hypothesisPriorityInput" placeholder="Приоритет" />
          </div>
          <button class="btn primary" id="addHypothesisBtn">Добавить гипотезу</button>
        </aside>
      </section>

      <section class="grid">
        <aside class="panel stack">
          <h2>Клиенты</h2>
          <input id="clientSearchInput" placeholder="Поиск клиента" />
          <div id="clientsList" class="stack"></div>
          <h3>Новый клиент</h3>
          <input id="clientNameInput" placeholder="ФИО / название клиента" />
          <input id="clientCompanyInput" placeholder="Компания" />
          <input id="clientPhoneInput" placeholder="Телефон" />
          <input id="clientEmailInput" placeholder="Email" />
          <input id="clientTelegramInput" placeholder="Telegram" />
          <div class="row">
            <input id="clientBudgetFromInput" placeholder="Бюджет от" />
            <input id="clientBudgetToInput" placeholder="Бюджет до" />
          </div>
          <textarea id="clientNotesInput" placeholder="Комментарий"></textarea>
          <button class="btn primary" id="createClientBtn">Создать клиента</button>
        </aside>

        <section class="stack">
          <div class="panel">
            <div class="row">
              <div>
                <h2>Воронка сделок</h2>
                <div class="small">Перетаскивание будет следующим шагом; сейчас стадия меняется в карточке сделки.</div>
              </div>
              <button class="btn primary" id="createDealBtn">Создать сделку для выбранного клиента</button>
            </div>
          </div>
          <div class="board" id="board"></div>
        </section>
      </section>

      <section class="detail hidden" id="detailSection">
        <div class="panel stack">
          <h2 id="dealTitle">Сделка</h2>
          <div class="row">
            <select id="dealStageSelect"></select>
            <input id="dealNextStepInput" placeholder="Следующий шаг" />
          </div>
          <div class="row">
            <input id="dealNextDueInput" type="datetime-local" />
            <button class="btn primary" id="saveDealBtn">Сохранить сделку</button>
          </div>
          <textarea id="activityCommentInput" placeholder="Добавить заметку / активность"></textarea>
          <button class="btn" id="addActivityBtn">Добавить в timeline</button>
          <h3>Timeline</h3>
          <div id="activitiesList" class="stack"></div>
        </div>
        <aside class="panel stack">
          <h2>Объекты сделки</h2>
          <input id="propertySearchInput" placeholder="Найти объект в каталоге" />
          <button class="btn" id="searchPropertiesBtn">Искать</button>
          <div id="propertySearchResults" class="stack"></div>
          <h3>Привязанные объекты</h3>
          <div id="linkedPropertiesList" class="stack"></div>
        </aside>
      </section>
    </main>

    <script>
      const DEAL_WORKER_BASE_URL = ${dealWorkerBaseUrl};
      const STAGES = ${JSON.stringify(STAGES)};
      const state = {
        token: localStorage.getItem("platform_token") || "",
        me: null,
        clients: [],
        deals: [],
        campaigns: [],
        outreachCompanies: [],
        companyDirectory: [],
        clientsTotal: 0,
        dealsTotal: 0,
        campaignsTotal: 0,
        outreachCompaniesTotal: 0,
        companyDirectoryTotal: 0,
        selectedClientId: "",
        selectedDealId: "",
        selectedCampaignId: "",
        selectedDeal: null,
        selectedCampaign: null,
        propertyResults: [],
        campaignPropertyResults: [],
        selectedCampaignPropertyId: "",
      };

      const $ = (id) => document.getElementById(id);

      const tokenFromUrl = new URLSearchParams(window.location.search).get("platform_token");
      if (tokenFromUrl) {
        localStorage.setItem("platform_token", tokenFromUrl);
        state.token = tokenFromUrl;
        history.replaceState({}, "", window.location.pathname);
      }

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => (
          { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
        ));
      }

      function formatMoney(value) {
        if (!value) return "цена по запросу";
        return new Intl.NumberFormat("ru-RU").format(Number(value)) + " ₽";
      }

      function stageLabel(stage) {
        return (STAGES.find((item) => item[0] === stage) || [stage, stage])[1];
      }

      async function apiFetch(url, options = {}) {
        const headers = Object.assign({}, options.headers || {});
        if (state.token) headers.Authorization = "Bearer " + state.token;
        const response = await fetch(url, Object.assign({}, options, { headers }));
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || ("Код " + response.status));
        return payload;
      }

      async function loadMe() {
        state.me = await apiFetch("/broker/me");
        $("authBadge").textContent = state.me?.email || "super_admin";
      }

      async function loadClients() {
        const q = $("clientSearchInput").value.trim();
        const payload = await apiFetch("/broker/clients?" + new URLSearchParams({ q, limit: "100" }).toString());
        state.clients = payload.items || [];
        state.clientsTotal = Number(payload.total ?? state.clients.length);
      }

      async function loadDeals() {
        const payload = await apiFetch("/broker/deals?limit=200");
        state.deals = payload.items || [];
        state.dealsTotal = Number(payload.total ?? state.deals.length);
      }

      async function loadCampaigns() {
        const payload = await apiFetch("/broker/campaigns?limit=100");
        state.campaigns = payload.items || [];
        state.campaignsTotal = Number(payload.total ?? state.campaigns.length);
      }

      async function loadOutreachCompanies() {
        const q = $("outreachSearchInput").value.trim();
        const payload = await apiFetch("/broker/outreach/companies?" + new URLSearchParams({ q, limit: "250" }).toString());
        state.outreachCompanies = payload.items || [];
        state.outreachCompaniesTotal = Number(payload.total ?? state.outreachCompanies.length);
      }

      async function loadCompanyDirectory() {
        const q = $("companyDirectorySearchInput").value.trim();
        const payload = await apiFetch("/broker/company-directory?" + new URLSearchParams({ q, limit: "100" }).toString());
        state.companyDirectory = payload.items || [];
        state.companyDirectoryTotal = Number(payload.total ?? state.companyDirectory.length);
      }

      async function loadSelectedDeal() {
        if (!state.selectedDealId) {
          state.selectedDeal = null;
          return;
        }
        state.selectedDeal = await apiFetch("/broker/deals/" + encodeURIComponent(state.selectedDealId));
      }

      async function loadSelectedCampaign() {
        if (!state.selectedCampaignId) {
          state.selectedCampaign = null;
          return;
        }
        state.selectedCampaign = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaignId));
      }

      async function refreshAll() {
        $("globalMsg").textContent = "Загружаем Deal Flow...";
        try {
          await loadMe();
          await Promise.all([loadClients(), loadDeals(), loadCampaigns(), loadOutreachCompanies(), loadCompanyDirectory()]);
          if (state.selectedDealId) await loadSelectedDeal();
          if (state.selectedCampaignId) await loadSelectedCampaign();
          renderAll();
          $("globalMsg").textContent = "Готово.";
        } catch (err) {
          if (/Не авторизован|Доступ только/.test(err.message || "")) {
            $("authBadge").textContent = "Требуется вход";
            state.me = null;
            state.clients = [];
            state.deals = [];
            state.campaigns = [];
            state.outreachCompanies = [];
            state.companyDirectory = [];
            state.clientsTotal = 0;
            state.dealsTotal = 0;
            state.campaignsTotal = 0;
            state.outreachCompaniesTotal = 0;
            state.companyDirectoryTotal = 0;
            state.selectedDeal = null;
            state.selectedCampaign = null;
          }
          $("globalMsg").textContent = "Ошибка: " + err.message;
          renderAll();
        }
      }

      async function loginBroker() {
        const email = $("loginEmailInput").value.trim();
        const password = $("loginPasswordInput").value;
        if (!email || !password) {
          $("globalMsg").textContent = "Введите email и пароль.";
          return;
        }
        $("globalMsg").textContent = "Проверяем доступ...";
        const payload = await fetch("/broker/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }).then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || ("Код " + response.status));
          return data;
        });
        state.token = payload.access_token || "";
        localStorage.setItem("platform_token", state.token);
        $("loginPasswordInput").value = "";
        await refreshAll();
      }

      function renderClients() {
        $("clientsCount").textContent = String(state.clientsTotal || state.clients.length);
        $("clientsList").innerHTML = state.clients.length
          ? state.clients.map((client) =>
            '<article class="client-card' + (client.id === state.selectedClientId ? ' active' : '') + '" data-client-id="' + escapeHtml(client.id) + '">' +
              '<strong>' + escapeHtml(client.full_name || "Без имени") + '</strong>' +
              '<div class="small">' + escapeHtml(client.company || "Компания не указана") + '</div>' +
              '<div class="small">' + escapeHtml([client.phone, client.email, client.telegram].filter(Boolean).join(" · ") || "Контакты не указаны") + '</div>' +
            '</article>'
          ).join("")
          : '<div class="small">Клиентов пока нет.</div>';
      }

      function renderBoard() {
        $("dealsCount").textContent = String(state.dealsTotal || state.deals.length);
        $("board").innerHTML = STAGES.map(([stage, label]) => {
          const deals = state.deals.filter((deal) => deal.stage === stage);
          return '<section class="column">' +
            '<h3><span>' + escapeHtml(label) + '</span><span class="badge">' + deals.length + '</span></h3>' +
            deals.map((deal) =>
              '<article class="deal-card' + (deal.id === state.selectedDealId ? ' active' : '') + '" data-deal-id="' + escapeHtml(deal.id) + '">' +
                '<strong>' + escapeHtml(deal.title || "Без названия") + '</strong>' +
                '<div class="small">' + escapeHtml(deal.client?.full_name || "Клиент не указан") + '</div>' +
                '<div class="small">' + escapeHtml(deal.next_step || "Следующий шаг не задан") + '</div>' +
                '<div class="badge">' + escapeHtml(deal.priority || "normal") + '</div>' +
              '</article>'
            ).join("") +
          '</section>';
        }).join("");
      }

      function renderCampaigns() {
        $("campaignsCount").textContent = String(state.campaignsTotal || state.campaigns.length);
        $("campaignsList").innerHTML = state.campaigns.length
          ? state.campaigns.map((campaign) =>
            '<article class="campaign-card' + (campaign.id === state.selectedCampaignId ? ' active' : '') + '" data-campaign-id="' + escapeHtml(campaign.id) + '">' +
              '<strong>' + escapeHtml(campaign.campaign_name || "Без названия") + '</strong>' +
              '<div class="small">' + escapeHtml(campaign.objective || "Цель не указана") + '</div>' +
              '<div class="row"><span class="badge">' + escapeHtml(campaign.status || "draft") + '</span><span class="badge">' + escapeHtml(campaign.start_date || "без даты") + '</span></div>' +
            '</article>'
          ).join("")
          : '<div class="small">Кампаний пока нет.</div>';
      }

      function renderCompanyDirectory() {
        $("companyDirectoryCount").textContent = String(state.companyDirectoryTotal || state.companyDirectory.length);
        $("companyDirectorySummaryMeta").textContent = state.companyDirectoryTotal
          ? "Компаний в общей базе: " + state.companyDirectoryTotal + ". Показано: " + state.companyDirectory.length + "."
          : "Единая база компаний пока пустая.";
        $("companyDirectoryList").innerHTML = state.companyDirectory.length
          ? state.companyDirectory.map((company) =>
            '<article class="campaign-card">' +
              '<strong>' + escapeHtml(company.company_name || "Без названия") + '</strong>' +
              '<div class="small" style="margin-top:8px;">' + escapeHtml(company.email || "") + '</div>' +
              '<div class="row" style="margin-top:8px;">' +
                '<span class="badge">' + escapeHtml(company.region || "Без региона") + '</span>' +
                '<span class="badge">' + escapeHtml(company.rubric || "Без рубрики") + '</span>' +
              '</div>' +
              '<div class="small" style="margin-top:8px;">' + escapeHtml([company.city, company.subrubric].filter(Boolean).join(" · ") || "Детали не указаны") + '</div>' +
            '</article>'
          ).join("")
          : '<div class="small">Нет компаний по текущему фильтру.</div>';
      }

      function renderOutreachCompanies() {
        $("outreachSummaryMeta").textContent = state.outreachCompaniesTotal
          ? "Компаний в outreach: " + state.outreachCompaniesTotal + ". Показано: " + state.outreachCompanies.length + "."
          : "Outreach по компаниям пока пуст.";
        $("outreachCompaniesList").innerHTML = state.outreachCompanies.length
          ? state.outreachCompanies.map((company) => {
            const recipients = Array.isArray(company.recipients) ? company.recipients : [];
            const preview = recipients.slice(0, 8).map((recipient) =>
              '<div class="recipient-row">' +
                '<strong>' + escapeHtml(recipient.email || "") + '</strong>' +
                '<div class="small">' + escapeHtml(recipient.objectName || recipient.campaignName || "Объект не указан") + ' · ' + escapeHtml(recipient.status || "") + '</div>' +
              '</div>'
            ).join("");
            const hiddenCount = Math.max(0, recipients.length - 8);
            return '<article class="campaign-card">' +
              '<strong>' + escapeHtml(company.companyName || "Без компании") + '</strong>' +
              '<div class="row" style="margin-top:8px;">' +
                '<span class="badge">первые: ' + escapeHtml(company.firstTouchCount || 0) + '</span>' +
                '<span class="badge">follow-up: ' + escapeHtml(company.followUpCount || 0) + '</span>' +
                '<span class="badge">email: ' + escapeHtml(company.uniqueEmailCount || 0) + '</span>' +
              '</div>' +
              '<div class="small" style="margin-top:8px;">' + escapeHtml((company.objects || []).join(" · ") || "Объекты не указаны") + '</div>' +
              '<div class="recipient-list">' + preview + (hiddenCount ? '<div class="small">Еще ' + hiddenCount + ' получателей.</div>' : '') + '</div>' +
            '</article>';
          }).join("")
          : '<div class="small">Нет компаний по текущему фильтру.</div>';
      }

      function renderCampaignPropertyResults() {
        $("campaignPropertyResults").innerHTML = state.campaignPropertyResults.length
          ? state.campaignPropertyResults.map((property) =>
            '<div class="property-card' + (property.id === state.selectedCampaignPropertyId ? ' active' : '') + '" data-campaign-property-id="' + escapeHtml(property.id) + '">' +
              '<strong>' + escapeHtml(property.title || "Без названия") + '</strong>' +
              '<div class="small">' + escapeHtml(property.region || property.address || "Локация не указана") + '</div>' +
              '<div class="small">' + escapeHtml(formatMoney(property.price_rub)) + '</div>' +
            '</div>'
          ).join("")
          : '<div class="small">Найдите объект, чтобы создать кампанию.</div>';
      }

      function renderCampaignDetail() {
        const detail = state.selectedCampaign;
        $("campaignDetailTitle").textContent = detail?.campaign_name || "Hypothesis Studio";
        if (!detail) {
          $("campaignDetailBody").innerHTML = "Выберите кампанию.";
          return;
        }

        const property = detail.property || {};
        const hypotheses = Array.isArray(detail.hypotheses) ? detail.hypotheses : [];
        $("campaignDetailBody").innerHTML =
          '<div class="stack">' +
            '<div><strong>' + escapeHtml(property.title || "Объект не найден") + '</strong><div class="small">' + escapeHtml(property.address || property.region || "") + '</div></div>' +
            '<div class="row"><span class="badge">' + escapeHtml(detail.status || "draft") + '</span><span class="badge">' + escapeHtml(String(hypotheses.length)) + ' гипотез</span></div>' +
            (hypotheses.length
              ? hypotheses.map((item) =>
                '<div class="activity-row">' +
                  '<strong>' + escapeHtml(item.segment_name || "Сегмент") + '</strong>' +
                  '<div class="small">' + escapeHtml(item.segment_type || "") + ' · ' + escapeHtml(item.channel || "канал не указан") + '</div>' +
                  '<div>' + escapeHtml(item.value_prop || "") + '</div>' +
                  '<div class="row"><span class="badge">' + escapeHtml(item.status || "draft") + '</span><button class="btn" data-approve-hypothesis-id="' + escapeHtml(item.id) + '">Approve</button></div>' +
                '</div>'
              ).join("")
              : '<div class="small">Гипотез пока нет.</div>') +
          '</div>';
      }

      function renderDealDetail() {
        const detail = state.selectedDeal;
        $("detailSection").classList.toggle("hidden", !detail);
        if (!detail) return;

        $("dealTitle").textContent = detail.title || "Сделка";
        $("dealStageSelect").innerHTML = STAGES.map(([value, label]) =>
          '<option value="' + escapeHtml(value) + '"' + (value === detail.stage ? " selected" : "") + '>' + escapeHtml(label) + '</option>'
        ).join("");
        $("dealNextStepInput").value = detail.next_step || "";
        $("dealNextDueInput").value = detail.next_step_due_at ? String(detail.next_step_due_at).slice(0, 16) : "";

        const activities = Array.isArray(detail.activities) ? detail.activities : [];
        $("activitiesList").innerHTML = activities.length
          ? activities.map((item) =>
            '<div class="activity-row">' +
              '<strong>' + escapeHtml(item.activity_type || "note") + '</strong>' +
              '<div>' + escapeHtml(item.comment || "") + '</div>' +
              '<div class="small">' + escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString("ru-RU") : "") + '</div>' +
            '</div>'
          ).join("")
          : '<div class="small">Timeline пока пуст.</div>';

        const linked = Array.isArray(detail.deal_properties) ? detail.deal_properties : [];
        $("linkedPropertiesList").innerHTML = linked.length
          ? linked.map((item) => {
            const property = item.property || {};
            const href = DEAL_WORKER_BASE_URL.replace(/\\/$/, "") + "/app/object/" + encodeURIComponent(property.id || item.property_id);
            return '<div class="property-card">' +
              '<strong>' + escapeHtml(property.title || item.property_id) + '</strong>' +
              '<div class="small">' + escapeHtml(property.region || property.address || "Локация не указана") + '</div>' +
              '<div class="small">' + escapeHtml(formatMoney(property.price_rub)) + '</div>' +
              '<div class="row"><span class="badge">' + escapeHtml(item.status || "shortlist") + '</span><a class="btn" href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer">Открыть объект</a></div>' +
            '</div>';
          }).join("")
          : '<div class="small">Объекты еще не привязаны.</div>';
      }

      function renderPropertyResults() {
        $("propertySearchResults").innerHTML = state.propertyResults.length
          ? state.propertyResults.map((property) =>
            '<div class="property-card">' +
              '<strong>' + escapeHtml(property.title || "Без названия") + '</strong>' +
              '<div class="small">' + escapeHtml(property.region || property.address || "Локация не указана") + '</div>' +
              '<div class="small">' + escapeHtml(formatMoney(property.price_rub)) + '</div>' +
              '<button class="btn primary" data-add-property-id="' + escapeHtml(property.id) + '">Добавить в сделку</button>' +
            '</div>'
          ).join("")
          : '<div class="small">Введите запрос и нажмите “Искать”.</div>';
      }

      function renderAll() {
        $("platformTokenInput").value = state.token ? "token сохранен" : "";
        $("loginEmailInput").classList.toggle("hidden", Boolean(state.token && state.me));
        $("loginPasswordInput").classList.toggle("hidden", Boolean(state.token && state.me));
        $("brokerLoginBtn").classList.toggle("hidden", Boolean(state.token && state.me));
        renderCompanyDirectory();
        renderClients();
        renderCampaigns();
        renderOutreachCompanies();
        renderCampaignPropertyResults();
        renderCampaignDetail();
        renderBoard();
        renderDealDetail();
        renderPropertyResults();
      }

      async function createClient() {
        const fullName = $("clientNameInput").value.trim();
        if (!fullName) {
          $("globalMsg").textContent = "Введите имя клиента.";
          return;
        }
        const payload = {
          fullName,
          company: $("clientCompanyInput").value.trim(),
          phone: $("clientPhoneInput").value.trim(),
          email: $("clientEmailInput").value.trim(),
          telegram: $("clientTelegramInput").value.trim(),
          budgetFrom: $("clientBudgetFromInput").value.trim(),
          budgetTo: $("clientBudgetToInput").value.trim(),
          notes: $("clientNotesInput").value.trim(),
        };
        const client = await apiFetch("/broker/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        state.selectedClientId = client.id;
        ["clientNameInput", "clientCompanyInput", "clientPhoneInput", "clientEmailInput", "clientTelegramInput", "clientBudgetFromInput", "clientBudgetToInput", "clientNotesInput"].forEach((id) => {
          $(id).value = "";
        });
        await refreshAll();
      }

      async function createDeal() {
        if (!state.selectedClientId) {
          $("globalMsg").textContent = "Сначала выберите клиента.";
          return;
        }
        const client = state.clients.find((item) => item.id === state.selectedClientId);
        const deal = await apiFetch("/broker/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: state.selectedClientId,
            title: "Сделка: " + (client?.full_name || "клиент"),
          }),
        });
        state.selectedDealId = deal.id;
        await refreshAll();
      }

      async function saveDeal() {
        if (!state.selectedDealId) return;
        await apiFetch("/broker/deals/" + encodeURIComponent(state.selectedDealId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: $("dealStageSelect").value,
            nextStep: $("dealNextStepInput").value.trim(),
            nextStepDueAt: $("dealNextDueInput").value,
          }),
        });
        await refreshAll();
      }

      async function addActivity() {
        if (!state.selectedDealId) return;
        const comment = $("activityCommentInput").value.trim();
        if (!comment) return;
        await apiFetch("/broker/deals/" + encodeURIComponent(state.selectedDealId) + "/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityType: "note", comment }),
        });
        $("activityCommentInput").value = "";
        await refreshAll();
      }

      async function searchProperties() {
        const q = $("propertySearchInput").value.trim();
        const payload = await apiFetch("/broker/catalog/properties?" + new URLSearchParams({ q, limit: "20" }).toString());
        state.propertyResults = payload.items || [];
        renderPropertyResults();
      }

      async function searchCampaignProperties() {
        const q = $("campaignPropertySearchInput").value.trim();
        const payload = await apiFetch("/broker/catalog/properties?" + new URLSearchParams({ q, limit: "10" }).toString());
        state.campaignPropertyResults = payload.items || [];
        renderCampaignPropertyResults();
      }

      async function createCampaign() {
        if (!state.selectedCampaignPropertyId) {
          $("globalMsg").textContent = "Сначала выберите объект для кампании.";
          return;
        }
        const name = $("campaignNameInput").value.trim();
        if (!name) {
          $("globalMsg").textContent = "Введите название кампании.";
          return;
        }
        const campaign = await apiFetch("/broker/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: state.selectedCampaignPropertyId,
            campaignName: name,
            objective: $("campaignObjectiveInput").value.trim(),
            briefText: $("campaignBriefInput").value.trim(),
          }),
        });
        state.selectedCampaignId = campaign.id;
        state.selectedCampaign = campaign;
        ["campaignNameInput", "campaignObjectiveInput", "campaignBriefInput"].forEach((id) => { $(id).value = ""; });
        await refreshAll();
      }

      async function addHypothesis() {
        if (!state.selectedCampaignId) {
          $("globalMsg").textContent = "Сначала выберите кампанию.";
          return;
        }
        const segmentName = $("hypothesisSegmentNameInput").value.trim();
        const segmentType = $("hypothesisSegmentTypeInput").value.trim();
        if (!segmentName || !segmentType) {
          $("globalMsg").textContent = "Введите сегмент и тип сегмента.";
          return;
        }
        await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaignId) + "/hypotheses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segmentName,
            segmentType,
            valueProp: $("hypothesisValuePropInput").value.trim(),
            reasoning: $("hypothesisReasoningInput").value.trim(),
            channel: $("hypothesisChannelInput").value.trim() || "email",
            priority: $("hypothesisPriorityInput").value.trim(),
          }),
        });
        ["hypothesisSegmentNameInput", "hypothesisSegmentTypeInput", "hypothesisValuePropInput", "hypothesisReasoningInput", "hypothesisChannelInput", "hypothesisPriorityInput"].forEach((id) => { $(id).value = ""; });
        await loadSelectedCampaign();
        await loadCampaigns();
        renderAll();
      }

      async function approveHypothesis(hypothesisId) {
        await apiFetch("/broker/campaign-hypotheses/" + encodeURIComponent(hypothesisId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        });
        await loadSelectedCampaign();
        renderAll();
      }

      async function addProperty(propertyId) {
        if (!state.selectedDealId) {
          $("globalMsg").textContent = "Сначала выберите сделку.";
          return;
        }
        await apiFetch("/broker/deals/" + encodeURIComponent(state.selectedDealId) + "/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, status: "shortlist" }),
        });
        await refreshAll();
      }

      function bindEvents() {
        $("refreshBtn").addEventListener("click", refreshAll);
        $("savePlatformTokenBtn").addEventListener("click", () => {
          const token = $("platformTokenInput").value.trim();
          if (!token || token === "token сохранен") return;
          localStorage.setItem("platform_token", token);
          state.token = token;
          refreshAll();
        });
        $("clearPlatformTokenBtn").addEventListener("click", () => {
          localStorage.removeItem("platform_token");
          state.token = "";
          state.me = null;
          state.clients = [];
          state.deals = [];
          state.campaigns = [];
          state.outreachCompanies = [];
          state.companyDirectory = [];
          state.clientsTotal = 0;
          state.dealsTotal = 0;
          state.campaignsTotal = 0;
          state.outreachCompaniesTotal = 0;
          state.companyDirectoryTotal = 0;
          renderAll();
          $("globalMsg").textContent = "Token сброшен.";
        });
        $("brokerLoginBtn").addEventListener("click", () => loginBroker().catch((err) => $("globalMsg").textContent = "Ошибка авторизации: " + err.message));
        $("loginPasswordInput").addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            loginBroker().catch((err) => $("globalMsg").textContent = "Ошибка авторизации: " + err.message);
          }
        });
        $("newClientFocusBtn").addEventListener("click", () => $("clientNameInput").focus());
        $("createClientBtn").addEventListener("click", () => createClient().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("createDealBtn").addEventListener("click", () => createDeal().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("saveDealBtn").addEventListener("click", () => saveDeal().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("addActivityBtn").addEventListener("click", () => addActivity().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("searchPropertiesBtn").addEventListener("click", () => searchProperties().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("searchCampaignPropertiesBtn").addEventListener("click", () => searchCampaignProperties().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("createCampaignBtn").addEventListener("click", () => createCampaign().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("refreshCampaignsBtn").addEventListener("click", () => Promise.all([loadCampaigns(), state.selectedCampaignId ? loadSelectedCampaign() : Promise.resolve()]).then(renderAll).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("addHypothesisBtn").addEventListener("click", () => addHypothesis().catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message));
        $("clientSearchInput").addEventListener("input", () => loadClients().then(renderClients).catch(() => null));
        $("companyDirectorySearchInput").addEventListener("input", () => loadCompanyDirectory().then(renderCompanyDirectory).catch(() => null));
        $("outreachSearchInput").addEventListener("input", () => loadOutreachCompanies().then(renderOutreachCompanies).catch(() => null));
        document.body.addEventListener("click", (event) => {
          const campaignPropertyCard = event.target.closest("[data-campaign-property-id]");
          if (campaignPropertyCard) {
            state.selectedCampaignPropertyId = campaignPropertyCard.getAttribute("data-campaign-property-id") || "";
            renderCampaignPropertyResults();
            return;
          }
          const campaignCard = event.target.closest("[data-campaign-id]");
          if (campaignCard) {
            state.selectedCampaignId = campaignCard.getAttribute("data-campaign-id") || "";
            loadSelectedCampaign().then(renderAll).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
            return;
          }
          const approveHypothesisButton = event.target.closest("[data-approve-hypothesis-id]");
          if (approveHypothesisButton) {
            approveHypothesis(approveHypothesisButton.getAttribute("data-approve-hypothesis-id")).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
            return;
          }
          const clientCard = event.target.closest("[data-client-id]");
          if (clientCard) {
            state.selectedClientId = clientCard.getAttribute("data-client-id") || "";
            renderAll();
            return;
          }
          const dealCard = event.target.closest("[data-deal-id]");
          if (dealCard) {
            state.selectedDealId = dealCard.getAttribute("data-deal-id") || "";
            loadSelectedDeal().then(renderAll).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
            return;
          }
          const propertyButton = event.target.closest("[data-add-property-id]");
          if (propertyButton) {
            addProperty(propertyButton.getAttribute("data-add-property-id")).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
          }
        });
      }

      bindEvents();
      renderAll();
      refreshAll();
    </script>
  </body>
</html>`;
}
