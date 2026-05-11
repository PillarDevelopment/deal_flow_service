import type { FastifyInstance } from "fastify";

export async function brokerUiRoutes(server: FastifyInstance) {
  server.get("/broker", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderBrokerPage());
  });

  server.get("/broker/object/:propertyId", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderBrokerPage());
  });
}

function renderBrokerPage() {
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
      .btn.warning {
        border-color: rgba(219,168,74,0.45);
        background: rgba(219,168,74,0.14);
        color: #8d650f;
      }
      .btn.success {
        border-color: rgba(23,107,77,0.3);
        background: rgba(23,107,77,0.12);
        color: var(--accent);
      }
      .btn.danger {
        border-color: rgba(167,80,59,0.3);
        color: var(--danger);
      }
      .btn:disabled {
        cursor: default;
        opacity: 0.48;
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
      .campaign-card.plan-ok {
        border-color: rgba(23,107,77,0.5);
        background:
          linear-gradient(135deg, rgba(23,107,77,0.16), rgba(23,107,77,0.08)),
          var(--card);
        box-shadow: inset 4px 0 0 rgba(23,107,77,0.78);
      }
      .campaign-card.plan-behind {
        border-color: rgba(206,120,149,0.52);
        background:
          linear-gradient(135deg, rgba(206,120,149,0.18), rgba(206,120,149,0.08)),
          var(--card);
        box-shadow: inset 4px 0 0 rgba(206,120,149,0.82);
      }
      .campaign-card.plan-empty {
        border-color: rgba(219,168,74,0.56);
        background:
          linear-gradient(135deg, rgba(219,168,74,0.2), rgba(219,168,74,0.08)),
          var(--card);
        box-shadow: inset 4px 0 0 rgba(219,168,74,0.82);
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
      .badge.status-active {
        border-color: rgba(23,107,77,0.3);
        background: rgba(23,107,77,0.12);
        color: var(--accent);
      }
      .badge.status-inactive {
        border-color: rgba(219,168,74,0.45);
        background: rgba(219,168,74,0.14);
        color: #8d650f;
      }
      .badge.status-stopped {
        border-color: rgba(167,80,59,0.3);
        background: rgba(167,80,59,0.12);
        color: var(--danger);
      }
      .badge.status-ahead {
        border-color: rgba(23,107,77,0.3);
        background: rgba(23,107,77,0.12);
        color: var(--accent);
      }
      .badge.status-behind {
        border-color: rgba(167,80,59,0.3);
        background: rgba(167,80,59,0.12);
        color: var(--danger);
      }
      .badge.status-on-track {
        border-color: rgba(219,168,74,0.45);
        background: rgba(219,168,74,0.14);
        color: #8d650f;
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
        grid-template-columns: minmax(0, 1fr) repeat(4, minmax(72px, auto)) 40px;
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
      .plan-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .plan-card {
        border: 1px solid rgba(223,214,199,0.92);
        border-radius: 18px;
        background: rgba(255,255,255,0.72);
        padding: 14px;
        display: grid;
        gap: 10px;
      }
      .plan-summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .plan-summary-card {
        border: 1px solid rgba(223,214,199,0.92);
        border-radius: 16px;
        background: rgba(255,255,255,0.66);
        padding: 12px;
        display: grid;
        gap: 8px;
      }
      .plan-summary-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .plan-summary-title {
        font-size: 13px;
        color: var(--muted);
      }
      .plan-summary-main {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      .plan-summary-main strong {
        font-size: 22px;
      }
      .plan-summary-sub {
        color: var(--muted);
        font-size: 12px;
      }
      .plan-card h3 {
        margin: 0;
        font-size: 16px;
      }
      .plan-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .plan-inputs {
        display: grid;
        gap: 8px;
      }
      .plan-field {
        display: grid;
        gap: 4px;
      }
      .plan-field span {
        color: var(--muted);
        font-size: 12px;
      }
      .plan-fact {
        display: grid;
        gap: 6px;
        border-top: 1px solid rgba(223,214,199,0.72);
        padding-top: 10px;
      }
      .plan-fact-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 13px;
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
        .plan-summary-grid,
        .plan-grid {
          grid-template-columns: 1fr;
        }
        .recipient-company-summary {
          grid-template-columns: minmax(0, 1fr) repeat(2, minmax(64px, auto)) 40px;
        }
        .recipient-company-metric {
          text-align: left;
        }
        .recipient-toggle {
          grid-column: 4;
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
          <span class="badge" id="authBadge">Локальный режим</span>
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
          <h2>Режим работы</h2>
          <div class="small">Локальный режим. Вход сейчас не требуется, все действия выполняются сразу в рабочем контуре.</div>
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
              <button class="btn" id="generateCopyBtn">Сгенерировать письмо</button>
              <button class="btn" id="toggleCompanyStatusBtn">Активно</button>
              <button class="btn danger" id="stopCompanyBtn">Стоп</button>
            </div>
          </div>
          <div class="row">
            <span class="badge" id="activeCompanyCompaniesBadge">компании: 0</span>
            <span class="badge" id="activeCompanyFirstTouchBadge">первые письма: 0</span>
            <span class="badge" id="activeCompanyFollowUpBadge">follow-up: 0</span>
            <span class="badge" id="activeCompanyRepliesBadge">ответы: 0</span>
            <span class="badge" id="activeCompanyRecipientsBadge">получатели: 0</span>
            <span class="badge" id="activeCompanyStatusBadge">draft</span>
          </div>
          <div class="row">
            <span class="badge" id="activeCompanyAddressBadge">адрес: -</span>
            <span class="badge" id="activeCompanyPriceBadge">цена: -</span>
            <span class="badge" id="activeCompanyAreaBadge">площадь: -</span>
            <span class="badge" id="activeCompanyPricePerSqmBadge">цена/м²: -</span>
          </div>
          <div id="activeCompanyImageWrap" class="hidden">
            <img
              id="activeCompanyImage"
              alt=""
              style="width:100%; max-height:360px; object-fit:cover; border-radius:18px; border:1px solid var(--line); background:rgba(255,255,255,0.72);"
            />
          </div>
          <div class="plan-summary-grid">
            <div class="plan-summary-card">
              <div class="plan-summary-top">
                <span class="plan-summary-title">Месяц</span>
                <span class="badge" id="monthlyPlanPaceBadge">Нет плана</span>
              </div>
              <div class="plan-summary-main">
                <strong id="monthlyPlanCompletionValue">0%</strong>
                <span class="plan-summary-sub" id="monthlyPlanCompletionMeta">0 / 0</span>
              </div>
            </div>
            <div class="plan-summary-card">
              <div class="plan-summary-top">
                <span class="plan-summary-title">Неделя</span>
                <span class="badge" id="weeklyPlanPaceBadge">Нет плана</span>
              </div>
              <div class="plan-summary-main">
                <strong id="weeklyPlanCompletionValue">0%</strong>
                <span class="plan-summary-sub" id="weeklyPlanCompletionMeta">0 / 0</span>
              </div>
            </div>
            <div class="plan-summary-card">
              <div class="plan-summary-top">
                <span class="plan-summary-title">День</span>
                <span class="badge" id="dailyPlanPaceBadge">Нет плана</span>
              </div>
              <div class="plan-summary-main">
                <strong id="dailyPlanCompletionValue">0%</strong>
                <span class="plan-summary-sub" id="dailyPlanCompletionMeta">0 / 0</span>
              </div>
            </div>
          </div>
          <div class="stack">
            <h2>План отправок</h2>
            <div class="plan-grid">
              <div class="plan-card">
                <div class="plan-head">
                  <h3>Месяц</h3>
                  <span class="badge" id="monthlyPlanStatusBadge">Не задан</span>
                </div>
                <div class="plan-inputs">
                  <label class="plan-field">
                    <span>Первые письма</span>
                    <input id="monthlyFirstTouchTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Follow-up</span>
                    <input id="monthlyFollowUpTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Уникальные фирмы</span>
                    <input id="monthlyUniqueCompaniesTargetInput" type="number" min="0" step="1" />
                  </label>
                </div>
                <div class="plan-fact" id="monthlyPlanFact"></div>
              </div>
              <div class="plan-card">
                <div class="plan-head">
                  <h3>Неделя</h3>
                  <span class="badge" id="weeklyPlanStatusBadge">Не задан</span>
                </div>
                <div class="plan-inputs">
                  <label class="plan-field">
                    <span>Первые письма</span>
                    <input id="weeklyFirstTouchTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Follow-up</span>
                    <input id="weeklyFollowUpTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Уникальные фирмы</span>
                    <input id="weeklyUniqueCompaniesTargetInput" type="number" min="0" step="1" />
                  </label>
                </div>
                <div class="plan-fact" id="weeklyPlanFact"></div>
              </div>
              <div class="plan-card">
                <div class="plan-head">
                  <h3>День</h3>
                  <span class="badge" id="dailyPlanStatusBadge">Не задан</span>
                </div>
                <div class="plan-inputs">
                  <label class="plan-field">
                    <span>Первые письма</span>
                    <input id="dailyFirstTouchTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Follow-up</span>
                    <input id="dailyFollowUpTargetInput" type="number" min="0" step="1" />
                  </label>
                  <label class="plan-field">
                    <span>Уникальные фирмы</span>
                    <input id="dailyUniqueCompaniesTargetInput" type="number" min="0" step="1" />
                  </label>
                </div>
                <div class="plan-fact" id="dailyPlanFact"></div>
              </div>
            </div>
          </div>
          <div class="stack">
            <h2>Письмо</h2>
            <input id="companyLetterSubjectInput" placeholder="Тема письма" />
            <textarea id="companyLetterBodyInput" placeholder="Основное письмо"></textarea>
          </div>
          <div class="stack">
            <div class="row">
              <h2>Пинги</h2>
              <button class="btn" id="generateFollowupsBtn">Сгенерировать follow-up</button>
            </div>
            <textarea id="companyPingOneInput" placeholder="Пинг 1"></textarea>
            <textarea id="companyPingTwoInput" placeholder="Пинг 2"></textarea>
            <textarea id="companyPingThreeInput" placeholder="Пинг 3"></textarea>
          </div>
          <div class="stack">
            <div class="row">
              <div>
                <h2>Расписание запусков</h2>
                <div class="small">Месячный pipeline в формате: <code>YYYY-MM-DD | assets/sales_campaigns/.../manifest.csv | комментарий</code>.</div>
              </div>
              <div class="row">
                <button class="btn" id="generateTodayPipelineBtn">Собрать today pipeline</button>
                <button class="btn" id="saveExecutionConfigBtn">Сохранить расписание</button>
                <button class="btn primary" id="launchTodayBtn">Запустить сегодня</button>
              </div>
            </div>
            <input id="executionMonthLabelInput" placeholder="Месяц / wave label, например May 2026" />
            <textarea id="executionScheduleInput" placeholder="2026-05-09 | assets/sales_campaigns/.../manifest.csv | day 1&#10;2026-05-10 | assets/sales_campaigns/.../manifest.csv | day 2"></textarea>
            <div class="small" id="executionStatusMeta">Расписание пока не задано.</div>
            <div id="executionPreviewList" class="stack"></div>
            <div id="executionRunsList" class="stack"></div>
          </div>
        </section>

        <section class="panel stack">
          <div class="row">
            <div>
              <h2>Гипотезы и ICP</h2>
              <div class="small">Сегменты покупателей, value prop и стартовая логика, из которой собирается pipeline.</div>
            </div>
            <button class="btn primary" id="generateHypothesesBtn">Сгенерировать гипотезы</button>
          </div>
          <div id="activeCompanyHypothesesList" class="stack"></div>
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
      const OBJECT_ROUTE_PREFIX = "/broker/object/";
      const state = {
        campaigns: [],
        campaignPlaybooks: {},
        campaignsTotal: 0,
        companyDirectoryTotal: 0,
        contactedCompaniesTotal: 0,
        sentEmailsTotal: 0,
        selectedCampaignId: "",
        selectedCampaign: null,
        activeCompanyRecipientsPage: 1,
        expandedRecipientCompanies: {},
        selectedCampaignPlaybook: null,
        selectedCampaignExecution: null,
        generatingHypotheses: false,
        generatingCopy: false,
        generatingFollowups: false,
        generatingTodayPipeline: false,
        savingExecution: false,
        launchingExecution: false,
      };

      const $ = (id) => document.getElementById(id);

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
        const response = await fetch(url, Object.assign({}, options, { headers: Object.assign({}, options.headers || {}) }));
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || ("Код " + response.status));
        return payload;
      }

      async function loadCampaigns() {
        const q = $("outreachSearchInput").value.trim();
        const payload = await apiFetch("/broker/campaigns?" + new URLSearchParams({ q, limit: "100" }).toString());
        state.campaigns = payload.items || [];
        state.campaignsTotal = Number(payload.total ?? state.campaigns.length);
        const playbooks = await Promise.all(state.campaigns.map(async (campaign) => {
          try {
            return [campaign.id, await apiFetch("/broker/campaigns/" + encodeURIComponent(campaign.id) + "/playbook")];
          } catch {
            return [campaign.id, null];
          }
        }));
        state.campaignPlaybooks = Object.fromEntries(playbooks);
        if (state.selectedCampaignId && !state.campaigns.some((item) => item.id === state.selectedCampaignId)) {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
        }
      }

      async function loadDashboardSummary() {
        const [allCampaignsResult, directorySummaryResult, outreachSummaryResult] = await Promise.allSettled([
          apiFetch("/broker/campaigns?limit=100"),
          apiFetch("/broker/company-directory?limit=1"),
          apiFetch("/broker/outreach/companies?limit=1"),
        ]);
        const allCampaigns = allCampaignsResult.status === "fulfilled" ? allCampaignsResult.value : { items: [] };
        const directorySummary = directorySummaryResult.status === "fulfilled" ? directorySummaryResult.value : { total: 0 };
        const outreachSummary = outreachSummaryResult.status === "fulfilled" ? outreachSummaryResult.value : { total: 0 };
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
          await Promise.all([loadCampaigns(), loadDashboardSummary()]);
          await syncSelectionFromPath();
          if (state.selectedCampaignId) {
            await Promise.all([
              loadSelectedCampaign(),
              loadSelectedCampaignPlaybook(),
              loadSelectedCampaignExecution(),
            ]);
          }
          renderAll();
          $("globalMsg").textContent = "Готово.";
        } catch (err) {
          $("globalMsg").textContent = "Ошибка: " + err.message;
          renderAll();
        }
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
            const planState = summarizeCampaignPlan(state.campaignPlaybooks[campaign.id]);
            const title = String(campaign.campaign_name || "Без названия");
            const metaObject = String(campaign.property?.title || campaign.property_id || "Объект не указан");
            const showMetaObject = metaObject.trim() && metaObject.trim() !== title.trim();
            return (
              '<article class="campaign-card ' + planState.cardClass + (isActive ? ' active' : '') + '" data-active-campaign-id="' + escapeHtml(campaign.id || "") + '">' +
                '<strong>' + escapeHtml(title) + '</strong>' +
                '<div class="row" style="margin-top:8px;">' +
                  '<span class="' + escapeHtml(planState.badgeClass) + '">' + escapeHtml(planState.label) + '</span>' +
                  '<span class="badge">первые: ' + escapeHtml(stats.firstTouchCount || 0) + '</span>' +
                  '<span class="badge">follow-up: ' + escapeHtml(stats.followUpCount || 0) + '</span>' +
                  '<span class="badge">получатели: ' + escapeHtml(stats.recipientCount || 0) + '</span>' +
                '</div>' +
                '<div class="small" style="margin-top:8px;">' + escapeHtml(campaign.objective || "Цель не указана") + '</div>' +
                (showMetaObject
                  ? '<div class="small" style="margin-top:8px;">' + escapeHtml(metaObject) + '</div>'
                  : '') +
              '</article>'
            );
          }).join("")
          : '<div class="small">Нет объектов по текущему фильтру.</div>';
      }

      function objectStatusLabel(status) {
        return ({
          draft: "Неактивно",
          running: "Активно",
          paused: "Неактивно",
          stopped: "Остановлено",
        })[status] || "Неактивно";
      }

      function isObjectActive(status) {
        return status === "running";
      }

      function objectStatusClass(status) {
        if (status === "running") return "badge status-active";
        if (status === "stopped") return "badge status-stopped";
        return "badge status-inactive";
      }

      function renderCompanyStatusControls(status) {
        const toggleButton = $("toggleCompanyStatusBtn");
        const stopButton = $("stopCompanyBtn");
        const active = isObjectActive(status);

        toggleButton.className = active ? "btn success" : "btn warning";
        toggleButton.textContent = active ? "Активно" : "Неактивно";
        stopButton.disabled = !active;
      }

      function applyToggleButtonHover(isHovering) {
        const campaign = state.selectedCampaign;
        const status = companyDraft(campaign).status || "draft";
        const active = isObjectActive(status);
        const toggleButton = $("toggleCompanyStatusBtn");
        if (active) {
          toggleButton.className = isHovering ? "btn danger" : "btn success";
          toggleButton.textContent = isHovering ? "Остановить" : "Активно";
          return;
        }
        toggleButton.className = isHovering ? "btn success" : "btn warning";
        toggleButton.textContent = isHovering ? "Запуск" : "Неактивно";
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

      function companyDraft(company) {
        const current = state.selectedCampaignPlaybook;
        const fallbackObject = company?.property?.title || "объект";
        return {
          status: current?.status || "draft",
          subject: current?.subject || ("Предложение по объекту " + fallbackObject),
          letterBody: current?.letter_body || ("Добрый день. Направляю предложение по объекту " + fallbackObject + ". Готов отправить материалы и обсудить формат."),
          pingOne: current?.ping_one || "Возвращаюсь к письму по объекту. Подскажите, актуально ли посмотреть материалы?",
          pingTwo: current?.ping_two || "Коротко напоминаю о предложении. Если интересно, отправлю расширенный пакет сегодня.",
          pingThree: current?.ping_three || "Последний follow-up по этому объекту. Если тема неактуальна, зафиксирую и сниму компанию с пинга.",
          monthlyPlan: normalizePlan(current?.monthly_plan),
          weeklyPlan: normalizePlan(current?.weekly_plan),
          dailyPlan: normalizePlan(current?.daily_plan),
          monthlyProgress: current?.monthly_progress || defaultPlanProgress(),
          weeklyProgress: current?.weekly_progress || defaultPlanProgress(),
          dailyProgress: current?.daily_progress || defaultPlanProgress(),
        };
      }

      function normalizePlan(plan) {
        return {
          firstTouchTarget: Math.max(0, Number(plan?.firstTouchTarget || 0) || 0),
          followUpTarget: Math.max(0, Number(plan?.followUpTarget || 0) || 0),
          uniqueCompaniesTarget: Math.max(0, Number(plan?.uniqueCompaniesTarget || 0) || 0),
        };
      }

      function defaultPlanProgress() {
        return {
          target: normalizePlan(),
          actual: {
            firstTouchCount: 0,
            followUpCount: 0,
            uniqueCompaniesCount: 0,
          },
          status: "not_planned",
          pace_status: "not_planned",
          completion_ratio: 0,
          elapsed_ratio: 0,
          overdue: false,
        };
      }

      function planStatusMeta(status) {
        if (status === "done") return { label: "Выполнен", className: "badge status-active" };
        if (status === "in_progress") return { label: "В работе", className: "badge status-inactive" };
        if (status === "not_started") return { label: "Не начат", className: "badge status-stopped" };
        return { label: "Не задан", className: "badge" };
      }

      function planPaceMeta(status) {
        if (status === "ahead") return { label: "Перевыполнен", className: "badge status-ahead" };
        if (status === "behind") return { label: "Отстает", className: "badge status-behind" };
        if (status === "on_track") return { label: "Идет по плану", className: "badge status-on-track" };
        return { label: "Нет плана", className: "badge" };
      }

      function summarizeCampaignPlan(playbook) {
        const paces = [
          playbook?.monthly_progress?.pace_status || "not_planned",
          playbook?.weekly_progress?.pace_status || "not_planned",
          playbook?.daily_progress?.pace_status || "not_planned",
        ];
        if (paces.includes("behind")) {
          return { label: "Отстает", badgeClass: "badge status-behind", cardClass: "plan-behind" };
        }
        if (paces.includes("ahead") || paces.includes("on_track")) {
          return {
            label: paces.includes("ahead") ? "Опережает" : "По плану",
            badgeClass: "badge status-ahead",
            cardClass: "plan-ok",
          };
        }
        return { label: "План не задан", badgeClass: "badge status-inactive", cardClass: "plan-empty" };
      }

      function setPlanFact(prefix, progress) {
        const meta = planStatusMeta(progress?.status);
        $(prefix + "PlanStatusBadge").textContent = meta.label;
        $(prefix + "PlanStatusBadge").className = meta.className;
        $(prefix + "PlanFact").innerHTML = [
          ["Первые письма", progress?.actual?.firstTouchCount || 0, progress?.target?.firstTouchTarget || 0],
          ["Follow-up", progress?.actual?.followUpCount || 0, progress?.target?.followUpTarget || 0],
          ["Уникальные фирмы", progress?.actual?.uniqueCompaniesCount || 0, progress?.target?.uniqueCompaniesTarget || 0],
        ].map(([label, actual, target]) =>
          '<div class="plan-fact-row"><span>' + label + '</span><strong>' + actual + ' / ' + target + '</strong></div>'
        ).join("");
      }

      function setPlanSummary(prefix, progress) {
        const pace = planPaceMeta(progress?.pace_status);
        const totalTarget = (progress?.target?.firstTouchTarget || 0)
          + (progress?.target?.followUpTarget || 0)
          + (progress?.target?.uniqueCompaniesTarget || 0);
        const totalActual = Math.min(progress?.actual?.firstTouchCount || 0, progress?.target?.firstTouchTarget || 0)
          + Math.min(progress?.actual?.followUpCount || 0, progress?.target?.followUpTarget || 0)
          + Math.min(progress?.actual?.uniqueCompaniesCount || 0, progress?.target?.uniqueCompaniesTarget || 0);
        $(prefix + "PlanPaceBadge").textContent = pace.label;
        $(prefix + "PlanPaceBadge").className = pace.className;
        $(prefix + "PlanCompletionValue").textContent = Math.round((progress?.completion_ratio || 0) * 100) + "%";
        $(prefix + "PlanCompletionMeta").textContent = totalActual + " / " + totalTarget;
      }

      function formatRub(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return "-";
        return amount.toLocaleString("ru-RU") + " ₽";
      }

      function formatSqm(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return "-";
        return amount.toLocaleString("ru-RU", { minimumFractionDigits: amount % 1 ? 1 : 0, maximumFractionDigits: 1 }) + " м²";
      }

      function renderPropertyBadges(property) {
        $("activeCompanyAddressBadge").textContent = "адрес: " + (property?.address || "—");
        $("activeCompanyPriceBadge").textContent = "цена: " + formatRub(property?.price_rub);
        $("activeCompanyAreaBadge").textContent = "площадь: " + formatSqm(property?.area_sqm);
        $("activeCompanyPricePerSqmBadge").textContent = "цена/м²: " + formatRub(property?.price_per_sqm);
      }

      function propertyMainImage(property) {
        const media = property?.attributes?.media;
        return media?.main_url || "";
      }

      function renderPropertyImage(property) {
        const src = propertyMainImage(property);
        $("activeCompanyImageWrap").classList.toggle("hidden", !src);
        $("activeCompanyImage").src = src || "";
      }

      async function loadSelectedCampaignPlaybook() {
        if (!state.selectedCampaignId) {
          state.selectedCampaignPlaybook = null;
          return;
        }
        state.selectedCampaignPlaybook = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaignId) + "/playbook");
      }

      async function loadSelectedCampaignExecution() {
        if (!state.selectedCampaignId) {
          state.selectedCampaignExecution = null;
          return;
        }
        state.selectedCampaignExecution = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaignId) + "/execution");
      }

      function executionScheduleToText(execution) {
        const rows = Array.isArray(execution?.schedules) ? execution.schedules : [];
        return rows.map((item) =>
          [item.date || "", item.manifestPath || "", item.label || ""].filter(Boolean).join(" | ")
        ).join("\\n");
      }

      function parseExecutionScheduleInput() {
        return $("executionScheduleInput").value
          .split("\\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const parts = line.split("|").map((item) => item.trim());
            return {
              date: parts[0] || "",
              manifestPath: parts[1] || "",
              label: parts.slice(2).join(" | ") || "",
            };
          });
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
          $("activeCompanyRepliesBadge").textContent = "ответы: 0";
          $("activeCompanyRecipientsBadge").textContent = "получатели: 0";
          $("activeCompanyStatusBadge").textContent = "Неактивно";
          $("activeCompanyStatusBadge").className = objectStatusClass("draft");
          $("generateCopyBtn").disabled = false;
          $("generateCopyBtn").textContent = "Сгенерировать письмо";
          $("generateFollowupsBtn").disabled = false;
          $("generateFollowupsBtn").textContent = "Сгенерировать follow-up";
          renderPropertyBadges(null);
          renderPropertyImage(null);
          $("companyLetterSubjectInput").value = "";
          $("companyLetterBodyInput").value = "";
          $("companyPingOneInput").value = "";
          $("companyPingTwoInput").value = "";
          $("companyPingThreeInput").value = "";
          $("executionMonthLabelInput").value = "";
          $("executionScheduleInput").value = "";
          $("executionStatusMeta").textContent = "Расписание пока не задано.";
          $("executionPreviewList").innerHTML = '<div class="small">Preview очереди появится после генерации.</div>';
          $("executionRunsList").innerHTML = '<div class="small">Запуски появятся после выбора объекта.</div>';
          $("generateTodayPipelineBtn").disabled = false;
          $("generateTodayPipelineBtn").textContent = "Собрать today pipeline";
          $("saveExecutionConfigBtn").disabled = false;
          $("saveExecutionConfigBtn").textContent = "Сохранить расписание";
          $("launchTodayBtn").disabled = true;
          $("launchTodayBtn").textContent = "Запустить сегодня";
          $("monthlyFirstTouchTargetInput").value = "0";
          $("monthlyFollowUpTargetInput").value = "0";
          $("monthlyUniqueCompaniesTargetInput").value = "0";
          $("weeklyFirstTouchTargetInput").value = "0";
          $("weeklyFollowUpTargetInput").value = "0";
          $("weeklyUniqueCompaniesTargetInput").value = "0";
          $("dailyFirstTouchTargetInput").value = "0";
          $("dailyFollowUpTargetInput").value = "0";
          $("dailyUniqueCompaniesTargetInput").value = "0";
          setPlanSummary("monthly", defaultPlanProgress());
          setPlanSummary("weekly", defaultPlanProgress());
          setPlanSummary("daily", defaultPlanProgress());
          setPlanFact("monthly", defaultPlanProgress());
          setPlanFact("weekly", defaultPlanProgress());
          setPlanFact("daily", defaultPlanProgress());
          $("generateHypothesesBtn").disabled = false;
          $("generateHypothesesBtn").textContent = "Сгенерировать гипотезы";
          $("activeCompanyHypothesesList").innerHTML = '<div class="small">Гипотезы появятся после выбора объекта.</div>';
          $("activeCompanyRecipientsList").innerHTML = '<div class="small">Получатели появятся после выбора компании.</div>';
          $("activeCompanyPageBadge").textContent = "1 / 1";
          $("activeCompanyPrevPageBtn").disabled = true;
          $("activeCompanyNextPageBtn").disabled = true;
          renderCompanyStatusControls("draft");
          return;
        }

        const draft = companyDraft(campaign);
        const stats = campaign.stats || {};
        const property = campaign.property || null;
        const execution = state.selectedCampaignExecution || { monthLabel: null, schedules: [], lastRun: null, runs: [] };
        const targetCompanies = Array.isArray(campaign.targetCompanies) ? campaign.targetCompanies : [];
        const hypotheses = Array.isArray(campaign.hypotheses) ? campaign.hypotheses : [];
        const totalPages = Math.max(1, Math.ceil(targetCompanies.length / pageSize));
        const page = Math.min(Math.max(1, state.activeCompanyRecipientsPage), totalPages);
        state.activeCompanyRecipientsPage = page;
        const pageItems = targetCompanies.slice((page - 1) * pageSize, page * pageSize);
        $("activeCompanyTitle").textContent = campaign.campaign_name || "Объект";
        $("activeCompanyMeta").textContent = (campaign.property?.title || "Объект") + " · " + (campaign.objective || "Цель не указана");
        $("activeCompanyCompaniesBadge").textContent = "компании: " + targetCompanies.length;
        $("activeCompanyFirstTouchBadge").textContent = "первые письма: " + (stats.firstTouchCount || 0);
        $("activeCompanyFollowUpBadge").textContent = "follow-up: " + (stats.followUpCount || 0);
        $("activeCompanyRepliesBadge").textContent = "ответы: " + (stats.repliedCount || 0);
        $("activeCompanyRecipientsBadge").textContent = "получатели: " + (stats.recipientCount || 0);
        $("activeCompanyStatusBadge").textContent = objectStatusLabel(draft.status || "draft");
        $("activeCompanyStatusBadge").className = objectStatusClass(draft.status || "draft");
        $("generateCopyBtn").disabled = state.generatingCopy;
        $("generateCopyBtn").textContent = state.generatingCopy ? "Генерируем..." : "Сгенерировать письмо";
        $("generateFollowupsBtn").disabled = state.generatingFollowups;
        $("generateFollowupsBtn").textContent = state.generatingFollowups ? "Генерируем..." : "Сгенерировать follow-up";
        renderPropertyBadges(property);
        renderPropertyImage(property);
        $("companyLetterSubjectInput").value = draft.subject || "";
        $("companyLetterBodyInput").value = draft.letterBody || "";
        $("companyPingOneInput").value = draft.pingOne || "";
        $("companyPingTwoInput").value = draft.pingTwo || "";
        $("companyPingThreeInput").value = draft.pingThree || "";
        $("executionMonthLabelInput").value = execution.monthLabel || "";
        $("executionScheduleInput").value = executionScheduleToText(execution);
        $("generateTodayPipelineBtn").disabled = state.generatingTodayPipeline;
        $("generateTodayPipelineBtn").textContent = state.generatingTodayPipeline ? "Собираем..." : "Собрать today pipeline";
        $("saveExecutionConfigBtn").disabled = state.savingExecution;
        $("saveExecutionConfigBtn").textContent = state.savingExecution ? "Сохраняем..." : "Сохранить расписание";
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
        const hasTodaySchedule = (execution.schedules || []).some((item) => item.date === today);
        const isRunActive = execution.lastRun?.status === "running";
        $("launchTodayBtn").disabled = state.launchingExecution || isRunActive || !hasTodaySchedule;
        $("launchTodayBtn").textContent = state.launchingExecution
          ? "Запускаем..."
          : (isRunActive ? "Отправка идет" : "Запустить сегодня");
        $("executionStatusMeta").textContent = execution.schedules?.length
          ? "В расписании " + execution.schedules.length + " day manifest(s)." + (execution.monthLabel ? " " + execution.monthLabel + "." : "")
          : "Расписание пока не задано.";
        $("executionPreviewList").innerHTML = execution.generatedPreview?.items?.length
          ? '<article class="activity-row">' +
              '<strong>Today preview · ' + escapeHtml(execution.generatedPreview.total || 0) + ' recipients</strong>' +
              '<div class="small" style="margin-top:6px;">Manifest: ' + escapeHtml(execution.generatedPreview.manifestPath || "") + '</div>' +
              '<div class="small" style="margin-top:10px;">' +
                execution.generatedPreview.items.map((item) =>
                  escapeHtml((item.companyName || "") + " · " + (item.email || "") + " · " + (item.matchedSegment || "") + " · score " + (item.score || 0))
                ).join("<br>")
              + '</div>' +
            '</article>'
          : '<div class="small">Preview очереди появится после генерации.</div>';
        $("executionRunsList").innerHTML = (execution.runs || []).length
          ? execution.runs.map((run) =>
            '<article class="activity-row">' +
              '<div class="row" style="align-items:flex-start;">' +
                '<div style="flex:1;">' +
                  '<strong>' + escapeHtml(run.label || run.date || "Run") + '</strong>' +
                  '<div class="small" style="margin-top:6px;">' + escapeHtml(run.manifestPath || "") + '</div>' +
                '</div>' +
                '<span class="badge">' + escapeHtml(run.status || "idle") + '</span>' +
              '</div>' +
              '<div class="small" style="margin-top:8px;">Старт: ' + escapeHtml(run.startedAt || "—") + (run.completedAt ? ' · Завершение: ' + escapeHtml(run.completedAt) : '') + '</div>' +
              (run.error ? '<div class="small" style="margin-top:6px; color:var(--danger);">' + escapeHtml(run.error) + '</div>' : '') +
              (run.output ? '<pre style="margin-top:8px; white-space:pre-wrap; font-size:12px; color:var(--muted);">' + escapeHtml(run.output) + '</pre>' : '') +
            '</article>'
          ).join("")
          : '<div class="small">История запусков пока пустая.</div>';
        $("monthlyFirstTouchTargetInput").value = String(draft.monthlyPlan.firstTouchTarget || 0);
        $("monthlyFollowUpTargetInput").value = String(draft.monthlyPlan.followUpTarget || 0);
        $("monthlyUniqueCompaniesTargetInput").value = String(draft.monthlyPlan.uniqueCompaniesTarget || 0);
        $("weeklyFirstTouchTargetInput").value = String(draft.weeklyPlan.firstTouchTarget || 0);
        $("weeklyFollowUpTargetInput").value = String(draft.weeklyPlan.followUpTarget || 0);
        $("weeklyUniqueCompaniesTargetInput").value = String(draft.weeklyPlan.uniqueCompaniesTarget || 0);
        $("dailyFirstTouchTargetInput").value = String(draft.dailyPlan.firstTouchTarget || 0);
        $("dailyFollowUpTargetInput").value = String(draft.dailyPlan.followUpTarget || 0);
        $("dailyUniqueCompaniesTargetInput").value = String(draft.dailyPlan.uniqueCompaniesTarget || 0);
        setPlanSummary("monthly", draft.monthlyProgress);
        setPlanSummary("weekly", draft.weeklyProgress);
        setPlanSummary("daily", draft.dailyProgress);
        setPlanFact("monthly", draft.monthlyProgress);
        setPlanFact("weekly", draft.weeklyProgress);
        setPlanFact("daily", draft.dailyProgress);
        renderCompanyStatusControls(draft.status || "draft");
        $("generateHypothesesBtn").disabled = state.generatingHypotheses;
        $("generateHypothesesBtn").textContent = state.generatingHypotheses ? "Генерируем..." : "Сгенерировать гипотезы";
        $("activeCompanyHypothesesList").innerHTML = hypotheses.length
          ? hypotheses.map((item) =>
            '<article class="activity-row">' +
              '<div class="row" style="align-items:flex-start;">' +
                '<div style="flex:1;">' +
                  '<strong>' + escapeHtml(item.segment_name || "Сегмент") + '</strong>' +
                  '<div class="small" style="margin-top:6px;">' + escapeHtml(item.value_prop || "Без value prop") + '</div>' +
                '</div>' +
                '<div class="row">' +
                  '<span class="badge">' + escapeHtml(item.segment_type || "segment") + '</span>' +
                  '<span class="badge">prio: ' + escapeHtml(item.priority || 0) + '</span>' +
                  '<span class="badge">' + escapeHtml(item.channel || "email") + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="small" style="margin-top:8px;">' + escapeHtml(item.reasoning || "Без пояснения") + '</div>' +
            '</article>'
          ).join("")
          : '<div class="small">По объекту пока нет гипотез. Нажми “Сгенерировать гипотезы”, чтобы получить стартовый ICP-пакет.</div>';
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
                '<div class="small recipient-company-metric"><span class="muted">Ответы</span><br><strong>' + escapeHtml(company.repliedCount || 0) + '</strong></div>' +
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
        renderCompanyDirectory();
        renderActiveCompanyDetail();
      }

      async function saveActiveCompanyDraft(nextStatus) {
        const campaign = state.selectedCampaign;
        if (!campaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        const draft = {
          status: nextStatus || companyDraft(campaign).status || "draft",
          subject: $("companyLetterSubjectInput").value.trim(),
          letterBody: $("companyLetterBodyInput").value.trim(),
          pingOne: $("companyPingOneInput").value.trim(),
          pingTwo: $("companyPingTwoInput").value.trim(),
          pingThree: $("companyPingThreeInput").value.trim(),
          monthlyPlan: {
            firstTouchTarget: Number($("monthlyFirstTouchTargetInput").value || 0),
            followUpTarget: Number($("monthlyFollowUpTargetInput").value || 0),
            uniqueCompaniesTarget: Number($("monthlyUniqueCompaniesTargetInput").value || 0),
          },
          weeklyPlan: {
            firstTouchTarget: Number($("weeklyFirstTouchTargetInput").value || 0),
            followUpTarget: Number($("weeklyFollowUpTargetInput").value || 0),
            uniqueCompaniesTarget: Number($("weeklyUniqueCompaniesTargetInput").value || 0),
          },
          dailyPlan: {
            firstTouchTarget: Number($("dailyFirstTouchTargetInput").value || 0),
            followUpTarget: Number($("dailyFollowUpTargetInput").value || 0),
            uniqueCompaniesTarget: Number($("dailyUniqueCompaniesTargetInput").value || 0),
          },
        };
        state.selectedCampaignPlaybook = await apiFetch("/broker/campaigns/" + encodeURIComponent(campaign.id) + "/playbook", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        state.campaignPlaybooks[campaign.id] = state.selectedCampaignPlaybook;
        $("globalMsg").textContent = "Карточка объекта сохранена.";
        renderAll();
      }

      async function generateHypotheses() {
        const campaign = state.selectedCampaign;
        if (!campaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.generatingHypotheses = true;
        renderActiveCompanyDetail();
        try {
          await apiFetch("/broker/campaigns/" + encodeURIComponent(campaign.id) + "/hypotheses/generate", {
            method: "POST",
          });
          await loadSelectedCampaign();
          $("globalMsg").textContent = "Гипотезы сгенерированы.";
          renderAll();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка генерации гипотез: " + err.message;
        } finally {
          state.generatingHypotheses = false;
          renderActiveCompanyDetail();
        }
      }

      async function generateCopy() {
        const campaign = state.selectedCampaign;
        if (!campaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.generatingCopy = true;
        renderActiveCompanyDetail();
        try {
          state.selectedCampaignPlaybook = await apiFetch("/broker/campaigns/" + encodeURIComponent(campaign.id) + "/playbook/generate-copy", {
            method: "POST",
          });
          state.campaignPlaybooks[campaign.id] = state.selectedCampaignPlaybook;
          $("globalMsg").textContent = "Письмо и пинги сгенерированы.";
          renderActiveCompanyDetail();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка генерации письма: " + err.message;
        } finally {
          state.generatingCopy = false;
          renderActiveCompanyDetail();
        }
      }

      async function generateFollowups() {
        const campaign = state.selectedCampaign;
        if (!campaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.generatingFollowups = true;
        renderActiveCompanyDetail();
        try {
          state.selectedCampaignPlaybook = await apiFetch("/broker/campaigns/" + encodeURIComponent(campaign.id) + "/playbook/generate-followups", {
            method: "POST",
          });
          state.campaignPlaybooks[campaign.id] = state.selectedCampaignPlaybook;
          $("globalMsg").textContent = "Follow-up пинги сгенерированы.";
          renderActiveCompanyDetail();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка генерации follow-up: " + err.message;
        } finally {
          state.generatingFollowups = false;
          renderActiveCompanyDetail();
        }
      }

      async function saveExecutionConfig() {
        if (!state.selectedCampaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.savingExecution = true;
        renderActiveCompanyDetail();
        try {
          state.selectedCampaignExecution = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaign.id) + "/execution", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthLabel: $("executionMonthLabelInput").value.trim(),
              schedules: parseExecutionScheduleInput(),
            }),
          });
          $("globalMsg").textContent = "Расписание запусков сохранено.";
          renderActiveCompanyDetail();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка сохранения расписания: " + err.message;
        } finally {
          state.savingExecution = false;
          renderActiveCompanyDetail();
        }
      }

      async function launchTodayExecution() {
        if (!state.selectedCampaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.launchingExecution = true;
        renderActiveCompanyDetail();
        try {
          const payload = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaign.id) + "/execution/launch-today", {
            method: "POST",
          });
          state.selectedCampaignExecution = payload.state || state.selectedCampaignExecution;
          $("globalMsg").textContent = "Запуск отправки поставлен в очередь.";
          renderActiveCompanyDetail();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка запуска: " + err.message;
        } finally {
          state.launchingExecution = false;
          renderActiveCompanyDetail();
        }
      }

      async function generateTodayPipeline() {
        if (!state.selectedCampaign) {
          $("globalMsg").textContent = "Сначала выберите объект.";
          return;
        }
        state.generatingTodayPipeline = true;
        renderActiveCompanyDetail();
        try {
          const payload = await apiFetch("/broker/campaigns/" + encodeURIComponent(state.selectedCampaign.id) + "/pipeline/generate-today", {
            method: "POST",
          });
          state.selectedCampaignExecution = payload.state || state.selectedCampaignExecution;
          $("globalMsg").textContent = "Today pipeline собран и добавлен в расписание.";
          renderActiveCompanyDetail();
        } catch (err) {
          $("globalMsg").textContent = "Ошибка генерации очереди: " + err.message;
        } finally {
          state.generatingTodayPipeline = false;
          renderActiveCompanyDetail();
        }
      }

      function bindEvents() {
        $("refreshBtn").addEventListener("click", refreshAll);
        $("saveCompanyDraftBtn").addEventListener("click", () => saveActiveCompanyDraft());
        $("generateCopyBtn").addEventListener("click", () => generateCopy());
        $("generateFollowupsBtn").addEventListener("click", () => generateFollowups());
        $("generateTodayPipelineBtn").addEventListener("click", () => generateTodayPipeline());
        $("saveExecutionConfigBtn").addEventListener("click", () => saveExecutionConfig());
        $("launchTodayBtn").addEventListener("click", () => launchTodayExecution());
        $("generateHypothesesBtn").addEventListener("click", () => generateHypotheses());
        $("toggleCompanyStatusBtn").addEventListener("click", () => {
          const campaign = state.selectedCampaign;
          const currentStatus = companyDraft(campaign).status || "draft";
          saveActiveCompanyDraft(isObjectActive(currentStatus) ? "paused" : "running");
        });
        $("toggleCompanyStatusBtn").addEventListener("mouseenter", () => applyToggleButtonHover(true));
        $("toggleCompanyStatusBtn").addEventListener("mouseleave", () => applyToggleButtonHover(false));
        $("stopCompanyBtn").addEventListener("click", () => saveActiveCompanyDraft("stopped"));
        $("backToCompaniesBtn").addEventListener("click", () => {
          state.selectedCampaignId = "";
          state.selectedCampaign = null;
          state.selectedCampaignPlaybook = null;
          state.selectedCampaignExecution = null;
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
            loadSelectedCampaign()
              .then(() => Promise.all([loadSelectedCampaignPlaybook(), loadSelectedCampaignExecution()]))
              .then(renderAll)
              .catch((err) => $("globalMsg").textContent = "Ошибка: " + err.message);
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
            .then(() => state.selectedCampaignId ? loadSelectedCampaign().then(() => Promise.all([loadSelectedCampaignPlaybook(), loadSelectedCampaignExecution()])) : Promise.resolve())
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
