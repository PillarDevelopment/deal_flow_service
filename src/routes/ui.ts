import type { FastifyInstance } from "fastify";
import { getOptionalEnv } from "../env.js";

type BrokerLoginBody = {
  email?: string;
  password?: string;
};

export async function brokerUiRoutes(server: FastifyInstance) {
  server.get("/broker", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderBrokerPage());
  });

  server.get("/broker/object/:propertyId", async (_request, reply) => {
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
        min-width: 0;
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
        grid-template-columns: repeat(4, minmax(0, 1fr));
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
        gap: 18px;
        margin-top: 18px;
        align-items: start;
      }
      .recipient-company-summary {
        display: grid;
        grid-template-columns: minmax(0, 1fr) repeat(3, minmax(72px, auto)) 40px;
        gap: 10px;
        align-items: center;
      }
      .recipient-company-name {
        min-width: 0;
      }
      .recipient-company-name strong {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .recipient-company-metric {
        text-align: right;
      }
      .recipient-toggle {
        padding: 8px 0;
        min-width: 40px;
      }
      .hidden { display: none !important; }
      .muted { color: var(--muted); }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .row > * {
        flex: 1 1 0;
        min-width: 0;
      }
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
      @media (max-width: 1180px) {
        .stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .detail {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .recipient-company-summary {
          grid-template-columns: minmax(0, 1fr) repeat(2, minmax(64px, auto));
        }
        .recipient-company-metric {
          text-align: left;
        }
        .recipient-toggle {
          grid-column: 3;
          justify-self: end;
        }
      }
      @media (max-width: 980px) {
        .hero,
        .grid,
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
          <span>Deal Flow: объекты, получатели, письма и follow-up</span>
        </div>
        <div class="actions">
          <button class="btn" id="refreshBtn">Обновить</button>
          <span class="badge" id="authBadge">Проверяем доступ</span>
        </div>
      </div>
    </header>

    <main class="container">
      <section class="hero" id="dashboardHero">
        <div class="panel">
          <h1>Broker Deal Flow</h1>
          <div class="stats">
            <div class="stat"><span>Компании-объекты</span><strong id="campaignsCount">0</strong></div>
            <div class="stat"><span>Отправлено писем</span><strong id="sentEmailsCount">0</strong></div>
            <div class="stat"><span>Фирм в базе</span><strong id="companyDirectoryCount">0</strong></div>
            <div class="stat"><span>Фирм с отправкой</span><strong id="contactedCompaniesCount">0</strong></div>
          </div>
        </div>
        <div class="panel">
          <h2>Доступ</h2>
          <div class="access-form">
            <input id="loginEmailInput" type="email" autocomplete="username" placeholder="Email" />
            <input id="loginPasswordInput" type="password" autocomplete="current-password" placeholder="Пароль" />
            <button class="btn primary" id="brokerLoginBtn">Войти</button>
          </div>
          <div class="access-divider"></div>
          <div class="row">
            <input id="platformTokenInput" placeholder="platform_token" />
            <button class="btn" id="savePlatformTokenBtn">Token</button>
          </div>
          <button class="btn danger" id="clearPlatformTokenBtn">Сбросить token</button>
          <div class="message" id="globalMsg"></div>
        </div>
      </section>

      <section class="panel stack" id="activeCompaniesSection" style="margin-bottom:18px;">
        <div class="row">
          <div>
            <h2>Активные объекты</h2>
          </div>
          <input id="outreachSearchInput" placeholder="Найти объект" />
        </div>
        <div class="small" id="companyDirectorySummaryMeta"></div>
        <div id="companyDirectoryList" class="outreach-grid"></div>
      </section>

      <section class="detail hidden" id="activeCompanySection" style="margin-top:0; margin-bottom:18px;">
        <section class="panel stack">
          <div class="row">
            <div>
              <button class="btn" id="backToCompaniesBtn">Назад к объектам</button>
              <h2 id="activeCompanyTitle">Объект</h2>
              <div class="small" id="activeCompanyMeta">Выберите объект из списка выше.</div>
            </div>
            <div class="row">
              <button class="btn primary" id="saveCompanyDraftBtn">Сохранить</button>
              <button class="btn" id="startCompanyBtn">Запуск</button>
              <button class="btn" id="pauseCompanyBtn">Пауза</button>
              <button class="btn danger" id="stopCompanyBtn">Стоп</button>
            </div>
          </div>
          <div class="row">
            <span class="badge" id="activeCompanyCompaniesBadge">компании: 0</span>
            <span class="badge" id="activeCompanyFirstTouchBadge">первые письма: 0</span>
            <span class="badge" id="activeCompanyFollowUpBadge">follow-up: 0</span>
            <span class="badge" id="activeCompanyRecipientsBadge">получатели: 0</span>
            <span class="badge" id="activeCompanyStatusBadge">draft</span>
          </div>
          <div class="stack">
            <h2>Письмо</h2>
            <input id="companyLetterSubjectInput" placeholder="Тема письма" />
            <textarea id="companyLetterBodyInput" placeholder="Основное письмо"></textarea>
          </div>
          <div class="stack">
            <h2>Пинги</h2>
            <textarea id="companyPingOneInput" placeholder="Пинг 1"></textarea>
            <textarea id="companyPingTwoInput" placeholder="Пинг 2"></textarea>
            <textarea id="companyPingThreeInput" placeholder="Пинг 3"></textarea>
          </div>
        </section>

        <section class="panel stack">
          <div>
            <h2>Компании и получатели</h2>
            <div class="small">Какие компании входят в объект, кому уже отправлено и сколько follow-up.</div>
          </div>
          <div id="activeCompanyRecipientsList" class="stack"></div>
          <div class="row">
            <button class="btn" id="activeCompanyPrevPageBtn">Назад</button>
            <span class="badge" id="activeCompanyPageBadge">1 / 1</span>
            <button class="btn" id="activeCompanyNextPageBtn">Дальше</button>
          </div>
        </section>
      </section>

    </main>

    <script>
      const DEAL_WORKER_BASE_URL = ${dealWorkerBaseUrl};
      const OBJECT_ROUTE_PREFIX = "/broker/object/";
      const state = {
        token: localStorage.getItem("platform_token") || "",
        me: null,
        campaigns: [],
        campaignsTotal: 0,
        companyDirectoryTotal: 0,
        contactedCompaniesTotal: 0,
        sentEmailsTotal: 0,
        selectedCampaignId: "",
        selectedCampaign: null,
        activeCompanyRecipientsPage: 1,
        expandedRecipientCompanies: {},
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

      function propertyIdFromPath() {
        if (!window.location.pathname.startsWith(OBJECT_ROUTE_PREFIX)) return "";
        return decodeURIComponent(window.location.pathname.slice(OBJECT_ROUTE_PREFIX.length)).trim();
      }

      function objectUrl(propertyId) {
        return propertyId ? OBJECT_ROUTE_PREFIX + encodeURIComponent(propertyId) : "/broker";
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

      async function loadCampaigns() {
        const q = $("outreachSearchInput").value.trim();
        const payload = await apiFetch("/broker/campaigns?" + new URLSearchParams({ q, limit: "100" }).toString());
        state.campaigns = payload.items || [];
        state.campaignsTotal = Number(payload.total ?? state.campaigns.length);
        if (state.selectedCampaignId && !state.campaigns.some((item) => item.id === state.selectedCampaignId)) {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
        }
      }

      async function loadDashboardSummary() {
        const [allCampaigns, directorySummary, outreachSummary] = await Promise.all([
          apiFetch("/broker/campaigns?limit=100"),
          apiFetch("/broker/company-directory?limit=1"),
          apiFetch("/broker/outreach/companies?limit=1"),
        ]);
        const allCampaignItems = Array.isArray(allCampaigns.items) ? allCampaigns.items : [];
        state.sentEmailsTotal = allCampaignItems.reduce((sum, campaign) => {
          const stats = campaign?.stats || {};
          return sum + Number(stats.firstTouchCount || 0) + Number(stats.followUpCount || 0);
        }, 0);
        state.companyDirectoryTotal = Number(directorySummary.total || 0);
        state.contactedCompaniesTotal = Number(outreachSummary.total || 0);
      }

      async function loadSelectedCampaign() {
        if (!state.selectedCampaignId) {
          state.selectedCampaign = null;
          return;
        }
        state.selectedCampaign = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaignId));
      }

      async function syncSelectionFromPath() {
        const propertyId = propertyIdFromPath();
        if (!propertyId) {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
          state.activeCompanyRecipientsPage = 1;
          return;
        }
        const existing = state.campaigns.find((item) =>
          item.property_id === propertyId ||
          item.property?.id === propertyId ||
          (Array.isArray(item.property_ids) && item.property_ids.includes(propertyId)),
        );
        if (existing) {
          state.selectedCampaignId = existing.id;
          state.activeCompanyRecipientsPage = 1;
          return;
        }
        const payload = await apiFetch("/broker/campaigns?" + new URLSearchParams({ propertyId, limit: "1" }).toString());
        const first = Array.isArray(payload.items) ? payload.items[0] : null;
        if (!first) {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
          state.activeCompanyRecipientsPage = 1;
          return;
        }
        if (!state.campaigns.some((item) => item.id === first.id)) {
          state.campaigns = [first, ...state.campaigns];
        }
        state.selectedCampaignId = first.id;
        state.activeCompanyRecipientsPage = 1;
      }

      async function refreshAll() {
        $("globalMsg").textContent = "Загружаем Deal Flow...";
        try {
          await loadMe();
          await Promise.all([loadCampaigns(), loadDashboardSummary()]);
          await syncSelectionFromPath();
          if (state.selectedCampaignId) await loadSelectedCampaign();
          renderAll();
          $("globalMsg").textContent = "Готово.";
        } catch (err) {
          if (/Не авторизован|Доступ только/.test(err.message || "")) {
            $("authBadge").textContent = "Требуется вход";
            state.me = null;
            state.campaigns = [];
            state.campaignsTotal = 0;
            state.companyDirectoryTotal = 0;
            state.contactedCompaniesTotal = 0;
            state.sentEmailsTotal = 0;
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

      function renderCompanyDirectory() {
        $("campaignsCount").textContent = String(state.campaignsTotal || state.campaigns.length);
        $("sentEmailsCount").textContent = String(state.sentEmailsTotal || 0);
        $("companyDirectoryCount").textContent = String(state.companyDirectoryTotal || 0);
        $("contactedCompaniesCount").textContent = String(state.contactedCompaniesTotal || 0);
        $("companyDirectorySummaryMeta").textContent = state.campaignsTotal
          ? "Объектов в работе: " + state.campaignsTotal + "."
          : "Активных объектов пока нет.";
        $("companyDirectoryList").innerHTML = state.campaigns.length
          ? state.campaigns.map((campaign) => {
            const isActive = campaign.id === state.selectedCampaignId;
            const stats = campaign.stats || {};
            return (
              '<article class="campaign-card' + (isActive ? ' active' : '') + '" data-active-campaign-id="' + escapeHtml(campaign.id || "") + '">' +
                '<strong>' + escapeHtml(campaign.campaign_name || "Без названия") + '</strong>' +
                '<div class="row" style="margin-top:8px;">' +
                  '<span class="badge">первые: ' + escapeHtml(stats.firstTouchCount || 0) + '</span>' +
                  '<span class="badge">follow-up: ' + escapeHtml(stats.followUpCount || 0) + '</span>' +
                  '<span class="badge">получатели: ' + escapeHtml(stats.recipientCount || 0) + '</span>' +
                '</div>' +
                '<div class="small" style="margin-top:8px;">' + escapeHtml(campaign.objective || "Цель не указана") + '</div>' +
                '<div class="small" style="margin-top:8px;">' + escapeHtml(campaign.property?.title || campaign.property_id || "Объект не указан") + '</div>' +
              '</article>'
            );
          }).join("")
          : '<div class="small">Нет объектов по текущему фильтру.</div>';
      }

      function readCompanyDrafts() {
        try {
          return JSON.parse(localStorage.getItem("broker_company_playbooks_v1") || "{}");
        } catch {
          return {};
        }
      }

      function writeCompanyDrafts(value) {
        localStorage.setItem("broker_company_playbooks_v1", JSON.stringify(value));
      }

      function objectStatusLabel(status) {
        return ({
          draft: "черновик",
          running: "в работе",
          paused: "на паузе",
          stopped: "остановлен",
        })[status] || status || "черновик";
      }

      function recipientCompanyKey(company) {
        return String(company?.companyName || "").trim().toLowerCase();
      }

      function isRecipientCompanyExpanded(company) {
        return Boolean(state.expandedRecipientCompanies[recipientCompanyKey(company)]);
      }

      function toggleRecipientCompany(company) {
        const key = recipientCompanyKey(company);
        if (!key) return;
        state.expandedRecipientCompanies[key] = !state.expandedRecipientCompanies[key];
      }

      function companyDraft(key, company) {
        const all = readCompanyDrafts();
        const fallbackObject = company?.property?.title || "объект";
        return all[key] || {
          status: "draft",
          subject: "Предложение по объекту " + fallbackObject,
          letterBody: "Добрый день. Направляю предложение по объекту " + fallbackObject + ". Готов отправить материалы и обсудить формат.",
          pingOne: "Возвращаюсь к письму по объекту. Подскажите, актуально ли посмотреть материалы?",
          pingTwo: "Коротко напоминаю о предложении. Если интересно, отправлю расширенный пакет сегодня.",
          pingThree: "Последний follow-up по этому объекту. Если тема неактуальна, зафиксирую и сниму компанию с пинга.",
        };
      }

      function renderActiveCompanyDetail() {
        const campaign = state.selectedCampaign;
        const pageSize = 10;
        $("dashboardHero").classList.toggle("hidden", Boolean(campaign));
        $("activeCompaniesSection").classList.toggle("hidden", Boolean(campaign));
        $("activeCompanySection").classList.toggle("hidden", !campaign);
        if (!campaign) {
          $("activeCompanyTitle").textContent = "Объект";
          $("activeCompanyMeta").textContent = "Выберите объект из списка выше.";
          $("activeCompanyCompaniesBadge").textContent = "компании: 0";
          $("activeCompanyFirstTouchBadge").textContent = "первые письма: 0";
          $("activeCompanyFollowUpBadge").textContent = "follow-up: 0";
          $("activeCompanyRecipientsBadge").textContent = "получатели: 0";
          $("activeCompanyStatusBadge").textContent = "черновик";
          $("companyLetterSubjectInput").value = "";
          $("companyLetterBodyInput").value = "";
          $("companyPingOneInput").value = "";
          $("companyPingTwoInput").value = "";
          $("companyPingThreeInput").value = "";
          $("activeCompanyRecipientsList").innerHTML = '<div class="small">Получатели появятся после выбора компании.</div>';
          $("activeCompanyPageBadge").textContent = "1 / 1";
          $("activeCompanyPrevPageBtn").disabled = true;
          $("activeCompanyNextPageBtn").disabled = true;
          return;
        }

        const draft = companyDraft(campaign.id, campaign);
        const stats = campaign.stats || {};
        const targetCompanies = Array.isArray(campaign.targetCompanies) ? campaign.targetCompanies : [];
        const totalPages = Math.max(1, Math.ceil(targetCompanies.length / pageSize));
        const page = Math.min(Math.max(1, state.activeCompanyRecipientsPage), totalPages);
        state.activeCompanyRecipientsPage = page;
        const pageItems = targetCompanies.slice((page - 1) * pageSize, page * pageSize);
        $("activeCompanyTitle").textContent = campaign.campaign_name || "Объект";
        $("activeCompanyMeta").textContent = (campaign.property?.title || "Объект") + " · " + (campaign.objective || "Цель не указана");
        $("activeCompanyCompaniesBadge").textContent = "компании: " + targetCompanies.length;
        $("activeCompanyFirstTouchBadge").textContent = "первые письма: " + (stats.firstTouchCount || 0);
        $("activeCompanyFollowUpBadge").textContent = "follow-up: " + (stats.followUpCount || 0);
        $("activeCompanyRecipientsBadge").textContent = "получатели: " + (stats.recipientCount || 0);
        $("activeCompanyStatusBadge").textContent = objectStatusLabel(draft.status || "draft");
        $("companyLetterSubjectInput").value = draft.subject || "";
        $("companyLetterBodyInput").value = draft.letterBody || "";
        $("companyPingOneInput").value = draft.pingOne || "";
        $("companyPingTwoInput").value = draft.pingTwo || "";
        $("companyPingThreeInput").value = draft.pingThree || "";
        $("activeCompanyRecipientsList").innerHTML = targetCompanies.length
          ? pageItems.map((company) => {
            const expanded = isRecipientCompanyExpanded(company);
            return '<div class="activity-row">' +
              '<div class="recipient-company-summary">' +
                '<div class="recipient-company-name">' +
                  '<strong>' + escapeHtml(company.companyName || "") + '</strong>' +
                '</div>' +
                '<div class="small recipient-company-metric"><span class="muted">Первые</span><br><strong>' + escapeHtml(company.firstTouchCount || 0) + '</strong></div>' +
                '<div class="small recipient-company-metric"><span class="muted">Follow-up</span><br><strong>' + escapeHtml(company.followUpCount || 0) + '</strong></div>' +
                '<div class="small recipient-company-metric"><span class="muted">Email</span><br><strong>' + escapeHtml(company.uniqueEmailCount || 0) + '</strong></div>' +
                '<button class="btn recipient-toggle" data-toggle-recipient-company="' + escapeHtml(recipientCompanyKey(company)) + '">' + (expanded ? '▾' : '▸') + '</button>' +
              '</div>' +
              (expanded
                ? '<div class="recipient-list">' + (company.recipients || []).map((recipient) =>
                  '<div class="recipient-row"><strong>' + escapeHtml(recipient.email || "") + '</strong><div class="small">' + escapeHtml((recipient.contactName || "Контакт не указан") + " · " + (recipient.status || "")) + '</div></div>'
                ).join("") + '</div>'
                : '') +
            '</div>';
          }).join("")
          : '<div class="small">По объекту пока нет компаний-получателей.</div>';
        $("activeCompanyPageBadge").textContent = page + " / " + totalPages;
        $("activeCompanyPrevPageBtn").disabled = page <= 1;
        $("activeCompanyNextPageBtn").disabled = page >= totalPages;
      }

      function renderAll() {
        $("platformTokenInput").value = state.token ? "token сохранен" : "";
        $("loginEmailInput").classList.toggle("hidden", Boolean(state.token && state.me));
        $("loginPasswordInput").classList.toggle("hidden", Boolean(state.token && state.me));
        $("brokerLoginBtn").classList.toggle("hidden", Boolean(state.token && state.me));
        renderCompanyDirectory();
        renderActiveCompanyDetail();
      }

      function saveActiveCompanyDraft(nextStatus) {
        const campaign = state.selectedCampaign;
        if (!campaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        const all = readCompanyDrafts();
        all[campaign.id] = {
          status: nextStatus || companyDraft(campaign.id, campaign).status || "draft",
          subject: $("companyLetterSubjectInput").value.trim(),
          letterBody: $("companyLetterBodyInput").value.trim(),
          pingOne: $("companyPingOneInput").value.trim(),
          pingTwo: $("companyPingTwoInput").value.trim(),
          pingThree: $("companyPingThreeInput").value.trim(),
        };
        writeCompanyDrafts(all);
        $("globalMsg").textContent = "Карточка объекта сохранена.";
        renderActiveCompanyDetail();
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
          state.campaigns = [];
          state.campaignsTotal = 0;
          state.companyDirectoryTotal = 0;
          state.contactedCompaniesTotal = 0;
          state.sentEmailsTotal = 0;
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
          renderAll();
          $("globalMsg").textContent = "Token сброшен.";
        });
        $("brokerLoginBtn").addEventListener("click", () => loginBroker().catch((err) => $("globalMsg").textContent = "Ошибка авторизации: " + err.message));
        $("loginPasswordInput").addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            loginBroker().catch((err) => $("globalMsg").textContent = "Ошибка авторизации: " + err.message);
          }
        });
        $("saveCompanyDraftBtn").addEventListener("click", () => saveActiveCompanyDraft());
        $("startCompanyBtn").addEventListener("click", () => saveActiveCompanyDraft("running"));
        $("pauseCompanyBtn").addEventListener("click", () => saveActiveCompanyDraft("paused"));
        $("stopCompanyBtn").addEventListener("click", () => saveActiveCompanyDraft("stopped"));
        $("backToCompaniesBtn").addEventListener("click", () => {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
          state.activeCompanyRecipientsPage = 1;
          state.expandedRecipientCompanies = {};
          history.pushState({}, "", "/broker");
          renderAll();
        });
        $("activeCompanyPrevPageBtn").addEventListener("click", () => {
          if (state.activeCompanyRecipientsPage <= 1) return;
          state.activeCompanyRecipientsPage -= 1;
          renderActiveCompanyDetail();
        });
        $("activeCompanyNextPageBtn").addEventListener("click", () => {
          state.activeCompanyRecipientsPage += 1;
          renderActiveCompanyDetail();
        });
        $("outreachSearchInput").addEventListener("input", () => Promise.all([loadCampaigns(), state.selectedCampaignId ? loadSelectedCampaign() : Promise.resolve()]).then(renderAll).catch(() => null));
        document.body.addEventListener("click", (event) => {
          const activeCampaignCard = event.target.closest("[data-active-campaign-id]");
          if (activeCampaignCard) {
            state.selectedCampaignId = activeCampaignCard.getAttribute("data-active-campaign-id") || "";
            state.activeCompanyRecipientsPage = 1;
            state.expandedRecipientCompanies = {};
            const campaign = state.campaigns.find((item) => item.id === state.selectedCampaignId);
            history.pushState({}, "", objectUrl(campaign?.property_id || campaign?.property?.id || ""));
            loadSelectedCampaign().then(renderAll).catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
            return;
          }
          const toggleRecipientCompanyButton = event.target.closest("[data-toggle-recipient-company]");
          if (toggleRecipientCompanyButton) {
            const key = toggleRecipientCompanyButton.getAttribute("data-toggle-recipient-company") || "";
            state.expandedRecipientCompanies[key] = !state.expandedRecipientCompanies[key];
            renderActiveCompanyDetail();
            return;
          }
        });
        window.addEventListener("popstate", () => {
          syncSelectionFromPath()
            .then(() => state.selectedCampaignId ? loadSelectedCampaign() : Promise.resolve())
            .then(renderAll)
            .catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
        });
      }

      bindEvents();
      renderAll();
      refreshAll();
    </script>
  </body>
</html>`;
}
