const STORAGE_KEY = "monthlyActivitySystem.v1";
const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80";
const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1800&q=80";
const DEFAULT_SETTINGS = {
  siteName: "女創俱樂部｜實體聚會",
  tagline: "舞台影響力",
  heroTitle: "讓妳的專業被看見，讓每一次聚會都創造新的可能",
  heroDescription:
    "不論妳想舉辦講座、交流會、體驗課或主題聚會，都可以在這裡提出活動企劃。女創俱樂部將協助審核、上架與管理報名名單，讓妳更專注在內容與分享；會員也能快速找到適合自己的活動，從參與開始，遇見合作、資源與更多可能。",
  contactEmail: "hana31923@gmail.com",
  primaryColor: "#003e3e",
  heroImage: DEFAULT_HERO_IMAGE,
  emailOpening:
    "親愛的會員您好，\n\n我們已收到您的活動報名，以下是本次活動資訊，請您先保留時間並確認資料。",
  emailClosing:
    "提醒您，活動前系統會再寄出提醒信。\n\n期待在活動現場與您相見。\n\nCXO Woman 女創俱樂部",
};
const ADMIN_USERNAME = "admin@example.com";
const ADMIN_PASSWORD = "cxo2026";
const AUTH_KEY = "monthlyActivityAdminAuthenticated";
const ACCESS_TOKEN_KEY = "monthlyActivitySupabaseAccessToken";
const RECOVERY_TOKEN_KEY = "monthlyActivitySupabaseRecoveryToken";
const PROTECTED_ROUTES = ["admin", "settings"];
const CLOUD_CONFIG = window.CXO_CONFIG || {};

const state = {
  data: loadData(),
  route: "home",
  selectedProposalId: null,
  registrationEventId: null,
  pendingProtectedRoute: null,
};

const statusLabels = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已退回",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { proposals: [], registrations: [], settings: { ...DEFAULT_SETTINGS } };
  }

  try {
    const data = JSON.parse(raw);
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    settings.heroDescription = settings.heroDescription.replaceAll(
      "老師活動提案",
      "活動提案",
    );
    if (settings.primaryColor.toLowerCase() === "#45634d") {
      settings.primaryColor = "#003e3e";
    }

    return {
      proposals: data.proposals || [],
      registrations: data.registrations || [],
      settings,
    };
  } catch {
    return { proposals: [], registrations: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function cloudIsConfigured() {
  return Boolean(CLOUD_CONFIG.supabaseUrl && CLOUD_CONFIG.supabaseAnonKey);
}

function cloudHeaders(accessToken = "") {
  return {
    apikey: CLOUD_CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${accessToken || CLOUD_CONFIG.supabaseAnonKey}`,
    "Content-Type": "application/json",
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createSlug(title) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return normalized || createId("event");
}

function formatDate(date, time) {
  if (!date) return "日期未定";
  const displayTime = time ? time.slice(0, 5) : "";
  const result = new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T${time || "00:00"}`));
  return displayTime ? `${result} ${displayTime}` : result;
}

function formatEventDate(date, startTime, endTime) {
  const formatted = formatDate(date, startTime);
  return endTime ? `${formatted}–${endTime.slice(0, 5)}` : formatted;
}

function formatFullDate(date) {
  if (!date) return "日期未定";
  const [year, month, day] = date.split("-");
  return `${year} / ${month} / ${day}`;
}

function formatTimeOnly(time) {
  return time ? time.slice(0, 5) : "時間未定";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function showRegistrationSuccess() {
  $("#registrationSuccessOverlay").hidden = false;
}

function closeRegistrationSuccess() {
  $("#registrationSuccessOverlay").hidden = true;
  setRoute("home");
}

function setRoute(route, eventId = null) {
  if (PROTECTED_ROUTES.includes(route) && !isAdminAuthenticated()) {
    openLogin(route);
    return;
  }

  state.route = route;
  state.registrationEventId = eventId;

  $$(".view").forEach((view) => view.classList.remove("is-active"));
  $(`#view-${route}`)?.classList.add("is-active");

  $$(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.route === route);
  });

  if (route === "register") renderRegistrationPage(eventId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isAdminAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

function openLogin(route) {
  state.pendingProtectedRoute = route;
  $("#loginError").textContent = "";
  $("#loginForm").reset();
  $("#loginOverlay").hidden = false;
  $("#loginForm").elements.username.focus();
}

function closeLogin() {
  state.pendingProtectedRoute = null;
  $("#loginOverlay").hidden = true;
  $("#loginError").textContent = "";
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const username = formData.get("username").trim();
  const password = formData.get("password");

  if (cloudIsConfigured()) {
    try {
      const response = await fetch(
        `${CLOUD_CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: cloudHeaders(),
          body: JSON.stringify({ email: username, password }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.access_token) {
        throw new Error(result.error_description || result.msg || "登入失敗");
      }

      sessionStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
      sessionStorage.setItem(AUTH_KEY, "true");
      await syncCloudProposals(true);
      await syncCloudRegistrations();
    } catch (error) {
      $("#loginError").textContent = error.message || "帳號或密碼錯誤，請重新輸入。";
      return;
    }
  } else {
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      $("#loginError").textContent =
        "尚未連接雲端。展示帳號為 admin@example.com，密碼為 cxo2026。";
    return;
  }

    sessionStorage.setItem(AUTH_KEY, "true");
  }

  const route = state.pendingProtectedRoute || "admin";
  $("#loginOverlay").hidden = true;
  state.pendingProtectedRoute = null;
  showToast("登入成功。");
  setRoute(route);
}

function recoveryAccessToken() {
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if (hashParams.get("type") !== "recovery") return "";
  return hashParams.get("access_token") || "";
}

function openPasswordSetup(accessToken) {
  sessionStorage.setItem(RECOVERY_TOKEN_KEY, accessToken);
  $("#passwordError").textContent = "";
  $("#passwordForm").reset();
  $("#passwordOverlay").hidden = false;
  $("#passwordForm").elements.password.focus();
}

async function handlePasswordSetup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const password = form.elements.password.value;
  const confirmPassword = form.elements.confirmPassword.value;
  const accessToken = sessionStorage.getItem(RECOVERY_TOKEN_KEY);

  if (password !== confirmPassword) {
    $("#passwordError").textContent = "兩次輸入的密碼不一致。";
    return;
  }

  if (!accessToken || !cloudIsConfigured()) {
    $("#passwordError").textContent = "密碼設定連結已失效，請重新申請一封重設信。";
    return;
  }

  try {
    const response = await fetch(`${CLOUD_CONFIG.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: cloudHeaders(accessToken),
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.msg || result.message || "密碼設定失敗");
    }

    sessionStorage.removeItem(RECOVERY_TOKEN_KEY);
    history.replaceState(null, "", `${location.pathname}${location.search}#home`);
    $("#passwordOverlay").hidden = true;
    showToast("密碼設定完成，現在可以登入管理後台。");
    openLogin("admin");
  } catch (error) {
    $("#passwordError").textContent =
      error.message || "密碼設定失敗，請重新申請一封重設信。";
  }
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  state.selectedProposalId = null;
  showToast("你已登出管理區。");
  setRoute("home");
}

function approvedEvents() {
  return state.data.proposals
    .filter((proposal) => proposal.status === "approved")
    .sort((a, b) =>
      `${a.date} ${a.startTime || a.time}`.localeCompare(
        `${b.date} ${b.startTime || b.time}`,
      ),
    );
}

function registrationsFor(proposalId) {
  return state.data.registrations.filter((entry) => entry.proposalId === proposalId);
}

function remainingSeats(proposal) {
  return Number(proposal.capacity) - registrationsFor(proposal.id).length;
}

function render() {
  applySettings();
  renderPublicEvents();
  renderStats();
  renderAllRegistrations();
  renderProposalList();
  renderAdminDetail();
  renderCloudStatus();
  populateSettingsForm();
}

function renderCloudStatus() {
  const element = $("#cloudStatus");
  if (!element) return;

  if (cloudIsConfigured()) {
    element.className = "cloud-status is-online";
    element.textContent =
      "雲端模式已啟用：會員報名會集中儲存，並寄送固定 Email 通知。";
    return;
  }

  element.className = "cloud-status is-offline";
  element.textContent =
    "目前是本機展示模式。完成 Supabase 與寄信設定後，報名資料才會跨裝置同步並自動寄信。";
}

async function syncCloudRegistrations() {
  if (!cloudIsConfigured()) return;
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return;

  const response = await fetch(
    `${CLOUD_CONFIG.supabaseUrl}/rest/v1/registrations?select=*&order=created_at.desc`,
    { headers: cloudHeaders(accessToken) },
  );

  if (!response.ok) {
    throw new Error("無法讀取雲端報名資料。");
  }

  const registrations = await response.json();
  state.data.registrations = registrations.map((entry) => ({
    id: entry.id,
    proposalId: entry.proposal_id,
    eventTitle: entry.event_title,
    eventDate: entry.event_date,
    eventTime: entry.event_time,
    eventEndTime: entry.event_end_time || "",
    eventLocation: entry.event_location,
    memberName: entry.member_name,
    memberType: entry.member_type,
    email: entry.email,
    phone: entry.phone,
    note: entry.note || "",
    createdAt: entry.created_at,
  }));
  saveData();
}

function mapCloudProposal(entry) {
  return {
    id: entry.id,
    slug: entry.slug,
    teacherName: entry.teacher_name,
    teacherEmail: entry.teacher_email,
    title: entry.title,
    date: entry.event_date,
    time: entry.event_time,
    startTime: entry.event_time,
    endTime: entry.event_end_time || "",
    location: entry.location,
    capacity: entry.capacity,
    price: entry.price,
    category: entry.category,
    description: entry.description,
    notes: entry.notes || "",
    image: entry.image_url || "",
    status: entry.status,
    reviewedAt: entry.reviewed_at,
    createdAt: entry.created_at,
  };
}

async function syncCloudProposals(includeAll = false) {
  if (!cloudIsConfigured()) return;
  const accessToken = includeAll ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : "";
  const query = includeAll
    ? "select=*&order=created_at.desc"
    : "select=*&status=eq.approved&order=event_date.asc";
  const response = await fetch(
    `${CLOUD_CONFIG.supabaseUrl}/rest/v1/proposals?${query}`,
    { headers: cloudHeaders(accessToken) },
  );

  if (!response.ok) {
    throw new Error("無法讀取雲端活動資料。");
  }

  state.data.proposals = (await response.json()).map(mapCloudProposal);
  saveData();
}

async function syncCloudSettings() {
  if (!cloudIsConfigured()) return;
  const response = await fetch(
    `${CLOUD_CONFIG.supabaseUrl}/rest/v1/site_settings?select=value&key=eq.main&limit=1`,
    { headers: cloudHeaders() },
  );

  if (!response.ok) {
    return;
  }

  const rows = await response.json();
  if (!rows.length || !rows[0].value) return;

  state.data.settings = { ...DEFAULT_SETTINGS, ...rows[0].value };
  saveData();
}

async function saveCloudSettings() {
  if (!cloudIsConfigured()) return;
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    throw new Error("請先登入管理員帳號，再儲存雲端網站設定。");
  }

  const response = await fetch(
    `${CLOUD_CONFIG.supabaseUrl}/rest/v1/site_settings?on_conflict=key`,
    {
      method: "POST",
      headers: {
        ...cloudHeaders(accessToken),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        key: "main",
        value: state.data.settings,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("網站設定已存在本機，但雲端儲存失敗。");
  }
}

function applySettings() {
  const settings = state.data.settings;
  document.title = settings.siteName;
  $("#brandName").textContent = settings.siteName;
  $("#brandTagline").textContent = settings.tagline;
  $("#heroTitle").textContent = settings.heroTitle;
  $("#heroDescription").textContent = settings.heroDescription;
  document.documentElement.style.setProperty("--sage-dark", settings.primaryColor);
  $(".hero").style.background = settings.heroImage
    ? `linear-gradient(rgba(0, 62, 62, 0.88), rgba(0, 62, 62, 0.88)), url("${settings.heroImage}") center / cover`
    : "#003e3e";
}

function populateSettingsForm() {
  const form = $("#settingsForm");
  if (!form || state.route !== "settings") return;
  const settings = state.data.settings;
  form.elements.siteName.value = settings.siteName;
  form.elements.tagline.value = settings.tagline;
  form.elements.heroTitle.value = settings.heroTitle;
  form.elements.heroDescription.value = settings.heroDescription;
  form.elements.contactEmail.value = settings.contactEmail;
  form.elements.primaryColor.value = settings.primaryColor;
  form.elements.primaryColorText.value = settings.primaryColor.toUpperCase();
  form.elements.emailOpening.value = settings.emailOpening;
  form.elements.emailClosing.value = settings.emailClosing;
  form.elements.heroImageUrl.value =
    settings.heroImage.startsWith("data:") ? "" : settings.heroImage;
}

function renderPublicEvents() {
  const container = $("#publicEvents");
  const empty = $("#emptyPublicEvents");
  const events = approvedEvents();

  empty.hidden = events.length > 0;
  container.innerHTML = events
    .map(
      (event) => `
        <article class="event-card">
          <div class="event-image-wrap">
            <img class="event-image" src="${event.image || DEFAULT_IMAGE}" alt="${event.title}" />
          </div>
          <div class="event-body">
            <h3>${event.title}</h3>
            <div class="event-date">
              <span class="event-date-label">日期與時間</span>
              <strong>${formatEventDate(event.date, event.startTime || event.time, event.endTime)}</strong>
            </div>
            <div class="card-actions">
              <button class="event-detail-btn" data-register="${event.id}" type="button">
                了解完整資訊
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderStats() {
  const stats = [
    ["待審核提案", state.data.proposals.filter((item) => item.status === "pending").length],
    ["已開放活動", state.data.proposals.filter((item) => item.status === "approved").length],
    ["已退回提案", state.data.proposals.filter((item) => item.status === "rejected").length],
    ["總報名人次", state.data.registrations.length],
  ];

  $("#statsGrid").innerHTML = stats
    .map(
      ([label, value]) => `
        <div class="stat-card">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>
      `,
    )
    .join("");
}

function renderAllRegistrations() {
  const rows = $("#allRegistrationRows");
  const empty = $("#emptyRegistrationRows");
  if (!rows || !empty) return;

  const registrations = [...state.data.registrations].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  empty.hidden = registrations.length > 0;
  rows.innerHTML = registrations
    .map((entry) => {
      const proposal = state.data.proposals.find((item) => item.id === entry.proposalId);
      const eventTitle = entry.eventTitle || proposal?.title || "活動";
      const eventDate = entry.eventDate || proposal?.date || "";
      const eventTime = entry.eventTime || proposal?.startTime || proposal?.time || "";
      const eventEndTime = entry.eventEndTime || proposal?.endTime || "";
      const createdAt = new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(entry.createdAt));

      return `
        <tr>
          <td><strong>${eventTitle}</strong><span>${eventDate} ${eventTime}${eventEndTime ? `–${eventEndTime}` : ""}</span></td>
          <td><strong>${entry.memberName}</strong><span>${entry.note || "無備註"}</span></td>
          <td>${entry.email}<span>${entry.phone}</span></td>
          <td>${entry.memberType}</td>
          <td>${createdAt}</td>
        </tr>
      `;
    })
    .join("");
}

function renderProposalList() {
  const filter = $("#statusFilter").value;
  const proposals = state.data.proposals
    .filter((proposal) => filter === "all" || proposal.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  $("#proposalList").innerHTML =
    proposals
      .map(
        (proposal) => `
          <button class="admin-card ${
            proposal.id === state.selectedProposalId ? "is-selected" : ""
          }" data-select-proposal="${proposal.id}" type="button">
            <div class="status-line">
              <span class="pill ${proposal.status}">${statusLabels[proposal.status]}</span>
              <span>${proposal.teacherName}</span>
              <span>${formatEventDate(proposal.date, proposal.startTime || proposal.time, proposal.endTime)}</span>
            </div>
            <h3>${proposal.title}</h3>
            <p>${proposal.description.slice(0, 96)}${proposal.description.length > 96 ? "..." : ""}</p>
          </button>
        `,
      )
      .join("") ||
    `<div class="empty-state"><h3>沒有符合條件的提案</h3><p>調整狀態篩選，或請老師送出新的活動。</p></div>`;
}

function renderAdminDetail() {
  const detail = $("#adminDetail");
  const proposal = state.data.proposals.find((item) => item.id === state.selectedProposalId);

  if (!proposal) {
    detail.innerHTML = `
      <div class="empty-detail">
        <h3>選擇一個活動</h3>
        <p>你可以查看活動內容、報名連結與會員報名資料。</p>
      </div>
    `;
    return;
  }

  const entries = registrationsFor(proposal.id);
  const registerUrl = `${location.origin}${location.pathname}#register/${proposal.id}`;

  detail.innerHTML = `
    <img class="detail-image" src="${proposal.image || DEFAULT_IMAGE}" alt="${proposal.title}" />
    <div class="detail-body">
      <div class="status-line">
        <span class="pill ${proposal.status}">${statusLabels[proposal.status]}</span>
        <span>${proposal.category}</span>
        <span>${entries.length}/${proposal.capacity} 人報名</span>
      </div>
      <h2>${proposal.title}</h2>
      <div class="detail-meta">
        <span>${formatEventDate(proposal.date, proposal.startTime || proposal.time, proposal.endTime)}</span>
        <span>${proposal.location}</span>
        <span>${proposal.price}</span>
      </div>
      <p>${proposal.description}</p>
      ${proposal.notes ? `<p><strong>注意事項：</strong>${proposal.notes}</p>` : ""}
      <p><strong>提案老師：</strong>${proposal.teacherName} / ${proposal.teacherEmail}</p>
      ${
        proposal.status === "approved"
          ? `<div class="copy-box">
              <code>${registerUrl}</code>
              <button class="secondary-btn compact" data-copy-url="${proposal.id}" type="button">複製</button>
            </div>`
          : ""
      }
      <div class="detail-actions">
        <button class="secondary-btn compact" data-edit-proposal="${proposal.id}" type="button">編輯活動資訊</button>
        <button class="primary-btn compact" data-approve="${proposal.id}" type="button">核准並開放報名</button>
        <button class="danger-btn compact" data-reject="${proposal.id}" type="button">退回</button>
        <button class="secondary-btn compact" data-export="${proposal.id}" type="button">匯出名單 CSV</button>
      </div>
      <div class="registrations">
        ${
          entries.length
            ? entries
                .map(
                  (entry) => `
                  <div class="registration-row">
                    <div>
                      <strong>${entry.memberName}</strong>
                      <span>${entry.email} / ${entry.phone}</span>
                      <span>${entry.note || "無備註"}</span>
                    </div>
                    <span>${entry.memberType}</span>
                  </div>
                `,
                )
                .join("")
            : `<div class="empty-state"><h3>目前尚無報名</h3><p>活動核准後，會員填寫報名表就會出現在這裡。</p></div>`
        }
      </div>
    </div>
  `;
}

function renderRegistrationPage(proposalId) {
  const shell = $("#registrationShell");
  const proposal = state.data.proposals.find(
    (item) => item.id === proposalId && item.status === "approved",
  );

  if (!proposal) {
    shell.innerHTML = `
      <div class="empty-state">
        <h3>找不到可報名的活動</h3>
        <p>這個活動可能尚未核准，或報名頁連結已失效。</p>
        <button class="secondary-btn" data-route="home" type="button">回活動列表</button>
      </div>
    `;
    return;
  }

  const seats = Math.max(remainingSeats(proposal), 0);
  shell.innerHTML = `
    <button class="detail-back-btn" data-route="home" type="button">
      <span aria-hidden="true">←</span>
      回活動列表
    </button>
    <article class="register-card">
      <div class="register-hero">
        <img src="${proposal.image || DEFAULT_IMAGE}" alt="${proposal.title}" />
        <div class="register-copy">
          <p class="eyebrow">Event Details</p>
          <h1>${proposal.title}</h1>
          <div class="event-facts">
            <div class="event-fact">
              <span>活動日期</span>
              <strong>${formatFullDate(proposal.date)}</strong>
            </div>
            <div class="event-fact">
              <span>開始時間</span>
              <strong>${formatTimeOnly(proposal.startTime || proposal.time)}</strong>
            </div>
            <div class="event-fact">
              <span>結束時間</span>
              <strong>${formatTimeOnly(proposal.endTime)}</strong>
            </div>
            <div class="event-fact">
              <span>名額</span>
              <strong>${proposal.capacity} 位 <small>剩餘 ${seats} 位</small></strong>
            </div>
            <div class="event-fact event-fact-wide">
              <span>地點</span>
              <strong>${proposal.location || "地點未定"}</strong>
            </div>
            <div class="event-fact event-fact-wide">
              <span>費用</span>
              <strong>${proposal.price || "免費"}</strong>
            </div>
          </div>
          <section class="event-story">
            <p class="event-story-label">活動主軸</p>
            <p class="event-story-copy">${proposal.description}</p>
            ${proposal.notes ? `<p class="event-notes"><strong>注意事項</strong>${proposal.notes}</p>` : ""}
          </section>
          ${
            seats > 0
              ? `<div class="registration-heading">
                  <p class="eyebrow">Registration</p>
                  <h2>會員報名</h2>
                </div>
                <form id="registrationForm" class="form-grid" novalidate>
                  <label>
                    會員姓名
                    <input name="memberName" autocomplete="name" required />
                  </label>
                  <label>
                    會員身份
                    <select name="memberType" required>
                      <option>正式會員</option>
                      <option>非會員</option>
                    </select>
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" autocomplete="email" required />
                  </label>
                  <label>
                    手機
                    <input name="phone" autocomplete="tel" required />
                  </label>
                  <label class="wide">
                    備註
                    <textarea name="note" rows="3" placeholder="飲食、同行人、其他需求"></textarea>
                  </label>
                  <div class="wide form-footer">
                    <p>
                      送出後將收到報名成功信，並於兩天後、活動前三天及活動前一天收到提醒。
                    </p>
                    <button class="primary-btn" type="submit">確認報名</button>
                  </div>
                </form>`
              : `<div class="empty-state"><h3>本活動已額滿</h3><p>你可以回活動列表查看其他開放報名的活動。</p></div>`
          }
        </div>
      </div>
    </article>
  `;
}

function readImageAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function handleProposalSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const image = await readImageAsDataUrl(formData.get("image"));
  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");

  if (endTime <= startTime) {
    showToast("結束時間必須晚於開始時間。");
    form.elements.endTime.focus();
    return;
  }

  const proposal = {
    id: createId("proposal"),
    slug: createSlug(formData.get("title")),
    teacherName: formData.get("teacherName").trim(),
    teacherEmail: formData.get("teacherEmail").trim(),
    title: formData.get("title").trim(),
    date: formData.get("date"),
    time: startTime,
    startTime,
    endTime,
    location: formData.get("location").trim(),
    capacity: Number(formData.get("capacity")),
    price: formData.get("price").trim(),
    category: formData.get("category"),
    description: formData.get("description").trim(),
    notes: formData.get("notes").trim(),
    image,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (cloudIsConfigured()) {
    try {
      const response = await fetch(
        `${CLOUD_CONFIG.supabaseUrl}/functions/v1/submit-proposal`,
        {
          method: "POST",
          headers: cloudHeaders(),
          body: JSON.stringify(proposal),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "雲端提案送出失敗");
      }
      proposal.image = result.imageUrl || proposal.image;
    } catch (error) {
      showToast(`提案尚未送出：${error.message}`);
      return;
    }
  }

  state.data.proposals.unshift(proposal);
  state.selectedProposalId = proposal.id;
  saveData();
  form.reset();
  $("#imagePreview").style.display = "none";
  showToast("活動提案已送出，請等待審核。");
  setRoute("home");
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const uploadedImage = await readImageAsDataUrl(formData.get("heroImageFile"));
  const typedColor = formData.get("primaryColorText").trim();
  const color = /^#[0-9a-f]{6}$/i.test(typedColor)
    ? typedColor
    : formData.get("primaryColor");

  state.data.settings = {
    siteName: formData.get("siteName").trim(),
    tagline: formData.get("tagline").trim(),
    heroTitle: formData.get("heroTitle").trim(),
    heroDescription: formData.get("heroDescription").trim(),
    contactEmail: formData.get("contactEmail").trim(),
    primaryColor: color.toLowerCase(),
    heroImage:
      uploadedImage ||
      formData.get("heroImageUrl").trim() ||
      state.data.settings.heroImage ||
      DEFAULT_HERO_IMAGE,
    emailOpening: formData.get("emailOpening").trim(),
    emailClosing: formData.get("emailClosing").trim(),
  };

  saveData();
  try {
    await saveCloudSettings();
    showToast("網站設定與 Email 通知信已儲存並套用。");
  } catch (error) {
    showToast(error.message || "網站設定已存在本機，但雲端儲存失敗。");
  }
  applySettings();
  populateSettingsForm();
  form.elements.heroImageFile.value = "";
}

function resetSettings() {
  state.data.settings = { ...DEFAULT_SETTINGS };
  saveData();
  render();
  showToast("已恢復預設網站內容。");
}

async function handleRegistrationSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    showToast("請先填寫會員姓名、Email、手機等必填欄位。");
    return;
  }

  const proposal = state.data.proposals.find((item) => item.id === state.registrationEventId);
  if (!proposal || remainingSeats(proposal) <= 0) {
    showToast("這場活動目前無法報名。");
    return;
  }

  const settings = state.data.settings;
  const formData = new FormData(form);
  const registration = {
    id: createId("registration"),
    proposalId: proposal.id,
    eventTitle: proposal.title,
    eventDate: proposal.date,
    eventTime: proposal.startTime || proposal.time,
    eventEndTime: proposal.endTime || "",
    eventLocation: proposal.location,
    eventCapacity: proposal.capacity,
    eventPrice: proposal.price,
    memberName: formData.get("memberName").trim(),
    memberType: formData.get("memberType"),
    email: formData.get("email").trim(),
    phone: formData.get("phone").trim(),
    note: formData.get("note").trim(),
    createdAt: new Date().toISOString(),
  };
  let notificationSent = false;

  if (cloudIsConfigured()) {
    try {
      const response = await fetch(
        `${CLOUD_CONFIG.supabaseUrl}/functions/v1/submit-registration`,
        {
          method: "POST",
          headers: cloudHeaders(),
          body: JSON.stringify({
            proposalId: proposal.id,
            eventTitle: proposal.title,
            eventDate: proposal.date,
            eventTime: proposal.startTime || proposal.time,
            eventEndTime: proposal.endTime || "",
            eventLocation: proposal.location,
            eventCapacity: proposal.capacity,
            eventPrice: proposal.price,
            emailOpening: settings.emailOpening,
            emailClosing: settings.emailClosing,
            memberName: registration.memberName,
            memberType: registration.memberType,
            email: registration.email,
            phone: registration.phone,
            note: registration.note,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "雲端報名失敗");
      }
      registration.id = result.registrationId || registration.id;
      notificationSent = result.notificationSent === true;
    } catch (error) {
      showToast(`報名尚未送出：${error.message}`);
      return;
    }
  }

  state.data.registrations.push(registration);

  saveData();
  showRegistrationSuccess();
  showToast(
    notificationSent
      ? "報名成功，請前往 email 收信確認。"
      : "報名成功，資料已收到，系統會寄出 Email 通知。",
  );
  form.reset();
}

async function updateProposalStatus(id, status) {
  const proposal = state.data.proposals.find((item) => item.id === id);
  if (!proposal) return;

  if (cloudIsConfigured()) {
    const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    try {
      const response = await fetch(
        `${CLOUD_CONFIG.supabaseUrl}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            ...cloudHeaders(accessToken),
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status,
            reviewed_at: new Date().toISOString(),
          }),
        },
      );
      if (!response.ok) {
        throw new Error("雲端活動狀態更新失敗。");
      }
    } catch (error) {
      showToast(error.message || "活動狀態更新失敗。");
      return;
    }
  }

  proposal.status = status;
  proposal.reviewedAt = new Date().toISOString();
  saveData();
  showToast(status === "approved" ? "活動已核准並開放報名。" : "提案已退回。");
  render();
}

function openEventEditor(id) {
  const proposal = state.data.proposals.find((item) => item.id === id);
  if (!proposal) return;

  const form = $("#editEventForm");
  form.elements.proposalId.value = proposal.id;
  form.elements.title.value = proposal.title;
  form.elements.date.value = proposal.date;
  form.elements.category.value = proposal.category;
  form.elements.startTime.value = (proposal.startTime || proposal.time || "").slice(0, 5);
  form.elements.endTime.value = (proposal.endTime || "").slice(0, 5);
  form.elements.location.value = proposal.location;
  form.elements.capacity.value = proposal.capacity;
  form.elements.price.value = proposal.price;
  form.elements.description.value = proposal.description;
  form.elements.notes.value = proposal.notes || "";
  $("#editEventError").textContent = "";
  $("#editEventOverlay").hidden = false;
  document.body.classList.add("modal-open");
}

function closeEventEditor() {
  $("#editEventOverlay").hidden = true;
  document.body.classList.remove("modal-open");
}

async function handleEventEditSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const id = formData.get("proposalId");
  const proposal = state.data.proposals.find((item) => item.id === id);
  if (!proposal) return;

  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");
  if (endTime <= startTime) {
    $("#editEventError").textContent = "結束時間必須晚於開始時間。";
    return;
  }

  const updates = {
    title: formData.get("title").trim(),
    date: formData.get("date"),
    category: formData.get("category"),
    startTime,
    time: startTime,
    endTime,
    location: formData.get("location").trim(),
    capacity: Number(formData.get("capacity")),
    price: formData.get("price").trim(),
    description: formData.get("description").trim(),
    notes: formData.get("notes").trim(),
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "儲存中...";
  $("#editEventError").textContent = "";

  try {
    if (cloudIsConfigured()) {
      const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
      const response = await fetch(
        `${CLOUD_CONFIG.supabaseUrl}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            ...cloudHeaders(accessToken),
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            title: updates.title,
            event_date: updates.date,
            event_time: updates.startTime,
            event_end_time: updates.endTime,
            location: updates.location,
            capacity: updates.capacity,
            price: updates.price,
            category: updates.category,
            description: updates.description,
            notes: updates.notes,
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "雲端活動資訊更新失敗。");
      }
    }

    Object.assign(proposal, updates);
    saveData();
    closeEventEditor();
    render();
    showToast("活動資訊已更新。");
  } catch (error) {
    $("#editEventError").textContent = error.message || "活動資訊更新失敗。";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "儲存活動資訊";
  }
}

function exportCsv(proposalId) {
  const proposal = state.data.proposals.find((item) => item.id === proposalId);
  const entries = registrationsFor(proposalId);
  const header = ["活動", "姓名", "會員身份", "Email", "手機", "備註", "報名時間"];
  const rows = entries.map((entry) => [
    proposal.title,
    entry.memberName,
    entry.memberType,
    entry.email,
    entry.phone,
    entry.note,
    entry.createdAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${proposal.slug || proposal.id}-registrations.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;

  if (target.dataset.route) {
    event.preventDefault();
    setRoute(target.dataset.route);
  }

  if (target.dataset.register) {
    setRoute("register", target.dataset.register);
  }

  if (target.dataset.selectProposal) {
    state.selectedProposalId = target.dataset.selectProposal;
    render();
  }

  if (target.dataset.approve) updateProposalStatus(target.dataset.approve, "approved");
  if (target.dataset.reject) updateProposalStatus(target.dataset.reject, "rejected");
  if (target.dataset.editProposal) openEventEditor(target.dataset.editProposal);
  if (target.dataset.export) exportCsv(target.dataset.export);
  if (target.hasAttribute("data-close-login")) closeLogin();
  if (target.hasAttribute("data-close-event-editor")) closeEventEditor();
  if (target.hasAttribute("data-close-registration-success")) closeRegistrationSuccess();
  if (target.hasAttribute("data-logout")) logout();

  if (target.dataset.copyUrl) {
    const url = `${location.origin}${location.pathname}#register/${target.dataset.copyUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("報名連結已複製。");
    } catch {
      showToast("目前瀏覽器不允許自動複製，請手動選取連結。");
    }
  }
});

$("#proposalForm").addEventListener("submit", handleProposalSubmit);
$("#loginForm").addEventListener("submit", handleLogin);
$("#passwordForm").addEventListener("submit", handlePasswordSetup);
$("#settingsForm").addEventListener("submit", handleSettingsSubmit);
$("#editEventForm").addEventListener("submit", handleEventEditSubmit);
$("#statusFilter").addEventListener("change", renderProposalList);
$("#resetSettingsButton").addEventListener("click", resetSettings);
$("#refreshCloudButton").addEventListener("click", async () => {
  if (!cloudIsConfigured()) {
    showToast("尚未連接 Supabase，現在顯示的是本機資料。");
    return;
  }

  try {
    await syncCloudProposals(true);
    await syncCloudRegistrations();
    render();
    showToast("雲端報名資料已更新。");
  } catch (error) {
    showToast(error.message || "更新失敗。");
  }
});

$("#settingsForm").elements.primaryColor.addEventListener("input", (event) => {
  $("#settingsForm").elements.primaryColorText.value = event.target.value.toUpperCase();
});

$("#settingsForm").elements.primaryColorText.addEventListener("input", (event) => {
  if (/^#[0-9a-f]{6}$/i.test(event.target.value)) {
    $("#settingsForm").elements.primaryColor.value = event.target.value;
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "registrationForm") {
    handleRegistrationSubmit(event);
  }
});

$("#proposalImage").addEventListener("change", async (event) => {
  const preview = $("#imagePreview");
  const image = await readImageAsDataUrl(event.target.files[0]);
  preview.src = image;
  preview.style.display = image ? "block" : "none";
});

function bootFromHash() {
  const accessToken = recoveryAccessToken();
  if (accessToken) {
    openPasswordSetup(accessToken);
    render();
    return;
  }

  const hash = location.hash.replace("#", "");
  if (hash.startsWith("register/")) {
    setRoute("register", hash.split("/")[1]);
    return;
  }

  if (["home", "proposal", "admin", "settings"].includes(hash)) {
    setRoute(hash);
    return;
  }

  render();
}

window.addEventListener("hashchange", bootFromHash);
bootFromHash();

if (cloudIsConfigured()) {
  Promise.all([syncCloudSettings(), syncCloudProposals(false)])
    .then(render)
    .catch(() => showToast("目前無法載入雲端網站資料。"));
}
