const app = document.querySelector("#app");
const STORAGE_KEY = "qyntra-workspace-v1";
const MAX_IMAGE_BYTES = 900_000;
const MAX_DOCUMENT_BYTES = 500_000;
const MAX_DOCUMENT_FILES = 3;

const initialData = {
  projects: [
    { id: "PRJ-001", name: "Qyntra Web", description: "Web application quality and release testing", color: "violet" },
    { id: "PRJ-002", name: "Qyntra Mobile", description: "Mobile app usability and regression testing", color: "coral" },
  ],
  testCases: [
    { id: "TC-001", projectId: "PRJ-001", title: "Verify successful checkout", module: "Checkout", priority: "High", status: "Passed", preconditions: "User has a valid account and an item in the cart.", steps: ["Sign in", "Open the cart", "Complete checkout"], testData: "Valid account and payment method", expectedResult: "Order confirmation is shown.", actualResult: "Order confirmation is shown.", attachments: [] },
    { id: "TC-002", projectId: "PRJ-001", title: "Reject invalid card details", module: "Payments", priority: "High", status: "Failed", preconditions: "A product is ready for checkout.", steps: ["Enter an invalid card number", "Submit payment"], testData: "Card number: 0000", expectedResult: "Payment is rejected with a clear validation message.", actualResult: "Payment error is shown.", attachments: [] },
    { id: "TC-003", projectId: "PRJ-001", title: "Reset password with email", module: "Authentication", priority: "Medium", status: "Passed", preconditions: "A registered email account exists.", steps: ["Open forgot password", "Submit the registered email"], testData: "Registered email", expectedResult: "A reset link confirmation is shown.", actualResult: "A reset link confirmation is shown.", attachments: [] },
    { id: "TC-004", projectId: "PRJ-001", title: "Update profile information", module: "Profile", priority: "Low", status: "Pending", preconditions: "User is signed in.", steps: ["Edit the profile name", "Save changes"], testData: "Profile name: Alex", expectedResult: "The new profile name is saved.", actualResult: "", attachments: [] },
    { id: "TC-005", projectId: "PRJ-001", title: "Keep cart after sign in", module: "Checkout", priority: "Medium", status: "Passed", preconditions: "Cart contains one product.", steps: ["Sign out", "Sign back in", "Open the cart"], testData: "One saved product", expectedResult: "The product remains in the cart.", actualResult: "The product remains in the cart.", attachments: [] },
    { id: "TC-006", projectId: "PRJ-001", title: "Sign out from account", module: "Authentication", priority: "Low", status: "Passed", preconditions: "User is signed in.", steps: ["Open the account menu", "Select sign out"], testData: "Signed-in user", expectedResult: "The user returns to the sign-in page.", actualResult: "The user returns to the sign-in page.", attachments: [] },
  ],
  bugs: [
    { id: "BUG-024", projectId: "PRJ-001", title: "Checkout button unresponsive", module: "Checkout", severity: "High", assignee: "Developer", status: "Open", description: "The checkout button does not respond after a valid address is entered.", stepsToReproduce: "1. Add an item to cart\n2. Enter a valid address\n3. Select checkout", expectedResult: "Checkout continues to payment.", actualResult: "The button does not respond.", attachments: [] },
    { id: "BUG-021", projectId: "PRJ-001", title: "Session expires too early", module: "Authentication", severity: "High", assignee: "Developer", status: "In Progress", description: "The session expires before the configured timeout.", stepsToReproduce: "1. Sign in\n2. Wait less than the configured timeout", expectedResult: "The user remains signed in.", actualResult: "The session expires early.", attachments: [] },
    { id: "BUG-018", projectId: "PRJ-001", title: "Profile image not updating", module: "Profile", severity: "Medium", assignee: "Developer", status: "Fixed", description: "The profile image stays unchanged after saving.", stepsToReproduce: "1. Upload a new profile image\n2. Save the profile", expectedResult: "The new image appears.", actualResult: "The previous image remains.", attachments: [] },
    { id: "BUG-015", projectId: "PRJ-001", title: "Error message is unclear", module: "Payments", severity: "Low", assignee: "QA Test Engineer", status: "Open", description: "Payment failure message does not explain what to do next.", stepsToReproduce: "1. Submit a declined payment", expectedResult: "A useful recovery action is shown.", actualResult: "A generic error is shown.", attachments: [] },
  ],
  testPlans: [
    { id: "PLAN-001", projectId: "PRJ-001", title: "Checkout release regression", scope: "Checkout and payment flows", date: "2026-10-08" },
  ],
  notes: [],
};

function loadWorkspaceData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(initialData);
  const parsed = JSON.parse(saved);
  if (!parsed || !Array.isArray(parsed.testCases) || !Array.isArray(parsed.bugs) ||
      !Array.isArray(parsed.testPlans) || !Array.isArray(parsed.notes)) {
    throw new Error("Saved Qyntra workspace data is invalid.");
  }

  if (!Array.isArray(parsed.projects) || parsed.projects.length === 0) parsed.projects = structuredClone(initialData.projects);
  for (const collection of ["testCases", "bugs", "testPlans", "notes"]) {
    for (const item of parsed[collection]) item.projectId ||= parsed.projects[0].id;
  }
  for (const testCase of parsed.testCases) {
    testCase.featureName ||= testCase.module || "General";
    testCase.module ||= testCase.featureName;
    testCase.preconditions ||= "";
    testCase.testData ||= "";
    testCase.steps ||= [];
    testCase.expectedResult ||= "";
    testCase.bugDescription ||= "";
    testCase.testerComments ||= "";
    testCase.testResult ||= testCase.status || "Not Run";
    testCase.status ||= testCase.testResult;
    testCase.developerComments ||= "";
    testCase.fixStatusIT1 ||= "";
    testCase.testResultIT2 ||= "";
    testCase.fixStatusIT2 ||= "";
    testCase.testResultIT3 ||= "";
    testCase.attachments ||= [];
    testCase.documents ||= [];
  }
  for (const bug of parsed.bugs) {
    if (bug.assignee === "QA Engineer") bug.assignee = "QA Test Engineer";
    bug.developerComments ||= "";
    bug.fixStatus ||= "Not started";
  }
  return parsed;
}

const state = {
  username: "",
  section: "Overview",
  testCaseMode: "create",
  bugMode: "create",
  aiAttachments: [],
  aiDrafts: [],
  loadingTimer: null,
  activeProjectId: "",
  modal: "",
  editingTestCaseId: "",
  workspace: loadWorkspaceData(),
};

state.activeProjectId = state.workspace.projects[0].id;
const navItems = ["Overview", "Test Cases", "Bugs", "Assigned Bugs", "Test Plans", "Notes", "Projects"];

function projectItems(collection) {
  return state.workspace[collection].filter((item) => item.projectId === state.activeProjectId);
}

function activeProject() {
  return state.workspace.projects.find((project) => project.id === state.activeProjectId) || state.workspace.projects[0];
}

function projectOptions() {
  return state.workspace.projects.map((project) => `<option value="${escapeHtml(project.id)}" ${project.id === state.activeProjectId ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("");
}

function saveWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function icon(name) {
  const symbols = { home: "⌂", cases: "▤", bugs: "🐞", queue: "⌘", plans: "◷", notes: "▧", plus: "+", arrow: "→" };
  return symbols[name] || "•";
}

function brand() {
  return `<a class="brand" href="#" aria-label="Qyntra home"><span class="brand-mark">Q</span><span>Qyntra</span></a>`;
}

function renderLogin() {
  app.innerHTML = `
    <section class="login-page">
      <aside class="login-aside">
        ${brand()}
        <div class="aside-copy">
          <p class="eyebrow">YOUR QUALITY WORKSPACE</p>
          <h1>Test with care.<br /><span>Ship with confidence.</span></h1>
          <p>Plan test cases, catch bugs early, and keep every release moving forward.</p>
          <div class="workflow-preview"><span>Plan</span><b>→</b><span>Test</span><b>→</b><span>Fix</span><b>→</b><span>Ship</span></div>
        </div>
        <p class="aside-footer">One clear view for your whole QA workflow.</p>
      </aside>
      <section class="login-main">
        <div class="login-card">
          ${brand()}
          <span class="login-kicker">QA ENGINEER SIGN IN</span>
          <h2>Welcome to Qyntra</h2>
          <p class="login-intro">Sign in to open your QA test engineering dashboard.</p>
          <form id="login-form">
            <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" placeholder="Enter your username" required /></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required /></div>
            <p class="login-error" id="login-error" aria-live="polite"></p>
            <button class="primary-button login-submit" type="submit">Sign in to Qyntra <span>→</span></button>
          </form>
          <p class="login-footnote">QA demo workspace · Any username and password</p>
          <a class="developer-login-link" href="developer.html">Developer sign in <span>→</span></a>
        </div>
      </section>
    </section>
  `;

  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (!username || !password) {
      document.querySelector("#login-error").textContent = "Enter both your username and password to continue.";
      return;
    }
    state.username = username;
    state.modal = "";
    if (!localStorage.getItem(STORAGE_KEY)) saveWorkspace();
    renderRunner();
  });
}

function renderRunner() {
  app.innerHTML = `
    <section class="runner-page" aria-live="polite">
      ${brand()}
      <div class="runner-card">
        <span class="runner-label">QA TEST ENGINEER WORKSPACE</span>
        <h1>Getting your workspace ready</h1>
        <p>Warming up the test lab and preparing today's dashboard.</p>
        <div class="runway"><span class="runway-line"></span><span class="runner-person" aria-label="Loading">🏃</span><span class="finish-flag">⚑</span></div>
        <div class="runner-progress"><span></span></div>
        <span class="runner-caption">Opening your dashboard...</span>
      </div>
      <span class="runner-footer">Qyntra · Quality starts with a good test</span>
    </section>
  `;
  window.clearTimeout(state.loadingTimer);
  state.loadingTimer = window.setTimeout(() => {
    state.section = "Overview";
    renderDashboard();
  }, 5000);
}

function counts() {
  const bugs = projectItems("bugs");
  return {
    testCases: projectItems("testCases").length,
    bugs: bugs.length,
    fixed: bugs.filter((bug) => bug.status === "Fixed").length,
    pending: bugs.filter((bug) => bug.status !== "Fixed").length,
    developerQueue: bugs.filter((bug) => bug.assignee === "Developer" && bug.status !== "Fixed").length,
  };
}

function renderDashboard() {
  const totals = counts();
  app.innerHTML = `
    <section class="dashboard">
      <div class="dashboard-layout">
        <aside class="sidebar">
          ${brand()}
          <nav class="nav-list" aria-label="Main navigation">
            ${navItems.map((item) => `
              <button class="nav-item ${state.section === item ? "active" : ""}" data-section="${item}" type="button">
                <span class="nav-icon">${iconForSection(item)}</span><span>${item}</span>
                ${item === "Bugs" ? `<span class="nav-count">${totals.pending}</span>` : ""}
                ${item === "Assigned Bugs" ? `<span class="nav-count queue-count">${totals.developerQueue}</span>` : ""}
              </button>`).join("")}
          </nav>
          <div class="sidebar-tip"><span>✦</span><strong>Small steps, better releases.</strong><p>Every test helps your team ship with confidence.</p></div>
          <div class="sidebar-bottom">
            <div class="sidebar-user"><div class="avatar">${escapeHtml(initials(state.username))}</div><div class="user-copy"><strong>${escapeHtml(state.username)}</strong><span>QA Test Engineer</span></div></div>
            <button class="signout-button" id="sign-out" type="button">Sign out</button>
          </div>
        </aside>
        <div class="dashboard-main">
          <header class="topbar">
            <div class="breadcrumbs">${brand()} <span>/</span> <strong>${escapeHtml(state.section)}</strong></div>
            <div class="topbar-right"><select class="topbar-project-select" aria-label="Filter by project" data-project-select>${projectOptions()}</select><span class="topbar-date">${new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span><div class="avatar">${escapeHtml(initials(state.username))}</div></div>
          </header>
          <main class="dashboard-content">
            ${state.section === "Overview" ? renderOverview(totals) : renderSection(state.section)}
          </main>
        </div>
      </div>
    </section>
    ${renderEntryModal()}
  `;

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.section = button.dataset.section;
      renderDashboard();
    });
  });
  document.querySelector("#sign-out").addEventListener("click", () => {
    window.clearTimeout(state.loadingTimer);
    state.username = "";
    state.modal = "";
    renderLogin();
  });
  document.querySelectorAll("[data-project-select]").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.activeProjectId = event.currentTarget.value;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-open-project]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProjectId = button.dataset.openProject;
      state.section = "Overview";
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      state.section = button.dataset.action;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingTestCaseId = "";
      state.modal = button.dataset.openModal;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-edit-test-case]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingTestCaseId = button.dataset.editTestCase;
      state.modal = "edit-case";
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.modal === "case" || state.section === "Test Cases") state.testCaseMode = button.dataset.mode;
      if (state.modal === "bug" || state.section === "Bugs") state.bugMode = button.dataset.mode;
      renderDashboard();
    });
  });
  document.querySelectorAll("form[data-form]").forEach((form) => {
    form.addEventListener("submit", handleFormSubmit);
  });
  document.querySelectorAll("[data-bug-status]").forEach((select) => {
    select.addEventListener("change", () => updateBugStatus(select.dataset.bugStatus, select.value));
  });
  document.querySelectorAll("[data-image-input]").forEach((input) => {
    input.addEventListener("change", () => showImagePreviews(input));
  });
  document.querySelectorAll("[data-document-input]").forEach((input) => {
    input.addEventListener("change", () => showDocumentPreviews(input));
  });
  const aiButton = document.querySelector("#generate-ai-cases");
  if (aiButton) aiButton.addEventListener("click", generateAiDrafts);
  const entryDialog = document.querySelector("#entry-dialog");
  if (entryDialog) {
    entryDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      state.modal = "";
      renderDashboard();
    });
    entryDialog.addEventListener("click", (event) => {
      if (event.target === entryDialog) {
        state.modal = "";
        renderDashboard();
      }
    });
    entryDialog.querySelector("[data-close-modal]").addEventListener("click", () => {
      state.modal = "";
      renderDashboard();
    });
    entryDialog.showModal();
  }
}

function renderOverview(totals) {
  const project = activeProject();
  return `
    <section class="dashboard-hero">
      <div><span class="hero-kicker">QA TEST ENGINEER · ${escapeHtml(project.name).toUpperCase()}</span><h1>Welcome to Qyntra, ${escapeHtml(state.username)} <span class="wave">✦</span></h1><p>${escapeHtml(project.description || "Your project quality snapshot is ready.")}</p></div>
      <div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="hero-check">✓</span></div>
    </section>
    <div class="overview-toolbar"><div><h2>Project overview</h2><p>Keep an eye on the work that moves quality forward.</p></div><button class="primary-button" data-open-modal="case" type="button">+ Add test case</button></div>
    <section class="stat-grid" aria-label="Workspace totals">
      ${statCard("Total test cases", totals.testCases, "▤", "In your test library", "violet")}
      ${statCard("Total bugs", totals.bugs, "🐞", "All reported issues", "coral")}
      ${statCard("Total fixed", totals.fixed, "✓", "Resolved by the team", "green")}
      ${statCard("Pending", totals.pending, "◷", "Still needs attention", "amber")}
    </section>
    <div class="quick-actions">
      ${quickAction("case", "▤", "Add a test case", "Create, import, or draft with AI", "violet")}
      ${quickAction("bug", "♟", "Report a bug", "Add one or report several", "coral")}
      ${quickAction("plan", "◷", "Create a test plan", "Organize your next test cycle", "blue")}
      ${quickAction("note", "▧", "Add a team note", "Save a useful reminder", "green")}
    </div>
    <div class="dashboard-columns">
      ${recentBugsCard()}
      ${developerQueueCard()}
    </div>
    <div class="bottom-grid">
      ${testCasesCard(true)}
      ${testPlansCard(true)}
    </div>
  `;
}

function statCard(label, value, symbol, note, tone) {
  return `<article class="stat-card ${tone}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${symbol}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div><div class="stat-accent"></div></article>`;
}

function quickAction(section, symbol, title, detail, tone) {
  return `<button class="quick-action ${tone}" data-open-modal="${section}" type="button"><span class="quick-icon">${symbol}</span><span class="quick-copy"><strong>${title}</strong><small>${detail}</small></span><span class="quick-arrow">→</span></button>`;
}

function recentBugsCard() {
  const bugs = projectItems("bugs").slice(0, 4);
  return `
    <section class="content-card">
      <div class="card-heading"><div><h2>Recent bugs</h2><p>New issues and fixes from your team</p></div><button class="card-link" data-action="Bugs" type="button">All bugs →</button></div>
      ${bugs.length ? `<div class="bug-list">${bugs.map((bug) => bugRow(bug, false)).join("")}</div>` : emptyState("No bugs reported yet.")}
    </section>
  `;
}

function developerQueueCard() {
  const bugs = projectItems("bugs").filter((bug) => bug.assignee === "Developer" && bug.status !== "Fixed").slice(0, 3);
  return `
    <section class="content-card queue-card">
      <div class="card-heading"><div><h2><span class="heading-bug">⌘</span> Assigned bugs</h2><p>Issues assigned for developer follow-up</p></div><button class="card-link" data-action="Assigned Bugs" type="button">Open list →</button></div>
      ${bugs.length ? `<div class="bug-list">${bugs.map((bug) => bugRow(bug, false)).join("")}</div>` : emptyState("No bugs are waiting for a developer.")}
    </section>
  `;
}

function attachmentStrip(attachments = []) {
  if (!attachments.length) return "";
  return `<span class="attachment-count">${attachments.filter((item) => item.type?.startsWith("image/") || item.data?.startsWith("data:image/")).map((item) => `<a class="attachment-thumb" href="${escapeHtml(item.data)}" target="_blank" rel="noopener" title="${escapeHtml(item.name)}"><img src="${escapeHtml(item.data)}" alt="${escapeHtml(item.name)}" /></a>`).join("")}</span>`;
}

function documentLinks(documents = []) {
  if (!documents.length) return `<span class="document-empty">No report documents uploaded.</span>`;
  return `<div class="report-document-list">${documents.map((document) => {
    const extension = document.name.split(".").pop().toLowerCase();
    const canView = ["pdf", "csv", "txt"].includes(extension);
    const badge = extension.toUpperCase();
    return `<a class="report-document-link" href="${escapeHtml(document.data)}" ${canView ? 'target="_blank" rel="noopener"' : `download="${escapeHtml(document.name)}"`} title="${canView ? "Open" : "Download"} ${escapeHtml(document.name)}"><span aria-hidden="true">${escapeHtml(badge)}</span><strong>${escapeHtml(document.name)}</strong><small>${canView ? "View" : "Download"}</small></a>`;
  }).join("")}</div>`;
}

function bugRow(bug, editable) {
  return `
    <article class="bug-row">
      <span class="bug-symbol" aria-hidden="true">🐞</span>
      <div class="bug-copy"><strong>${escapeHtml(bug.title)}</strong><span>${escapeHtml(bug.id)} · ${escapeHtml(bug.module)} · ${escapeHtml(bug.assignee)} ${attachmentStrip(bug.attachments)}</span><details class="record-details"><summary>View report</summary><p><b>Description:</b> ${escapeHtml(bug.description || "Not provided")}</p><p><b>Steps:</b> ${escapeHtml(bug.stepsToReproduce || "Not provided")}</p><p><b>Expected:</b> ${escapeHtml(bug.expectedResult || "Not provided")}</p><p><b>Actual:</b> ${escapeHtml(bug.actualResult || "Not provided")}</p><p><b>Developer fix status:</b> ${escapeHtml(bug.fixStatus || "Not started")}</p><p><b>Developer comments:</b> ${escapeHtml(bug.developerComments || "Not provided")}</p></details></div>
      <div class="bug-trailing"><span class="severity ${bug.severity.toLowerCase()}">${escapeHtml(bug.severity)}</span>${editable ? `<select class="inline-status" data-bug-status="${escapeHtml(bug.id)}" aria-label="Update ${escapeHtml(bug.id)} status">${["Open", "In Progress", "Fixed"].map((status) => `<option ${bug.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>` : `<span class="bug-status ${statusClass(bug.status)}">${escapeHtml(bug.status)}</span>`}</div>
    </article>
  `;
}

function testCasesCard(compact = false) {
  const allCases = projectItems("testCases");
  const cases = compact ? allCases.slice(0, 4) : allCases;
  return `
    <section class="content-card">
      <div class="card-heading"><div><h2>Test cases</h2><p>${allCases.length} scenarios in ${escapeHtml(activeProject().name)}</p></div>${compact ? `<button class="card-link" data-action="Test Cases" type="button">View all →</button>` : ""}</div>
      ${cases.length ? `<div class="data-list">${cases.map((testCase) => {
        const testResult = testCase.testResult || testCase.status || "Not Run";
        const steps = Array.isArray(testCase.steps) ? testCase.steps.join("\n") : testCase.steps || "";
        const detailFields = [
          ["Test Case No", testCase.id],
          ["Feature Name", testCase.featureName || testCase.module],
          ["TestCase Name", testCase.title],
          ["Prerequisites", testCase.preconditions],
          ["Test Data", testCase.testData],
          ["Steps", steps],
          ["Expected Result", testCase.expectedResult],
          ["Bug Description", testCase.bugDescription],
          ["Tester Comments", testCase.testerComments],
          ["Test Result", testResult],
          ["Developer Comments", testCase.developerComments],
          ["Fix status IT1", testCase.fixStatusIT1],
          ["Test Result IT2", testCase.testResultIT2],
          ["Fix status IT2", testCase.fixStatusIT2],
          ["Test Result IT3", testCase.testResultIT3],
        ];
        return `<article class="data-row"><div class="data-icon case-icon">TC</div><div class="data-copy"><strong>${escapeHtml(testCase.title)}</strong><span>${escapeHtml(testCase.id)} · ${escapeHtml(testCase.featureName || testCase.module)} · ${escapeHtml(testCase.priority)} priority ${attachmentStrip(testCase.attachments)}</span><details class="record-details test-case-details"><summary>View full test case &amp; documents</summary><div class="test-case-detail-grid">${detailFields.map(([label, value]) => `<div class="test-case-detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div><section class="report-documents"><h3>Uploaded report documents</h3>${documentLinks(testCase.documents || [])}</section><button class="secondary-button edit-report-button" type="button" data-edit-test-case="${escapeHtml(testCase.id)}">Edit this test report</button></details></div><span class="status-pill ${statusClass(testResult)}">${escapeHtml(testResult)}</span></article>`;
      }).join("")}</div>` : emptyState("Add your first test case to start building coverage.")}
    </section>
  `;
}

function testPlansCard(compact = false) {
  const allPlans = projectItems("testPlans");
  const plans = compact ? allPlans.slice(0, 3) : allPlans;
  return `
    <section class="content-card">
      <div class="card-heading"><div><h2>Test plans</h2><p>${allPlans.length} plans in ${escapeHtml(activeProject().name)}</p></div>${compact ? `<button class="card-link" data-action="Test Plans" type="button">View all →</button>` : ""}</div>
      ${plans.length ? `<div class="data-list">${plans.map((plan) => `<div class="data-row"><div class="data-icon plan-icon">◷</div><div class="data-copy"><strong>${escapeHtml(plan.title)}</strong><span>${escapeHtml(plan.id)} · ${escapeHtml(plan.scope)}</span></div><span class="date-tag">${escapeHtml(plan.date)}</span></div>`).join("")}</div>` : emptyState("No test plans yet.")}
    </section>
  `;
}

function projectCards() {
  return `<div class="project-card-grid">${state.workspace.projects.map((project) => {
    const selected = project.id === state.activeProjectId;
    const testCount = state.workspace.testCases.filter((item) => item.projectId === project.id).length;
    const bugCount = state.workspace.bugs.filter((item) => item.projectId === project.id).length;
    return `<article class="project-card ${selected ? "selected" : ""}"><div class="project-card-top"><span class="project-icon ${escapeHtml(project.color || "violet")}">Q</span>${selected ? '<span class="project-active">ACTIVE</span>' : ""}</div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.description || "Project quality workspace")}</p><div class="project-totals"><span><b>${testCount}</b> test cases</span><span><b>${bugCount}</b> bugs</span></div><button class="secondary-button" data-open-project="${escapeHtml(project.id)}" type="button">${selected ? "Open project" : "Switch to project"} →</button></article>`;
  }).join("")}</div>`;
}

function projectFormCard() {
  return `<section class="content-card form-card project-form-card"><div class="card-heading"><div><h2>Add a project</h2><p>Every project gets separate test cases, bugs, plans and notes.</p></div></div><form data-form="project" class="workspace-form"><label>Project name<input name="name" placeholder="e.g. Customer Portal" required /></label><label>Project description<textarea name="description" rows="3" placeholder="What does this project cover?" required></textarea></label><p class="form-message" aria-live="polite"></p><button class="primary-button" type="submit">+ Create project</button></form></section>`;
}

function renderSection(section) {
  const content = {
    "Test Cases": `${sectionHeader("Test Cases", "Build and maintain clear, repeatable test scenarios.", "Add test case")}<div class="section-grid"><div>${testCasesCard()}</div></div>`,
    "Bugs": `${sectionHeader("Bug Tracker", "Log issues clearly so they can be reproduced and fixed.", "Add bug")}<div class="section-grid"><div>${bugListCard(projectItems("bugs"), true)}</div></div>`,
    "Assigned Bugs": `${sectionHeader("Assigned Bugs", "Issues assigned for developer follow-up in this project.", "Report a bug")}<div class="section-grid"><div>${bugListCard(projectItems("bugs").filter((bug) => bug.assignee === "Developer"), true, "No issues assigned to developers in this project.")}</div></div>`,
    "Test Plans": `${sectionHeader("Test Plans", "Plan coverage and keep your upcoming test cycles organized.", "Create test plan")}<div class="section-grid"><div>${testPlansCard()}</div></div>`,
    Notes: `${sectionHeader("Team Notes", "Keep important testing context in one shared place.", "Add a note")}<div class="section-grid"><div>${notesCard()}</div></div>`,
    Projects: `${sectionHeader("Projects", "Keep each product's test cases, bugs, and plans in its own workspace.", "Add project")}<div class="project-page-grid">${projectCards()}</div>`,
  };
  return content[section] || renderOverview(counts());
}

function testCaseTools() {
  return `
    <section class="content-card tools-card">
      <div class="card-heading"><div><h2>Add test cases</h2><p>New cases are saved under ${escapeHtml(activeProject().name)}.</p></div></div>
      <div class="tool-tabs">
        <button class="tool-tab ${state.testCaseMode === "create" ? "selected" : ""}" data-mode="create" type="button">Template</button>
        <button class="tool-tab ${state.testCaseMode === "bulk" ? "selected" : ""}" data-mode="bulk" type="button">Bulk add</button>
        <button class="tool-tab ${state.testCaseMode === "ai" ? "selected" : ""}" data-mode="ai" type="button">AI draft</button>
        <button class="tool-tab ${state.testCaseMode === "import" ? "selected" : ""}" data-mode="import" type="button">Import</button>
      </div>
      ${state.testCaseMode === "ai" ? aiPromptCard() : state.testCaseMode === "bulk" ? bulkCaseCard() : state.testCaseMode === "import" ? importCard("test-cases", "CSV columns can use the project template: Test Case No, Feature Name, TestCase Name, Prerequisites, Test Data, Steps, Expected Result, Bug Description, Tester Comments, Test Result, Developer Comments, Fix status IT1, Test Result IT2, Fix status IT2 and Test Result IT3.") : singleCaseCard()}
    </section>
  `;
}

function bulkCaseCard() {
  return `
    <form data-form="bulk-cases" class="workspace-form">
      <div class="template-banner"><span>TC</span><div><strong>Bulk test case template</strong><small>One scenario per line. Shared module, setup, steps and expected result.</small></div></div>
      <label>Test case titles <span class="field-hint">One test case per line</span><textarea name="lines" rows="4" placeholder="Sign in with valid credentials&#10;Show an error for an invalid password" required></textarea></label>
      <div class="form-row"><label>Module<input name="module" placeholder="e.g. Authentication" required /></label><label>Priority<select name="priority"><option>High</option><option selected>Medium</option><option>Low</option></select></label></div>
      <label>Preconditions<textarea name="preconditions" rows="2" placeholder="What must be set up before testing?" required></textarea></label>
      <label>Steps to execute<textarea name="steps" rows="3" placeholder="1. Open the login page&#10;2. Enter credentials&#10;3. Submit" required></textarea></label>
      <label>Test data<textarea name="testData" rows="2" placeholder="Sample account, values, or test environment" required></textarea></label>
      <label>Expected result<textarea name="expectedResult" rows="2" placeholder="Describe the expected outcome" required></textarea></label>
      <label>Attach images (optional)<input type="file" name="images" accept="image/*" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Save test cases</button>
    </form>
  `;
}

function singleCaseCard(testCase = null) {
  const editing = Boolean(testCase);
  const field = (name, fallback = "") => escapeHtml(testCase?.[name] ?? fallback);
  const steps = Array.isArray(testCase?.steps) ? testCase.steps.join("\n") : testCase?.steps || "";
  const selectOption = (name, option, fallback) => `<option ${String(testCase?.[name] ?? fallback) === option ? "selected" : ""}>${option}</option>`;
  const testResult = testCase?.testResult || testCase?.status || "Not Run";
  const caseNumber = testCase?.id || nextId("TC", state.workspace.testCases);
  return `
    <form data-form="case" ${editing ? `data-edit-id="${escapeHtml(testCase.id)}"` : ""} class="workspace-form">
      <div class="template-banner"><span>TC</span><div><strong>${editing ? "Update project test-case report" : "Project test-case template"}</strong><small>${editing ? "Update the test results and notes for this saved case." : `Test case number is generated automatically for ${escapeHtml(activeProject().name)}.`}</small></div></div>
      <div class="form-row"><label>Test Case No<input value="${escapeHtml(caseNumber)}" readonly /></label><label>Feature Name<input name="featureName" value="${field("featureName", testCase?.module || "")}" placeholder="e.g. Checkout" required /></label></div>
      <label>TestCase Name<input name="title" value="${field("title")}" placeholder="e.g. Complete checkout with a valid card" required /></label>
      <label>Prerequisites<textarea name="preconditions" rows="2" placeholder="What must be true before this test?" required>${field("preconditions")}</textarea></label>
      <label>Test Data<textarea name="testData" rows="2" placeholder="Account, input data, or environment" required>${field("testData")}</textarea></label>
      <label>Steps<textarea name="steps" rows="4" placeholder="1. Open the checkout page&#10;2. Enter valid payment details&#10;3. Submit the order" required>${escapeHtml(steps)}</textarea></label>
      <label>Expected Result<textarea name="expectedResult" rows="2" placeholder="What should happen?" required>${field("expectedResult")}</textarea></label>
      <label>Bug Description<textarea name="bugDescription" rows="2" placeholder="Describe a bug found while running this case, if any">${field("bugDescription")}</textarea></label>
      <label>Tester Comments<textarea name="testerComments" rows="2" placeholder="Testing observations or notes">${field("testerComments")}</textarea></label>
      <div class="form-row"><label>Test Result<select name="testResult">${["Not Run", "Passed", "Failed", "Blocked"].map((option) => selectOption("testResult", option, testResult)).join("")}</select></label><label>Priority<select name="priority">${["Critical", "High", "Medium", "Low"].map((option) => selectOption("priority", option, testCase?.priority || "Medium")).join("")}</select></label></div>
      <label>Developer Comments<textarea name="developerComments" rows="2" placeholder="Developer notes about the fix">${field("developerComments")}</textarea></label>
      <div class="form-row"><label>Fix status IT1<select name="fixStatusIT1">${["", "Pending", "Fixed", "Reopened"].map((option) => `<option value="${option}" ${String(testCase?.fixStatusIT1 || "") === option ? "selected" : ""}>${option || "Not updated"}</option>`).join("")}</select></label><label>Test Result IT2<select name="testResultIT2">${["", "Passed", "Failed", "Blocked"].map((option) => `<option value="${option}" ${String(testCase?.testResultIT2 || "") === option ? "selected" : ""}>${option || "Not run"}</option>`).join("")}</select></label></div>
      <div class="form-row"><label>Fix status IT2<select name="fixStatusIT2">${["", "Pending", "Fixed", "Reopened"].map((option) => `<option value="${option}" ${String(testCase?.fixStatusIT2 || "") === option ? "selected" : ""}>${option || "Not updated"}</option>`).join("")}</select></label><label>Test Result IT3<select name="testResultIT3">${["", "Passed", "Failed", "Blocked"].map((option) => `<option value="${option}" ${String(testCase?.testResultIT3 || "") === option ? "selected" : ""}>${option || "Not run"}</option>`).join("")}</select></label></div>
      <label class="screenshot-field">Attach screenshots (optional)<input type="file" name="images" accept="image/*" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <label class="document-upload-field">Upload report documents<input type="file" name="documents" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" multiple data-document-input /><span>PDF, Word, Excel, CSV or text · up to 3 files, 500 KB each</span></label>
      <div class="document-previews" data-document-previews></div>
      ${editing && testCase.documents?.length ? `<div class="existing-report-documents"><strong>Already attached</strong>${documentLinks(testCase.documents)}</div>` : ""}
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">${editing ? "Save report updates" : `+ Save test case to ${escapeHtml(activeProject().name)}`}</button>
    </form>
  `;
}

function aiPromptCard() {
  return `
    <div class="ai-panel">
      <span class="ai-badge">✦ AI-ASSISTED TEST DESIGN</span>
      <p>Upload a screen and describe the workflow. Qyntra sends both to the configured OpenAI backend and drafts reviewable test scenarios.</p>
      <label class="upload-zone"><span class="upload-symbol">▧</span><strong>Choose screenshots</strong><small>PNG, JPG or WEBP · up to 900 KB each</small><input id="ai-images" type="file" accept="image/*" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <label class="prompt-label">What should this screen do?<textarea id="ai-prompt" rows="4" placeholder="Example: A login screen should accept a valid email and password, show an error for incorrect credentials, and offer a forgot-password link."></textarea></label>
      <div class="ai-disclosure">Screenshots are sent to your configured Qyntra backend for OpenAI vision analysis. They are saved with cases only after you approve the drafts.</div>
      <button class="primary-button" id="generate-ai-cases" type="button">✦ Draft test cases</button>
      <p class="form-message ai-result" aria-live="polite"></p>
    </div>
  `;
}

function aiDraftCard() {
  return `<section class="content-card ai-results-card"><div class="card-heading"><div><h2>AI draft workspace</h2><p>Review each case before saving it to the shared library.</p></div></div><div id="ai-draft-results"></div></section>`;
}

function bugTools() {
  return `
    <section class="content-card tools-card">
      <div class="card-heading"><div><h2>Report bugs</h2><p>Each issue is saved to ${escapeHtml(activeProject().name)}.</p></div></div>
      <div class="tool-tabs">
        <button class="tool-tab ${state.bugMode === "create" ? "selected" : ""}" data-mode="create" type="button">Bug template</button>
        <button class="tool-tab ${state.bugMode === "bulk" ? "selected" : ""}" data-mode="bulk" type="button">Bulk add</button>
        <button class="tool-tab ${state.bugMode === "import" ? "selected" : ""}" data-mode="import" type="button">Import</button>
      </div>
      ${state.bugMode === "bulk" ? bulkBugCard() : state.bugMode === "import" ? importCard("bugs", "Choose a CSV or JSON file. CSV supports title,module,severity,assignee,description,stepsToReproduce,expectedResult,actualResult.") : singleBugCard()}
    </section>
  `;
}

function bulkBugCard() {
  return `
    <form data-form="bulk-bugs" class="workspace-form">
      <div class="template-banner bug-template"><span>BUG</span><div><strong>Bulk bug template</strong><small>Each title becomes an assigned issue in this project.</small></div></div>
      <label>Bug titles <span class="field-hint">One bug per line</span><textarea name="lines" rows="3" placeholder="Checkout button does not respond&#10;Error message is unclear" required></textarea></label>
      <label>Module<input name="module" placeholder="e.g. Checkout" required /></label>
      <label>Description<textarea name="description" rows="2" placeholder="What is wrong?" required></textarea></label>
      <label>Steps to reproduce<textarea name="stepsToReproduce" rows="3" placeholder="1. Open checkout&#10;2. Enter a valid address&#10;3. Click Continue" required></textarea></label>
      <label>Expected result<textarea name="expectedResult" rows="2" placeholder="What should happen?" required></textarea></label>
      <label>Actual result<textarea name="actualResult" rows="2" placeholder="What actually happened?" required></textarea></label>
      <div class="form-row"><label>Severity<select name="severity"><option>High</option><option selected>Medium</option><option>Low</option></select></label><label>Assign to<select name="assignee"><option>Developer</option><option>QA Test Engineer</option></select></label></div>
      <label>Attach screenshots (optional)<input type="file" name="images" accept="image/*" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Save bugs</button>
    </form>
  `;
}

function singleBugCard() {
  return `
    <form data-form="bug" class="workspace-form">
      <div class="template-banner bug-template"><span>BUG</span><div><strong>Standard bug report</strong><small>Clear reproduction steps make bugs faster to fix.</small></div></div>
      <label>Bug title<input name="title" placeholder="e.g. Checkout button does not respond" required /></label>
      <label>Module<input name="module" placeholder="e.g. Checkout" required /></label>
      <label>Description<textarea name="description" rows="2" placeholder="Describe the issue and its impact" required></textarea></label>
      <label>Steps to reproduce<textarea name="stepsToReproduce" rows="3" placeholder="1. Open checkout&#10;2. Enter a valid address&#10;3. Click Continue" required></textarea></label>
      <label>Expected result<textarea name="expectedResult" rows="2" placeholder="What should happen?" required></textarea></label>
      <label>Actual result<textarea name="actualResult" rows="2" placeholder="What actually happened?" required></textarea></label>
      <div class="form-row"><label>Severity<select name="severity"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option></select></label><label>Assign to<select name="assignee"><option>Developer</option><option>QA Test Engineer</option></select></label></div>
      <label>Attach screenshots (optional)<input type="file" name="images" accept="image/*" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Add bug to ${escapeHtml(activeProject().name)}</button>
    </form>
  `;
}

function importCard(type, description) {
  return `
    <div class="import-panel">
      <p class="import-description">${description}</p>
      <form data-form="import-${type}" class="workspace-form">
        <label class="upload-zone"><span class="upload-symbol">⇧</span><strong>Choose a file to import</strong><small>CSV or JSON · rows are checked before adding</small><input type="file" data-import="${type}" accept="text/csv,.csv,.json" required /></label>
        <p class="form-message" aria-live="polite"></p>
        <button class="primary-button" type="submit">Import ${type === "bugs" ? "bugs" : "test cases"}</button>
      </form>
    </div>
  `;
}

function formCard(title, type) {
  const formFields = {
    plan: `<label>Plan name<input name="title" placeholder="e.g. Checkout release regression" required /></label><label>Test scope<textarea name="scope" rows="3" placeholder="What will this plan cover?" required></textarea></label><label>Target date<input name="date" type="date" required /></label>`,
    note: `<label>Note title<input name="title" placeholder="What should the team remember?" required /></label><label>Note<textarea name="body" rows="5" placeholder="Add helpful context for your team..." required></textarea></label>`,
  };
  return `<section class="content-card form-card"><div class="card-heading"><div><h2>${title}</h2><p>Share it with your Qyntra workspace</p></div></div><form data-form="${type}" class="workspace-form">${formFields[type]}<p class="form-message" aria-live="polite"></p><button class="primary-button" type="submit">+ Save ${type === "plan" ? "test plan" : "note"}</button></form></section>`;
}

function sectionHeader(title, description, actionLabel) {
  const action = title.startsWith("Test Cases") ? "case" : title.startsWith("Test Plans") ? "plan" : title.startsWith("Team Notes") ? "note" : title.startsWith("Projects") ? "project" : "bug";
  return `<div class="welcome-row"><div><span class="section-kicker">QYNTRA WORKSPACE</span><h1>${title}</h1><p>${description}</p></div><button class="primary-button" data-open-modal="${action}" type="button">+ ${actionLabel}</button></div>`;
}

function renderEntryModal() {
  if (!state.modal) return "";
  const testCaseToEdit = state.modal === "edit-case"
    ? state.workspace.testCases.find((item) => item.id === state.editingTestCaseId)
    : null;
  if (state.modal === "edit-case" && !testCaseToEdit) {
    throw new Error(`Test case ${state.editingTestCaseId} was not found.`);
  }
  const titles = { case: "Add test cases", "edit-case": "Update test report", bug: "Report a bug", plan: "Create a test plan", note: "Add a team note", project: "Create a project" };
  const content = {
    case: `${testCaseTools()}${state.testCaseMode === "ai" ? aiDraftCard() : ""}`,
    "edit-case": `<section class="content-card tools-card">${singleCaseCard(testCaseToEdit)}</section>`,
    bug: bugTools(),
    plan: formCard("Create a test plan", "plan"),
    note: formCard("Add a team note", "note"),
    project: projectFormCard(),
  }[state.modal];
  if (!content) return "";
  return `<dialog class="entry-dialog" id="entry-dialog" aria-labelledby="entry-dialog-title"><div class="entry-dialog-header"><div><span class="section-kicker">QYNTRA WORKSPACE · ${escapeHtml(activeProject().name)}</span><h2 id="entry-dialog-title">${titles[state.modal]}</h2></div><button class="modal-close" data-close-modal type="button" aria-label="Close dialog">×</button></div><div class="entry-dialog-body">${content}</div></dialog>`;
}

function bugListCard(bugs, editable, emptyMessage = "No bugs reported yet.") {
  return `<section class="content-card"><div class="card-heading"><div><h2>${editable ? "All reported bugs" : "Developer issues"}</h2><p>${bugs.length} issue${bugs.length === 1 ? "" : "s"} · status can be updated here</p></div></div>${bugs.length ? `<div class="bug-list">${bugs.map((bug) => bugRow(bug, editable)).join("")}</div>` : emptyState(emptyMessage)}</section>`;
}

function notesCard() {
  return `<section class="content-card"><div class="card-heading"><div><h2>Workspace notes</h2><p>${state.workspace.notes.length} notes shared with your team</p></div></div>${state.workspace.notes.length ? `<div class="notes-grid">${state.workspace.notes.map((note) => `<article class="note-card"><span>${escapeHtml(note.date)}</span><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><small>Added by ${escapeHtml(note.author)}</small></article>`).join("")}</div>` : emptyState("Add a note to share useful testing context with your team.")}</section>`;
}

async function readImageAttachments(files) {
  const images = Array.from(files || []);
  if (images.some((file) => !file.type.startsWith("image/"))) throw new Error("Only image files can be attached.");
  if (images.some((file) => file.size > MAX_IMAGE_BYTES)) throw new Error("Each image must be smaller than 900 KB.");
  if (images.length > 5) throw new Error("Attach no more than 5 images at a time.");
  return Promise.all(images.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ name: file.name, data: reader.result }));
    reader.addEventListener("error", () => reject(new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  })));
}

async function readDocumentAttachments(files, existingCount = 0) {
  const documents = Array.from(files || []);
  const supported = /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i;
  if (documents.some((file) => !supported.test(file.name))) {
    throw new Error("Use PDF, Word, Excel, CSV, or text documents.");
  }
  if (documents.some((file) => file.size > MAX_DOCUMENT_BYTES)) {
    throw new Error("Each report document must be 500 KB or smaller.");
  }
  if (documents.length + existingCount > MAX_DOCUMENT_FILES) {
    throw new Error(`A test report can have up to ${MAX_DOCUMENT_FILES} documents.`);
  }
  return Promise.all(documents.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve({ name: file.name, type: file.type || "application/octet-stream", data: reader.result });
    });
    reader.addEventListener("error", () => reject(new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  })));
}

function showImagePreviews(input) {
  const container = input.closest("form, .ai-panel")?.querySelector("[data-previews]");
  if (!container) return;
  container.replaceChildren();
  Array.from(input.files || []).forEach((file) => {
    const item = document.createElement("span");
    item.className = "preview-file";
    item.textContent = `▧ ${file.name}`;
    container.append(item);
  });
}

function showDocumentPreviews(input) {
  const container = input.closest("form")?.querySelector("[data-document-previews]");
  if (!container) return;
  container.replaceChildren();
  Array.from(input.files || []).forEach((file) => {
    const item = document.createElement("span");
    item.className = "preview-file document-preview-file";
    item.textContent = `DOC · ${file.name}`;
    container.append(item);
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const message = form.querySelector(".form-message");
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  message.textContent = "Saving...";
  message.classList.remove("error");
  try {
    if (form.dataset.form === "case") {
      const attachments = await readImageAttachments(form.elements.images.files);
      const existingCase = form.dataset.editId
        ? state.workspace.testCases.find((item) => item.id === form.dataset.editId)
        : null;
      if (form.dataset.editId && !existingCase) throw new Error("This test case no longer exists. Refresh the page and try again.");
      const existingDocuments = existingCase?.documents || [];
      const documents = await readDocumentAttachments(form.elements.documents.files, existingDocuments.length);
      const testResult = values.testResult;
      const testCase = {
        ...(existingCase || {}),
        id: existingCase?.id || nextId("TC", state.workspace.testCases),
        projectId: existingCase?.projectId || state.activeProjectId,
        title: values.title.trim(),
        featureName: values.featureName.trim(),
        module: values.featureName.trim(),
        priority: values.priority,
        status: testResult,
        testResult,
        preconditions: values.preconditions.trim(),
        steps: splitLines(values.steps),
        testData: values.testData.trim(),
        expectedResult: values.expectedResult.trim(),
        bugDescription: values.bugDescription.trim(),
        testerComments: values.testerComments.trim(),
        developerComments: values.developerComments.trim(),
        fixStatusIT1: values.fixStatusIT1,
        testResultIT2: values.testResultIT2,
        fixStatusIT2: values.fixStatusIT2,
        testResultIT3: values.testResultIT3,
        actualResult: existingCase?.actualResult || "",
        attachments: [...(existingCase?.attachments || []), ...attachments],
        documents: [...existingDocuments, ...documents],
      };
      if (existingCase) {
        const index = state.workspace.testCases.findIndex((item) => item.id === existingCase.id);
        state.workspace.testCases[index] = testCase;
      } else {
        state.workspace.testCases.unshift(testCase);
      }
      state.editingTestCaseId = "";
    } else if (form.dataset.form === "bulk-cases") {
      const attachments = await readImageAttachments(form.elements.images.files);
      const titles = splitLines(values.lines);
      const ids = nextIds("TC", state.workspace.testCases, titles.length);
      state.workspace.testCases.unshift(...titles.map((title, index) => ({
        id: ids[index],
        projectId: state.activeProjectId,
        title,
        featureName: values.module.trim(),
        module: values.module.trim(),
        priority: values.priority,
        status: "Pending",
        testResult: "Pending",
        preconditions: values.preconditions.trim(),
        steps: splitLines(values.steps),
        testData: values.testData.trim(),
        expectedResult: values.expectedResult.trim(),
        bugDescription: "",
        testerComments: "",
        developerComments: "",
        fixStatusIT1: "",
        testResultIT2: "",
        fixStatusIT2: "",
        testResultIT3: "",
        actualResult: "",
        attachments,
      })));
    } else if (form.dataset.form === "ai-cases") {
      const titles = splitLines(values.lines);
      const ids = nextIds("TC", state.workspace.testCases, titles.length);
      state.workspace.testCases.unshift(...titles.map((title, index) => ({
        id: ids[index],
        projectId: state.activeProjectId,
        title,
        featureName: values.featureName.trim() || state.aiDrafts[index]?.featureName || "General",
        module: values.featureName.trim() || state.aiDrafts[index]?.featureName || "General",
        priority: "Medium",
        status: state.aiDrafts[index]?.testResult || "Not Run",
        testResult: state.aiDrafts[index]?.testResult || "Not Run",
        preconditions: state.aiDrafts[index]?.preconditions || "",
        steps: state.aiDrafts[index]?.steps || [],
        testData: state.aiDrafts[index]?.testData || "",
        expectedResult: state.aiDrafts[index]?.expectedResult || "",
        bugDescription: state.aiDrafts[index]?.bugDescription || "",
        testerComments: state.aiDrafts[index]?.testerComments || "",
        developerComments: state.aiDrafts[index]?.developerComments || "",
        fixStatusIT1: state.aiDrafts[index]?.fixStatusIT1 || "",
        testResultIT2: state.aiDrafts[index]?.testResultIT2 || "",
        fixStatusIT2: state.aiDrafts[index]?.fixStatusIT2 || "",
        testResultIT3: state.aiDrafts[index]?.testResultIT3 || "",
        actualResult: state.aiDrafts[index]?.actualResult || "Not run",
        attachments: state.aiAttachments,
      })));
      state.aiAttachments = [];
      state.aiDrafts = [];
    } else if (form.dataset.form === "bulk-bugs") {
      const attachments = await readImageAttachments(form.elements.images.files);
      const titles = splitLines(values.lines);
      const ids = nextIds("BUG", state.workspace.bugs, titles.length);
      state.workspace.bugs.unshift(...titles.map((title, index) => ({
        id: ids[index],
        projectId: state.activeProjectId,
        title,
        module: values.module.trim(),
        severity: values.severity,
        assignee: values.assignee,
        status: "Open",
        description: values.description.trim(),
        stepsToReproduce: values.stepsToReproduce.trim(),
        expectedResult: values.expectedResult.trim(),
        actualResult: values.actualResult.trim(),
        attachments,
      })));
    } else if (form.dataset.form === "bug") {
      const attachments = await readImageAttachments(form.elements.images.files);
      state.workspace.bugs.unshift({
        id: nextId("BUG", state.workspace.bugs),
        projectId: state.activeProjectId,
        title: values.title.trim(),
        module: values.module.trim(),
        description: values.description.trim(),
        stepsToReproduce: values.stepsToReproduce.trim(),
        expectedResult: values.expectedResult.trim(),
        actualResult: values.actualResult.trim(),
        severity: values.severity,
        assignee: values.assignee,
        status: "Open",
        attachments,
      });
    } else if (form.dataset.form === "plan") {
      state.workspace.testPlans.unshift({ id: nextId("PLAN", state.workspace.testPlans), projectId: state.activeProjectId, title: values.title.trim(), scope: values.scope.trim(), date: values.date });
    } else if (form.dataset.form === "note") {
      state.workspace.notes.unshift({ id: nextId("NOTE", state.workspace.notes), projectId: state.activeProjectId, title: values.title.trim(), body: values.body.trim(), date: new Date().toLocaleDateString(), author: state.username });
    } else if (form.dataset.form === "project") {
      const name = values.name.trim();
      if (state.workspace.projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) {
        throw new Error("A project with this name already exists.");
      }
      const project = { id: nextId("PRJ", state.workspace.projects), name, description: values.description.trim(), color: state.workspace.projects.length % 2 ? "coral" : "violet" };
      state.workspace.projects.unshift(project);
      state.activeProjectId = project.id;
      state.section = "Overview";
    } else if (form.dataset.form?.startsWith("import-")) {
      await importFile(form, message);
      return;
    }
    state.modal = "";
    saveWorkspace();
    renderDashboard();
  } catch (error) {
    message.textContent = error.message || "Could not save. Please try again.";
    message.classList.add("error");
    saveButton.disabled = false;
  }
}

function splitLines(value) {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Enter at least one item.");
  return lines;
}

async function importFile(form, message) {
  const input = form.querySelector("[data-import]");
  const file = input.files?.[0];
  if (!file) throw new Error("Choose a CSV or JSON file.");
  const text = await file.text();
  const records = file.name.toLowerCase().endsWith(".json") ? parseJsonRecords(text) : parseCsvRecords(text);
  const isBugImport = input.dataset.import === "bugs";
  const normalized = records.map((record, index) => {
    const title = String(record.title || record.testCaseName || record.name || "").trim();
    const module = String(record.module || "General").trim();
    if (!title) throw new Error(`Row ${index + 1} is missing a title.`);
    return isBugImport
      ? { id: "", projectId: state.activeProjectId, title, module, severity: normalizeChoice(record.severity, ["Critical", "High", "Medium", "Low"], "Medium"), assignee: normalizeChoice(record.assignee, ["Developer", "QA Test Engineer"], "Developer"), status: "Open", description: String(record.description || "").trim(), stepsToReproduce: String(record.stepsToReproduce || ""), expectedResult: String(record.expectedResult || ""), actualResult: String(record.actualResult || ""), attachments: [] }
      : {
        id: "",
        projectId: state.activeProjectId,
        title: String(record.testCaseName || title).trim(),
        featureName: String(record.featureName || module).trim(),
        module,
        priority: normalizeChoice(record.priority, ["Critical", "High", "Medium", "Low"], "Medium"),
        status: normalizeChoice(record.testResult || record.status, ["Not Run", "Pending", "Passed", "Failed", "Blocked"], "Not Run"),
        testResult: normalizeChoice(record.testResult || record.status, ["Not Run", "Pending", "Passed", "Failed", "Blocked"], "Not Run"),
        preconditions: String(record.preconditions || ""),
        steps: splitLines(record.steps || "Review the feature"),
        testData: String(record.testData || ""),
        expectedResult: String(record.expectedResult || ""),
        bugDescription: String(record.bugDescription || ""),
        testerComments: String(record.testerComments || ""),
        developerComments: String(record.developerComments || ""),
        fixStatusIT1: String(record.fixStatusIT1 || ""),
        testResultIT2: String(record.testResultIT2 || ""),
        fixStatusIT2: String(record.fixStatusIT2 || ""),
        testResultIT3: String(record.testResultIT3 || ""),
        actualResult: String(record.actualResult || ""),
        attachments: [],
      };
  });
  if (!normalized.length) throw new Error("The selected file has no data rows.");
  const ids = nextIds(isBugImport ? "BUG" : "TC", isBugImport ? state.workspace.bugs : state.workspace.testCases, normalized.length);
  normalized.forEach((record, index) => { record.id = ids[index]; });
  if (isBugImport) state.workspace.bugs.unshift(...normalized);
  else state.workspace.testCases.unshift(...normalized);
  state.modal = "";
  saveWorkspace();
  renderDashboard();
}

function normalizeChoice(value, choices, fallback) {
  if (String(value || "").trim().toLowerCase() === "qa engineer" && choices.includes("QA Test Engineer")) {
    return "QA Test Engineer";
  }
  const found = choices.find((choice) => choice.toLowerCase() === String(value || "").trim().toLowerCase());
  return found || fallback;
}

function parseJsonRecords(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON import must contain an array of records.");
  return data;
}

function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  const fields = {
    testcaseno: "testCaseNo",
    featurename: "featureName",
    testcasename: "testCaseName",
    title: "title",
    name: "name",
    prerequisites: "preconditions",
    preconditions: "preconditions",
    testdata: "testData",
    steps: "steps",
    expectedresult: "expectedResult",
    bugdescription: "bugDescription",
    testercomments: "testerComments",
    testresult: "testResult",
    actualresult: "actualResult",
    developercomments: "developerComments",
    fixstatusit1: "fixStatusIT1",
    testresultit2: "testResultIT2",
    fixstatusit2: "fixStatusIT2",
    testresultit3: "testResultIT3",
    module: "module",
    priority: "priority",
    status: "status",
    severity: "severity",
    assignee: "assignee",
    description: "description",
    stepstoreproduce: "stepsToReproduce",
  };
  const headers = (rows.shift() || []).map((header) => {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    return fields[normalized] || header.trim();
  });
  if (!headers.some((header) => ["title", "name", "testCaseName"].includes(header))) {
    throw new Error("CSV needs a TestCase Name, title, or name column.");
  }
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

async function generateAiDrafts() {
  const prompt = document.querySelector("#ai-prompt").value.trim();
  const files = document.querySelector("#ai-images").files;
  const result = document.querySelector(".ai-result");
  if (!prompt) {
    result.textContent = "Describe the screen's expected behavior first.";
    result.classList.add("error");
    return;
  }
  if (!files.length) {
    result.textContent = "Upload at least one screen image for AI analysis.";
    result.classList.add("error");
    return;
  }
  const generateButton = document.querySelector("#generate-ai-cases");
  generateButton.disabled = true;
  result.textContent = "Sending screenshot to the Qyntra AI service...";
  result.classList.remove("error");
  try {
    state.aiAttachments = await readImageAttachments(files);
    const response = await fetch("/api/generate-test-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, images: state.aiAttachments.map((image) => image.data) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The AI service could not generate test cases.");
    if (!Array.isArray(payload.testCases) || payload.testCases.length === 0) {
      throw new Error("The AI service returned no test cases. Try a clearer screenshot or description.");
    }
    state.aiDrafts = payload.testCases.map((draft) => ({
      title: String(draft.title || "").trim(),
      featureName: String(draft.featureName || "General"),
      testResult: String(draft.testResult || "Not Run"),
      preconditions: String(draft.preconditions || ""),
      steps: Array.isArray(draft.steps) ? draft.steps.map(String) : [],
      testData: String(draft.testData || ""),
      expectedResult: String(draft.expectedResult || ""),
      bugDescription: String(draft.bugDescription || ""),
      testerComments: String(draft.testerComments || ""),
      developerComments: String(draft.developerComments || ""),
      fixStatusIT1: String(draft.fixStatusIT1 || ""),
      testResultIT2: String(draft.testResultIT2 || ""),
      fixStatusIT2: String(draft.fixStatusIT2 || ""),
      testResultIT3: String(draft.testResultIT3 || ""),
      actualResult: String(draft.actualResult || "Not run"),
    }));
  } catch (error) {
    result.textContent = error instanceof TypeError
      ? "Could not reach the AI service. Start the Qyntra backend and open http://localhost:8080."
      : error.message;
    result.classList.add("error");
    generateButton.disabled = false;
    return;
  }
  const drafts = state.aiDrafts;
  const container = document.querySelector("#ai-draft-results");
  container.innerHTML = `
    <div class="ai-disclosure">OpenAI analyzed the uploaded screenshot and description. Review each generated scenario before adding it.</div>
    <div class="ai-case-previews">${drafts.map((draft, index) => `<article class="ai-case-preview"><span>AI DRAFT ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(draft.title)}</strong><p><b>Preconditions:</b> ${escapeHtml(draft.preconditions || "None specified")}</p>${draft.steps.length ? `<ol>${draft.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : ""}<p><b>Test data:</b> ${escapeHtml(draft.testData || "Define per environment")}</p><p><b>Expected:</b> ${escapeHtml(draft.expectedResult)}</p><p><b>Actual:</b> ${escapeHtml(draft.actualResult)}</p></article>`).join("")}</div>
    <form data-form="ai-cases" class="workspace-form">
      <label>Edit test case titles<textarea name="lines" rows="5" required>${drafts.map((draft) => escapeHtml(draft.title)).join("\n")}</textarea></label>
      <label>Feature Name<input name="featureName" value="${escapeHtml(drafts[0]?.featureName || "General")}" required /></label>
      <div class="image-previews">${state.aiAttachments.map((image) => `<span class="preview-file">▧ ${escapeHtml(image.name)}</span>`).join("") || '<span class="field-hint">No screenshots attached</span>'}</div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Add drafts to test cases</button>
    </form>
  `;
  container.querySelector("form").addEventListener("submit", handleFormSubmit);
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  result.textContent = `${drafts.length} test case drafts ready. Review them below.`;
  generateButton.disabled = false;
}

function notesCard() {
  const notes = projectItems("notes");
  return `<section class="content-card"><div class="card-heading"><div><h2>${escapeHtml(activeProject().name)} notes</h2><p>${notes.length} notes in this project</p></div></div>${notes.length ? `<div class="notes-grid">${notes.map((note) => `<article class="note-card"><span>${escapeHtml(note.date)}</span><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><small>Added by ${escapeHtml(note.author)}</small></article>`).join("")}</div>` : emptyState("Add a note to share useful testing context with this project.")}</section>`;
}

function updateBugStatus(id, status) {
  const bug = state.workspace.bugs.find((item) => item.id === id);
  if (!bug) throw new Error(`Bug ${id} was not found.`);
  bug.status = status;
  saveWorkspace();
  renderDashboard();
}

function nextId(prefix, entries) {
  return nextIds(prefix, entries, 1)[0];
}

function nextIds(prefix, entries, count) {
  const lastNumber = entries.reduce((max, entry) => {
    const match = entry.id.match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(lastNumber + index + 1).padStart(3, "0")}`);
}

function emptyState(message) {
  return `<div class="empty-state"><span>✦</span><p>${message}</p></div>`;
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function iconForSection(section) {
  const icons = { Overview: "home", "Test Cases": "cases", Bugs: "bugs", "Assigned Bugs": "queue", "Test Plans": "plans", Notes: "notes", Projects: "home" };
  return icon(icons[section]);
}

function initials(username) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : username.slice(0, 2)).toUpperCase() || "Q";
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !state.username) return;
  state.workspace = loadWorkspaceData();
  if (!state.workspace.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.workspace.projects[0].id;
  }
  renderDashboard();
});

renderLogin();
