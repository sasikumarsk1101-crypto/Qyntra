const app = document.querySelector("#app");
const STORAGE_KEY = "qyntra-workspace-v1";
const MAX_IMAGE_BYTES = 900_000;
const MAX_DOCUMENT_BYTES = 500_000;
const MAX_DOCUMENT_FILES = 3;
const imagePreviewUrls = new WeakMap();

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
    if (bug.fixStatus === "Needs retest") bug.fixStatus = "Needs QA retest";
    bug.assignee = capitalizeQa(bug.assignee || "");
    bug.reportedBy = capitalizeQa(bug.reportedBy || "");
    bug.developerComments ||= "";
    bug.fixStatus ||= "Not started";
    bug.testerComments ||= "";
    bug.reportedBy ||= "QA Test Engineer";
    bug.status ||= "Open";
    bug.severity ||= "Medium";
    bug.attachments ||= [];
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
  aiChatMessages: [],
  aiChatHistory: [],
  aiPromptDraft: "",
  pendingImport: null,
  loadingTimer: null,
  activeProjectId: "",
  bugSearch: "",
  bugStatusFilter: "All statuses",
  bugSeverityFilter: "All severities",
  bugSavedId: "",
  bugSavedCount: 0,
  viewBugId: "",
  newRecordType: "bug",
  newRecordSaved: null,
  viewCaseId: "",
  profileMenuOpen: false,
  profileMenuLocation: "",
  modal: "",
  editingTestCaseId: "",
  workspace: loadWorkspaceData(),
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.profileMenuOpen) {
    state.profileMenuOpen = false;
    state.profileMenuLocation = "";
    renderDashboard();
    document.querySelector('[data-profile-toggle="topbar"]')?.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!state.profileMenuOpen || !(event.target instanceof Element)) return;
  if (event.target.closest(".sidebar-account, .topbar-profile-control, input, textarea, select, label")) return;
  state.profileMenuOpen = false;
  state.profileMenuLocation = "";
  renderDashboard();
});

state.activeProjectId = state.workspace.projects[0].id;
const navItems = ["Overview", "Add New", "Test Cases", "Bugs", "Assigned Bugs", "Test Plans", "Notes", "Projects"];

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

function capitalizeQa(value = "") {
  return String(value).replace(/\bqa\b/gi, "QA");
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

function renderProfileMenu(location) {
  return `<div class="profile-menu profile-menu-${location}" id="profile-menu-${location}" aria-label="Profile menu"><div class="profile-menu-heading"><div class="avatar">${escapeHtml(initials(state.username))}</div><div><strong>${escapeHtml(capitalizeQa(state.username))}</strong><span>QA Test Engineer</span></div></div><div class="profile-menu-project"><span>Active project</span><strong>${escapeHtml(activeProject().name)}</strong></div><a class="profile-menu-developer" href="developer.html">Switch to Developer <span aria-hidden="true">→</span></a><button class="profile-menu-signout" type="button" data-sign-out>Sign out <span aria-hidden="true">↗</span></button></div>`;
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
    state.username = capitalizeQa(username);
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
  document.querySelectorAll(".custom-select-menu[data-portaled]").forEach((menu) => menu.remove());
  document.querySelectorAll("[data-previews]").forEach((container) => {
    for (const url of imagePreviewUrls.get(container) || []) URL.revokeObjectURL(url);
    imagePreviewUrls.delete(container);
  });
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
          <div class="sidebar-bottom sidebar-account">
                <button class="sidebar-user profile-trigger" type="button" data-profile-toggle="sidebar" aria-haspopup="menu" aria-expanded="${state.profileMenuOpen && state.profileMenuLocation === "sidebar"}" aria-controls="profile-menu-sidebar">
                  <div class="avatar">${escapeHtml(initials(state.username))}</div><span class="user-copy"><strong>${escapeHtml(capitalizeQa(state.username))}</strong><span>QA Test Engineer</span></span><span class="profile-chevron" aria-hidden="true">⌄</span>
                </button>
                ${state.profileMenuOpen && state.profileMenuLocation === "sidebar" ? renderProfileMenu("sidebar") : ""}
          </div>
        </aside>
        <div class="dashboard-main">
          <header class="topbar">
            <div class="breadcrumbs">${brand()} <span>/</span> <strong>${escapeHtml(state.section)}</strong></div>
            <div class="topbar-right"><select class="topbar-project-select" aria-label="Filter by project" data-project-select>${projectOptions()}</select><span class="topbar-date">${new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span><div class="topbar-profile-control"><button class="avatar topbar-profile-trigger" type="button" data-profile-toggle="topbar" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded="${state.profileMenuOpen && state.profileMenuLocation === "topbar"}" aria-controls="profile-menu-topbar">${escapeHtml(initials(state.username))}</button>${state.profileMenuOpen && state.profileMenuLocation === "topbar" ? renderProfileMenu("topbar") : ""}</div></div>
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
      state.profileMenuOpen = false;
      state.profileMenuLocation = "";
      state.modal = "";
      if (state.section === "Add New") {
        state.bugSavedId = "";
        state.bugSavedCount = 0;
        state.newRecordSaved = null;
      }
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-profile-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const location = button.dataset.profileToggle;
      const shouldOpen = !state.profileMenuOpen || state.profileMenuLocation !== location;
      state.profileMenuOpen = shouldOpen;
      state.profileMenuLocation = shouldOpen ? location : "";
      renderDashboard();
      document.querySelector(`[data-profile-toggle="${location}"]`)?.focus();
    });
  });
  document.querySelectorAll("[data-sign-out]").forEach((button) => {
    button.addEventListener("click", () => {
      window.clearTimeout(state.loadingTimer);
      state.username = "";
      state.profileMenuOpen = false;
      state.profileMenuLocation = "";
      state.modal = "";
      renderLogin();
    });
  });
  document.querySelectorAll("[data-project-select]").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.activeProjectId = event.currentTarget.value;
      state.profileMenuOpen = false;
      state.profileMenuLocation = "";
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
      if (button.dataset.addType) {
        state.newRecordType = button.dataset.addType;
        state.newRecordSaved = null;
        state.bugSavedId = "";
        state.bugSavedCount = 0;
      }
      state.modal = "";
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingTestCaseId = "";
      if (button.dataset.openModal === "bug") {
        state.bugSavedId = "";
        state.bugSavedCount = 0;
      }
      if (button.dataset.openModal === "bug" || button.dataset.openModal === "case") {
        state.newRecordType = button.dataset.openModal === "case" ? "case" : "bug";
        state.newRecordSaved = null;
        state.section = "Add New";
        state.modal = "";
        renderDashboard();
        return;
      }
      state.modal = button.dataset.openModal;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-bug-followup]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.bugFollowup === "add") {
        state.bugSavedId = "";
        state.bugSavedCount = 0;
        state.newRecordSaved = null;
        state.bugMode = "create";
        state.section = "Add New";
        state.newRecordType = "bug";
        state.modal = "";
      } else {
        state.section = "Bugs";
        state.modal = "";
        state.viewBugId = button.dataset.bugId || state.bugSavedId;
        state.bugSearch = "";
        state.bugStatusFilter = "All statuses";
        state.bugSeverityFilter = "All severities";
      }
      renderDashboard();
      if (button.dataset.bugFollowup === "view") {
        document.getElementById(`bug-report-${state.viewBugId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
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
      if (state.modal === "bug" || state.section === "Bugs" || (state.section === "Add New" && state.newRecordType === "bug")) state.bugMode = button.dataset.mode;
      if (state.section === "Add New" && state.newRecordType === "case") state.testCaseMode = button.dataset.mode;
      if (state.modal === "bug") {
        state.bugSavedId = "";
        state.bugSavedCount = 0;
      }
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-new-record-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newRecordType = button.dataset.newRecordType;
      state.newRecordSaved = null;
      state.bugSavedId = "";
      state.bugSavedCount = 0;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-new-record-followup]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.newRecordFollowup === "view") {
        if (state.newRecordSaved?.type === "case") state.viewCaseId = state.newRecordSaved.id;
        state.section = state.newRecordSaved?.type === "case" ? "Test Cases" : "Bugs";
      } else {
        state.newRecordSaved = null;
      }
      renderDashboard();
      if (button.dataset.newRecordFollowup === "view" && state.viewCaseId) {
        document.getElementById(`test-case-report-${state.viewCaseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
  document.querySelectorAll("form[data-form]").forEach((form) => {
    form.addEventListener("submit", handleFormSubmit);
  });
  const geminiForm = document.querySelector("#gemini-chat-form");
  if (geminiForm) geminiForm.addEventListener("submit", sendGeminiMessage);
  document.querySelectorAll("[data-download-ai-cases]").forEach((button) => {
    button.addEventListener("click", downloadAiCases);
  });
  document.querySelectorAll("[data-save-import]").forEach((button) => {
    button.addEventListener("click", saveImportedTestCases);
  });
  document.querySelectorAll("[data-cancel-import]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingImport = null;
      renderDashboard();
    });
  });
  document.querySelectorAll("[data-import-ai]").forEach((button) => {
    button.addEventListener("click", () => {
      const records = state.pendingImport?.records || [];
      state.aiPromptDraft = `Review these imported test cases and improve the coverage and wording. Return the complete revised test case set in the Qyntra spreadsheet format:\n${JSON.stringify(records.map((record) => ({
        featureName: record.featureName,
        title: record.title,
        preconditions: record.preconditions,
        testData: record.testData,
        steps: record.steps,
        expectedResult: record.expectedResult,
      })))}`;
      state.aiChatMessages = [];
      state.aiChatHistory = [];
      state.aiDrafts = [];
      state.pendingImport = null;
      state.testCaseMode = "ai";
      renderDashboard();
      document.querySelector("#ai-prompt")?.focus();
    });
  });
  document.querySelectorAll("[data-clear-ai-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      state.aiChatMessages = [];
      state.aiChatHistory = [];
      state.aiDrafts = [];
      state.aiAttachments = [];
      state.aiPromptDraft = "";
      renderDashboard();
    });
  });
  setupCustomDropdowns();
  const bugSearch = document.querySelector("[data-bug-search]");
  if (bugSearch) bugSearch.addEventListener("input", applyBugFilters);
  if (bugSearch) applyBugFilters();
  document.querySelectorAll("[data-image-input]").forEach((input) => {
    input.addEventListener("change", () => showImagePreviews(input));
  });
  document.querySelectorAll("[data-document-input]").forEach((input) => {
    input.addEventListener("change", () => showDocumentPreviews(input));
  });
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
    <div class="overview-toolbar"><div><h2>Project overview</h2><p>Keep an eye on the work that moves quality forward.</p></div><button class="primary-button" data-action="Add New" data-add-type="case" type="button">+ Add New</button></div>
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
  const route = section === "case" || section === "bug";
  return `<button class="quick-action ${tone}" ${route ? `data-action="Add New" data-add-type="${section}"` : `data-open-modal="${section}"`} type="button"><span class="quick-icon">${symbol}</span><span class="quick-copy"><strong>${title}</strong><small>${detail}</small></span><span class="quick-arrow">→</span></button>`;
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
  const searchText = [bug.id, bug.title, bug.module, bug.assignee, bug.description].join(" ").toLowerCase();
  return `
    <article class="bug-row" data-bug-entry data-search="${escapeHtml(searchText)}" data-status="${escapeHtml(bug.status)}" data-severity="${escapeHtml(bug.severity)}">
      <span class="bug-symbol" aria-hidden="true">🐞</span>
      <div class="bug-copy"><strong>${escapeHtml(bug.title)}</strong><span>${escapeHtml(bug.id)} · ${escapeHtml(bug.module)} · ${escapeHtml(bug.assignee)} ${attachmentStrip(bug.attachments)}</span><details class="record-details" id="bug-report-${escapeHtml(bug.id)}" ${state.viewBugId === bug.id ? "open" : ""}><summary>View report</summary><p><b>Description:</b> ${escapeHtml(bug.description || "Not provided")}</p><p><b>Steps:</b> ${escapeHtml(bug.stepsToReproduce || "Not provided")}</p><p><b>Expected:</b> ${escapeHtml(bug.expectedResult || "Not provided")}</p><p><b>Actual:</b> ${escapeHtml(bug.actualResult || "Not provided")}</p><p><b>Severity:</b> ${escapeHtml(bug.severity || "Medium")}</p><p><b>QA status:</b> ${escapeHtml(bug.status || "Open")}</p><p><b>Reported by:</b> ${escapeHtml(bug.reportedBy || "QA Test Engineer")}</p><p><b>Tester comments:</b> ${escapeHtml(bug.testerComments || "Not provided")}</p><p><b>Developer fix status:</b> ${escapeHtml(bug.fixStatus || "Not started")}</p><p><b>Developer comments:</b> ${escapeHtml(bug.developerComments || "Not provided")}</p></details></div>
      <div class="bug-trailing"><span class="severity ${bug.severity.toLowerCase()}">${escapeHtml(bug.severity)}</span>${editable ? `<select class="inline-status" data-bug-status="${escapeHtml(bug.id)}" aria-label="Update ${escapeHtml(bug.id)} status">${["Open", "In Progress", "Fixed"].map((status) => `<option ${bug.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>` : `<span class="bug-status ${statusClass(bug.status)}">${escapeHtml(bug.status)}</span>`}</div>
    </article>
  `;
}

function testCasesCard(compact = false) {
  const allCases = projectItems("testCases");
  const cases = compact ? allCases.slice(0, 4) : allCases;
  const caseRows = cases.map((testCase) => {
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
    const details = `<details class="record-details test-case-details" id="test-case-report-${escapeHtml(testCase.id)}" ${state.viewCaseId === testCase.id ? "open" : ""}><summary>View full test case &amp; documents</summary><div class="test-case-detail-grid">${detailFields.map(([label, value]) => `<div class="test-case-detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div><section class="report-documents"><h3>Uploaded report documents</h3>${documentLinks(testCase.documents || [])}</section><button class="secondary-button edit-report-button" type="button" data-edit-test-case="${escapeHtml(testCase.id)}">Edit this test report</button></details>`;
    if (compact) {
      return `<article class="data-row"><div class="data-icon case-icon">TC</div><div class="data-copy"><strong>${escapeHtml(testCase.title)}</strong><span>${escapeHtml(testCase.id)} · ${escapeHtml(testCase.featureName || testCase.module)} · ${escapeHtml(testCase.priority)} priority ${attachmentStrip(testCase.attachments)}</span>${details}</div><span class="status-pill ${statusClass(testResult)}">${escapeHtml(testResult)}</span></article>`;
    }
    return `<tr><td><span class="record-table-id">${escapeHtml(testCase.id)}</span></td><td>${escapeHtml(testCase.featureName || testCase.module || "—")}</td><td><div class="record-table-title"><strong>${escapeHtml(testCase.title)}</strong>${attachmentStrip(testCase.attachments)}${details}</div></td><td><span class="severity ${escapeHtml(testCase.priority.toLowerCase())}">${escapeHtml(testCase.priority)}</span></td><td><span class="status-pill ${statusClass(testResult)}">${escapeHtml(testResult)}</span></td></tr>`;
  }).join("");
  return `
    <section class="content-card">
      <div class="card-heading"><div><h2>Test cases</h2><p>${allCases.length} scenarios in ${escapeHtml(activeProject().name)}</p></div>${compact ? `<button class="card-link" data-action="Test Cases" type="button">View all →</button>` : ""}</div>
      ${cases.length ? compact ? `<div class="data-list">${caseRows}</div>` : `<div class="bug-table-wrap"><table class="workspace-table"><thead><tr><th scope="col">Case ID</th><th scope="col">Feature</th><th scope="col">Test case</th><th scope="col">Priority</th><th scope="col">Result</th></tr></thead><tbody>${caseRows}</tbody></table></div>` : emptyState("Add your first test case to start building coverage.")}
    </section>
  `;
}

function testPlansCard(compact = false) {
  const allPlans = projectItems("testPlans");
  const plans = compact ? allPlans.slice(0, 3) : allPlans;
  const planRows = plans.map((plan) => compact
    ? `<div class="data-row"><div class="data-icon plan-icon">◷</div><div class="data-copy"><strong>${escapeHtml(plan.title)}</strong><span>${escapeHtml(plan.id)} · ${escapeHtml(plan.scope)}</span></div><span class="date-tag">${escapeHtml(plan.date)}</span></div>`
    : `<tr><td><span class="record-table-id">${escapeHtml(plan.id)}</span></td><td><strong>${escapeHtml(plan.title)}</strong></td><td>${escapeHtml(plan.scope || "—")}</td><td><span class="date-tag">${escapeHtml(plan.date || "—")}</span></td></tr>`
  ).join("");
  return `
    <section class="content-card">
      <div class="card-heading"><div><h2>Test plans</h2><p>${allPlans.length} plans in ${escapeHtml(activeProject().name)}</p></div>${compact ? `<button class="card-link" data-action="Test Plans" type="button">View all →</button>` : ""}</div>
      ${plans.length ? compact ? `<div class="data-list">${planRows}</div>` : `<div class="bug-table-wrap"><table class="workspace-table"><thead><tr><th scope="col">Plan ID</th><th scope="col">Plan name</th><th scope="col">Scope</th><th scope="col">Target date</th></tr></thead><tbody>${planRows}</tbody></table></div>` : emptyState("No test plans yet.")}
    </section>
  `;
}

function projectCards() {
  const rows = state.workspace.projects.map((project) => {
    const selected = project.id === state.activeProjectId;
    const testCount = state.workspace.testCases.filter((item) => item.projectId === project.id).length;
    const bugCount = state.workspace.bugs.filter((item) => item.projectId === project.id).length;
    return `<tr><td><strong>${escapeHtml(project.name)}</strong>${selected ? ' <span class="project-active">ACTIVE</span>' : ""}</td><td>${escapeHtml(project.description || "Project quality workspace")}</td><td>${testCount}</td><td>${bugCount}</td><td><button class="table-action-button" data-open-project="${escapeHtml(project.id)}" type="button">${selected ? "Open project" : "Switch to project"} →</button></td></tr>`;
  }).join("");
  return `<section class="content-card"><div class="card-heading"><div><h2>Projects</h2><p>${state.workspace.projects.length} projects in your workspace</p></div></div><div class="bug-table-wrap"><table class="workspace-table"><thead><tr><th scope="col">Project</th><th scope="col">Description</th><th scope="col">Test cases</th><th scope="col">Bugs</th><th scope="col">Action</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function projectFormCard() {
  return `<section class="content-card form-card project-form-card"><div class="card-heading"><div><h2>Add a project</h2><p>Every project gets separate test cases, bugs, plans and notes.</p></div></div><form data-form="project" class="workspace-form"><label>Project name<input name="name" placeholder="e.g. Customer Portal" required /></label><label>Project description<textarea name="description" rows="3" placeholder="What does this project cover?" required></textarea></label><p class="form-message" aria-live="polite"></p><button class="primary-button" type="submit">+ Create project</button></form></section>`;
}

function renderSection(section) {
  const content = {
    "Add New": newRecordPage(),
    "Test Cases": `${sectionHeader("Test Cases", "Build and maintain clear, repeatable test scenarios.", "Add test case")}<div class="section-grid"><div>${testCasesCard()}</div></div>`,
    "Bugs": `${sectionHeader("Bug Tracker", "Log issues clearly so they can be reproduced and fixed.", "Add bug")}${bugTrackerContent(projectItems("bugs"))}`,
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
    <section class="content-card ai-panel">
      <span class="ai-badge">✦ GEMINI QA CHAT</span>
      <p>Chat with Gemini, attach a screen image, and ask for test cases or refinements. Your screenshots are analyzed by the configured Gemini model.</p>
      <div class="ai-chat-messages" id="ai-chat-messages" aria-live="polite">${renderAiMessages()}</div>
      <form id="gemini-chat-form" class="gemini-chat-form">
        <label class="prompt-label" for="ai-prompt">Message Gemini<textarea id="ai-prompt" rows="3" placeholder="Upload a screen and ask: Create positive, negative and boundary test cases for this flow." required>${escapeHtml(state.aiPromptDraft)}</textarea></label>
        <label class="upload-zone"><span class="upload-symbol">▧</span><strong>Attach screenshots (optional)</strong><small>PNG, JPG or WEBP · up to 5 images, 900 KB each</small><input id="ai-images" type="file" accept="image/png,image/jpeg,image/webp" multiple data-image-input /></label>
        <div class="image-previews" data-previews></div>
        <div class="ai-disclosure">Review and edit every generated case before saving. Gemini chats and images are not stored with your workspace.</div>
        <button class="primary-button" id="generate-ai-cases" type="submit">✦ Send to Gemini</button>
        <p class="form-message ai-result" aria-live="polite"></p>
      </form>
    </section>
  `;
}

function aiDraftCard() {
  return `<section class="content-card ai-results-card"><div class="card-heading"><div><h2>Editable test case spreadsheet</h2><p>Review the generated rows, edit cells, download an Excel-compatible CSV, or add them to the test library.</p></div><button class="secondary-button" type="button" data-clear-ai-chat>New chat</button></div><div id="ai-draft-results">${renderAiDraftTable()}</div></section>`;
}

function bugTools() {
  if (state.bugSavedId) {
    const bug = state.workspace.bugs.find((item) => item.id === state.bugSavedId);
    if (!bug) throw new Error(`Saved bug ${state.bugSavedId} was not found.`);
    return `
      <section class="content-card bug-saved-card" role="status">
        <span class="bug-saved-icon" aria-hidden="true">✓</span>
        <p class="section-kicker">BUG REPORT SAVED</p>
        <h2>${escapeHtml(bug.id)} · ${escapeHtml(bug.title)}</h2>
        <p>${state.bugSavedCount > 1 ? `${state.bugSavedCount} bug reports have` : "Your report has"} been saved to ${escapeHtml(activeProject().name)} with reproduction details and attachments.</p>
        <div class="bug-saved-actions">
          <button class="primary-button" type="button" data-bug-followup="add">+ Add another bug</button>
          <button class="secondary-button" type="button" data-bug-followup="view" data-bug-id="${escapeHtml(bug.id)}">View saved report</button>
        </div>
      </section>
    `;
  }
  return `
    <section class="content-card tools-card">
      <div class="card-heading"><div><h2>Report Bugs</h2><p>Each issue is saved to ${escapeHtml(activeProject().name)}.</p></div></div>
      <div class="tool-tabs">
        <button class="tool-tab ${state.bugMode === "create" ? "selected" : ""}" data-mode="create" type="button">Bug template</button>
        <button class="tool-tab ${state.bugMode === "bulk" ? "selected" : ""}" data-mode="bulk" type="button">Bulk add</button>
        <button class="tool-tab ${state.bugMode === "import" ? "selected" : ""}" data-mode="import" type="button">Import</button>
      </div>
      ${state.bugMode === "bulk" ? bulkBugCard() : state.bugMode === "import" ? importCard("bugs", "Import a CSV or JSON table with title,module,severity,status,assignee,description,stepsToReproduce,expectedResult,actualResult,testerComments,fixStatus,reportedBy.") : singleBugCard()}
    </section>
  `;
}

function bulkBugCard() {
  return `
    <form data-form="bulk-bugs" class="workspace-form">
      <div class="template-banner bug-template"><span>BUG</span><div><strong>Bulk bug template</strong><small>Each title becomes an assigned issue in this project.</small></div></div>
      <label>Bug titles <span class="field-hint">One bug per line. Shared details below are applied to each issue.</span><textarea name="lines" rows="3" placeholder="Checkout button does not respond&#10;Error message is unclear" required></textarea></label>
      <label>Module<input name="module" placeholder="e.g. Checkout" required /></label>
      <label>Description<textarea name="description" rows="2" placeholder="What is wrong?" required></textarea></label>
      <label>Steps to reproduce<textarea name="stepsToReproduce" rows="3" placeholder="1. Open checkout&#10;2. Enter a valid address&#10;3. Click Continue" required></textarea></label>
      <label>Expected result<textarea name="expectedResult" rows="2" placeholder="What should happen?" required></textarea></label>
      <label>Actual result<textarea name="actualResult" rows="2" placeholder="What actually happened?" required></textarea></label>
      <div class="form-row"><label>Priority<select name="severity"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option></select></label><label>Assign to<select name="assignee"><option>Developer</option><option>QA Test Engineer</option></select></label></div>
      <div class="form-row"><label>QA status<select name="status"><option selected>Open</option><option>In Progress</option><option>Fixed</option></select></label><label>Developer fix status<select name="fixStatus"><option selected>Not started</option><option>In progress</option><option>Fixed</option><option>Needs QA retest</option></select></label></div>
      <label>Tester comments<textarea name="testerComments" rows="2" placeholder="Optional notes for the QA/developer handoff"></textarea></label>
      <label>Attach screenshots (optional)<span class="field-hint">PNG, JPG or WEBP · up to 5 images, 900 KB each</span><input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Save bugs</button>
    </form>
  `;
}

function singleBugCard() {
  return `
    <form data-form="bug" class="workspace-form bug-report-form">
      <div class="template-banner bug-template"><span>BUG</span><div><strong>Standard bug report</strong><small>Capture clear reproduction details, priority and QA status for faster fixes.</small></div></div>
      <label class="bug-wide-field">Bug title<input name="title" placeholder="e.g. Checkout button does not respond" required /></label>
      <div class="form-row"><label>Module<input name="module" placeholder="e.g. Checkout" required /></label><label>Priority<select name="severity"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option></select></label></div>
      <label class="bug-wide-field">Description<textarea name="description" rows="2" placeholder="Describe the issue and its impact" required></textarea></label>
      <label class="bug-wide-field">Steps to reproduce<textarea name="stepsToReproduce" rows="3" placeholder="1. Open checkout&#10;2. Enter a valid address&#10;3. Click Continue" required></textarea></label>
      <div class="form-row"><label>Expected result<textarea name="expectedResult" rows="3" placeholder="What should happen?" required></textarea></label><label>Actual result<textarea name="actualResult" rows="3" placeholder="What actually happened?" required></textarea></label></div>
      <div class="form-row"><label>QA status<select name="status"><option selected>Open</option><option>In Progress</option><option>Fixed</option></select></label><label>Assign to<select name="assignee"><option>Developer</option><option>QA Test Engineer</option></select></label></div>
      <div class="form-row"><label>Developer fix status<select name="fixStatus"><option selected>Not started</option><option>In progress</option><option>Fixed</option><option>Needs QA retest</option></select></label><label>Reported by<input name="reportedBy" value="${escapeHtml(state.username || "QA Test Engineer")}" required /></label></div>
      <label class="bug-wide-field">Tester comments<textarea name="testerComments" rows="2" placeholder="Add test observations or retest notes (optional)"></textarea></label>
      <label class="bug-wide-field">Attach screenshots (optional)<span class="field-hint">PNG, JPG or WEBP · up to 5 images, 900 KB each</span><input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple data-image-input /></label>
      <div class="image-previews" data-previews></div>
      <p class="form-message" aria-live="polite"></p>
      <button class="primary-button" type="submit">+ Save bug report</button>
    </form>
  `;
}

function importCard(type, description) {
  if (type === "test-cases" && state.pendingImport?.type === type) {
    return renderImportPreview();
  }
  return `
    <div class="import-panel">
      <p class="import-description">${description}</p>
      ${type === "bugs" ? `<a class="bug-csv-template" download="qyntra-bug-template.csv" href="${bugCsvTemplateUrl()}">Download bug CSV template <span aria-hidden="true">↓</span></a>` : ""}
      ${type === "test-cases" ? `<a class="bug-csv-template" download="qyntra-test-case-template.csv" href="${testCaseCsvTemplateUrl()}">Download Excel test-case template <span aria-hidden="true">↓</span></a>` : ""}
      <form data-form="import-${type}" class="workspace-form">
        <label class="upload-zone"><span class="upload-symbol">⇧</span><strong>Choose a file to import</strong><small>Excel-compatible CSV or JSON · review and edit rows before saving</small><input type="file" data-import="${type}" accept="text/csv,.csv,.json" required /></label>
        <p class="form-message" aria-live="polite"></p>
        <button class="primary-button" type="submit">Review ${type === "bugs" ? "bugs" : "test cases"}</button>
      </form>
    </div>
  `;
}

function renderImportPreview() {
  const records = state.pendingImport.records;
  const fields = [
    ["title", "Test case"],
    ["featureName", "Feature"],
    ["preconditions", "Prerequisites"],
    ["testData", "Test data"],
    ["steps", "Steps"],
    ["expectedResult", "Expected result"],
  ];
  return `<section class="import-review"><div class="card-heading"><div><h2>Review imported test cases</h2><p>Edit each cell before adding ${records.length} case${records.length === 1 ? "" : "s"} to this project.</p></div></div><div class="bug-table-wrap import-preview-wrap"><table class="workspace-table import-preview-table"><thead><tr>${fields.map(([, label]) => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${records.map((record, index) => `<tr data-import-row="${index}">${fields.map(([field]) => `<td><textarea data-import-field="${field}" aria-label="${field} for imported row ${index + 1}" rows="3">${escapeHtml(field === "steps" ? record.steps.join("\n") : record[field] || "")}</textarea></td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="form-message import-review-message" aria-live="polite"></p><div class="bug-saved-actions"><button class="primary-button" type="button" data-save-import>+ Add reviewed cases</button><button class="secondary-button" type="button" data-import-ai>✦ Review with Gemini</button><button class="secondary-button" type="button" data-cancel-import>Choose another file</button></div></section>`;
}

function bugCsvTemplateUrl() {
  const csv = [
    "title,module,severity,status,assignee,description,stepsToReproduce,expectedResult,actualResult,testerComments,fixStatus,reportedBy",
    '"Checkout button does not respond","Checkout","High","Open","Developer","Checkout stops after address entry","1. Add an item to cart; 2. Enter an address; 3. Select checkout","Continue to payment","The button does not respond","Reproduced on desktop","Not started","QA Test Engineer"',
  ].join("\r\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function testCaseCsvTemplateUrl() {
  const csv = [
    "Feature Name,TestCase Name,Prerequisites,Test Data,Steps,Expected Result,Test Result",
    '"Authentication","Sign in with valid credentials","A registered account exists","Email and password","1. Open sign in; 2. Enter valid credentials; 3. Submit","The account home page is displayed","Not Run"',
  ].join("\r\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
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
  const button = action === "case" || action === "bug"
    ? `<button class="primary-button" data-action="Add New" data-add-type="${action}" type="button">+ Add New</button>`
    : `<button class="primary-button" data-open-modal="${action}" type="button">+ ${actionLabel}</button>`;
  return `<div class="welcome-row"><div><span class="section-kicker">QYNTRA WORKSPACE</span><h1>${title}</h1><p>${description}</p></div>${button}</div>`;
}

function newRecordPage() {
  const activeType = state.newRecordType;
  const options = activeType === "case"
    ? `${testCaseTools()}${state.testCaseMode === "ai" ? aiDraftCard() : ""}`
    : bugTools();
  const saved = state.newRecordSaved?.type === "case"
    ? `<section class="content-card bug-saved-card new-record-saved" role="status"><span class="bug-saved-icon" aria-hidden="true">✓</span><p class="section-kicker">TEST CASE${state.newRecordSaved.count > 1 ? "S" : ""} SAVED</p><h2>${escapeHtml(state.newRecordSaved.id)} · ${escapeHtml(state.newRecordSaved.title)}</h2><p>${state.newRecordSaved.count > 1 ? `${state.newRecordSaved.count} test cases were` : "Your test case was"} saved to ${escapeHtml(activeProject().name)}.</p><div class="bug-saved-actions"><button class="primary-button" type="button" data-new-record-followup="add">+ Add another</button><button class="secondary-button" type="button" data-new-record-followup="view">View test cases</button></div></section>`
    : "";
  return `
    <div class="welcome-row"><div><span class="section-kicker">QYNTRA WORKSPACE</span><h1>Add New</h1><p>Create one record, add several with a shared template, or import a CSV/JSON file.</p></div></div>
    <section class="new-record-page">
      <div class="new-record-type-switch" role="tablist" aria-label="Choose record type">
        <button class="new-record-type ${activeType === "bug" ? "selected" : ""}" type="button" role="tab" aria-selected="${activeType === "bug"}" data-new-record-type="bug"><span class="new-record-type-icon bug">!</span><span><strong>Bug report</strong><small>Reproduction, priority, QA status and screenshots</small></span><span class="new-record-type-arrow">→</span></button>
        <button class="new-record-type ${activeType === "case" ? "selected" : ""}" type="button" role="tab" aria-selected="${activeType === "case"}" data-new-record-type="case"><span class="new-record-type-icon case">✓</span><span><strong>Test case</strong><small>Steps, test data, expected results and runs</small></span><span class="new-record-type-arrow">→</span></button>
      </div>
      ${saved || options}
    </section>
  `;
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
  return `<section class="content-card"><div class="card-heading"><div><h2>${editable ? "All reported bugs" : "Developer issues"}</h2><p>${bugs.length} issue${bugs.length === 1 ? "" : "s"} · status can be updated here</p></div></div>${bugs.length ? `<div class="bug-table-wrap"><table class="bug-table"><thead><tr><th scope="col">Bug ID</th><th scope="col">Issue</th><th scope="col">Module</th><th scope="col">Priority</th><th scope="col">Assignee</th><th scope="col">Status</th></tr></thead><tbody>${bugs.map((bug) => bugTableRow(bug, editable)).join("")}</tbody></table></div>` : emptyState(emptyMessage)}</section>`;
}

function customDropdown(kind, value, options, ariaLabel, attributes = "") {
  return `<div class="custom-select ${kind === "bug-status" ? "status-select" : "filter-select"}" data-custom-select data-dropdown-kind="${kind}" data-value="${escapeHtml(value)}" ${attributes}><button class="custom-select-trigger" type="button" aria-label="${escapeHtml(ariaLabel)}" aria-haspopup="listbox" aria-expanded="false"><span class="custom-select-label">${escapeHtml(value)}</span><span class="custom-select-chevron" aria-hidden="true">⌄</span></button><div class="custom-select-menu" role="listbox" aria-label="${escapeHtml(ariaLabel)}" hidden>${options.map((option) => `<button class="custom-select-option ${option.value === value ? "selected" : ""}" type="button" role="option" aria-selected="${option.value === value}" data-dropdown-option="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span>${option.value === value ? '<span class="custom-select-check" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div></div>`;
}

const bugStatusOptions = ["Open", "In Progress", "Fixed"].map((status) => ({ value: status, label: status }));
const bugSeverityOptions = ["Critical", "High", "Medium", "Low"].map((severity) => ({ value: severity, label: `${severity} severity` }));

function bugTableRow(bug, editable = true) {
  const searchText = [bug.id, bug.title, bug.module, bug.assignee, bug.description].join(" ").toLowerCase();
  const severity = bug.severity || "Medium";
  return `
    <tr data-bug-entry data-search="${escapeHtml(searchText)}" data-status="${escapeHtml(bug.status)}" data-severity="${escapeHtml(bug.severity)}">
      <td><span class="bug-table-id">${escapeHtml(bug.id)}</span></td>
      <td><div class="bug-table-title"><strong>${escapeHtml(bug.title)}</strong><details class="record-details" id="bug-report-${escapeHtml(bug.id)}" ${state.viewBugId === bug.id ? "open" : ""}><summary>View report</summary><p><b>Description:</b> ${escapeHtml(bug.description || "Not provided")}</p><p><b>Steps:</b> ${escapeHtml(bug.stepsToReproduce || "Not provided")}</p><p><b>Expected:</b> ${escapeHtml(bug.expectedResult || "Not provided")}</p><p><b>Actual:</b> ${escapeHtml(bug.actualResult || "Not provided")}</p><p><b>Priority:</b> ${escapeHtml(bug.severity || "Medium")}</p><p><b>QA status:</b> ${escapeHtml(bug.status || "Open")}</p><p><b>Reported by:</b> ${escapeHtml(bug.reportedBy || "QA Test Engineer")}</p><p><b>Tester comments:</b> ${escapeHtml(bug.testerComments || "Not provided")}</p><p><b>Developer fix status:</b> ${escapeHtml(bug.fixStatus || "Not started")}</p><p><b>Developer comments:</b> ${escapeHtml(bug.developerComments || "Not provided")}</p>${attachmentStrip(bug.attachments)}</details></div></td>
      <td>${escapeHtml(bug.module || "—")}</td>
      <td><span class="severity ${escapeHtml(severity.toLowerCase())}">${escapeHtml(severity)}</span></td>
      <td>${escapeHtml(bug.assignee || "Unassigned")}</td>
      <td>${editable ? customDropdown("bug-status", bug.status || "Open", bugStatusOptions, `Update ${bug.id} status`, `data-bug-status="${escapeHtml(bug.id)}"`) : `<span class="bug-status ${statusClass(bug.status)}">${escapeHtml(bug.status)}</span>`}</td>
    </tr>
  `;
}

function bugTrackerContent(bugs) {
  const open = bugs.filter((bug) => bug.status === "Open").length;
  const inProgress = bugs.filter((bug) => bug.status === "In Progress").length;
  const highPriority = bugs.filter((bug) => bug.severity === "Critical" || bug.severity === "High").length;
  return `
    <section class="bug-tracker">
      <div class="bug-summary-grid" aria-label="Bug summary">
        <article class="bug-summary-card"><span class="bug-summary-icon total">#</span><div><span>Total issues</span><strong>${bugs.length}</strong></div></article>
        <article class="bug-summary-card"><span class="bug-summary-icon open">!</span><div><span>Open</span><strong>${open}</strong></div></article>
        <article class="bug-summary-card"><span class="bug-summary-icon progress">↻</span><div><span>In progress</span><strong>${inProgress}</strong></div></article>
        <article class="bug-summary-card"><span class="bug-summary-icon priority">↑</span><div><span>Critical &amp; high</span><strong>${highPriority}</strong></div></article>
      </div>
      <section class="content-card bug-tracker-card">
        <div class="bug-tracker-heading"><div><h2>All issues</h2><p>Search, review and update issues for ${escapeHtml(activeProject().name)}.</p></div><span class="bug-result-count" data-bug-result-count>${bugs.length} issues</span></div>
        <div class="bug-filter-bar">
          <label class="bug-search-field"><span class="sr-only">Search bugs</span><span aria-hidden="true">⌕</span><input type="search" data-bug-search placeholder="Search by title, ID, module..." value="${escapeHtml(state.bugSearch)}" /></label>
          <div class="bug-filter-dropdown" aria-label="Filter by status">${customDropdown("filter-status", state.bugStatusFilter, [{ value: "All statuses", label: "All statuses" }, ...bugStatusOptions], "Filter by status", 'data-bug-filter="status"')}</div>
          <div class="bug-filter-dropdown" aria-label="Filter by severity">${customDropdown("filter-severity", state.bugSeverityFilter, [{ value: "All severities", label: "All severities" }, ...bugSeverityOptions], "Filter by severity", 'data-bug-filter="severity"')}</div>
        </div>
        ${bugs.length ? `<div class="bug-table-wrap"><table class="bug-table"><thead><tr><th scope="col">Bug ID</th><th scope="col">Issue</th><th scope="col">Module</th><th scope="col">Severity</th><th scope="col">Assignee</th><th scope="col">Status</th></tr></thead><tbody>${bugs.map(bugTableRow).join("")}</tbody></table></div><p class="bug-filter-empty" data-bug-filter-empty hidden>No issues match these filters. Try a different search or filter.</p>` : emptyState("No bugs reported yet. Add your first issue to get started.")}
      </section>
    </section>
  `;
}

function applyBugFilters() {
  const search = document.querySelector("[data-bug-search]");
  const status = document.querySelector('[data-custom-select][data-bug-filter="status"]');
  const severity = document.querySelector('[data-custom-select][data-bug-filter="severity"]');
  if (!search || !status || !severity) return;

  state.bugSearch = search.value.trim().toLowerCase();
  state.bugStatusFilter = status.dataset.value;
  state.bugSeverityFilter = severity.dataset.value;
  const rows = Array.from(document.querySelectorAll("[data-bug-entry]"));
  let visibleCount = 0;
  rows.forEach((row) => {
    const matches = row.dataset.search.includes(state.bugSearch)
      && (state.bugStatusFilter === "All statuses" || row.dataset.status === state.bugStatusFilter)
      && (state.bugSeverityFilter === "All severities" || row.dataset.severity === state.bugSeverityFilter);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });
  const resultCount = document.querySelector("[data-bug-result-count]");
  resultCount.textContent = `${visibleCount} of ${rows.length} issue${rows.length === 1 ? "" : "s"}`;
  const empty = document.querySelector("[data-bug-filter-empty]");
  if (empty) empty.hidden = visibleCount > 0;
}

let dropdownOutsideHandlerInstalled = false;
const customDropdownMenus = new WeakMap();

function closeCustomDropdown(dropdown) {
  const menu = customDropdownMenus.get(dropdown);
  if (!menu) return;
  dropdown.classList.remove("is-open");
  dropdown.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
  menu.hidden = true;
}

function openCustomDropdown(dropdown) {
  document.querySelectorAll(".custom-select.is-open").forEach(closeCustomDropdown);
  const trigger = dropdown.querySelector(".custom-select-trigger");
  const menu = customDropdownMenus.get(dropdown);
  if (!menu) return;
  dropdown.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  menu.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuRect.width - 8));
  const top = Math.max(8, Math.min(triggerRect.bottom + 5, window.innerHeight - menuRect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.minWidth = `${triggerRect.width}px`;
  menu.querySelector('[aria-selected="true"]')?.focus();
}

function setupCustomDropdowns() {
  document.querySelectorAll("[data-custom-select]").forEach((dropdown) => {
    const trigger = dropdown.querySelector(".custom-select-trigger");
    const menu = dropdown.querySelector(".custom-select-menu");
    menu.dataset.portaled = "true";
    customDropdownMenus.set(dropdown, menu);
    document.body.append(menu);
    trigger.addEventListener("click", () => {
      if (dropdown.classList.contains("is-open")) {
        closeCustomDropdown(dropdown);
      } else {
        openCustomDropdown(dropdown);
      }
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCustomDropdown(dropdown);
      }
    });
    menu.querySelectorAll("[data-dropdown-option]").forEach((option) => {
      option.addEventListener("click", () => {
        dropdown.dataset.value = option.dataset.dropdownOption;
        trigger.querySelector(".custom-select-label").textContent = option.querySelector("span").textContent;
        menu.querySelectorAll("[data-dropdown-option]").forEach((item) => {
          const selected = item === option;
          item.classList.toggle("selected", selected);
          item.setAttribute("aria-selected", String(selected));
          item.querySelector(".custom-select-check")?.remove();
          if (selected) item.insertAdjacentHTML("beforeend", '<span class="custom-select-check" aria-hidden="true">✓</span>');
        });
        closeCustomDropdown(dropdown);
        if (dropdown.dataset.dropdownKind === "bug-status") {
          updateBugStatus(dropdown.dataset.bugStatus, dropdown.dataset.value);
        } else {
          applyBugFilters();
        }
      });
    });
    dropdown.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCustomDropdown(dropdown);
        trigger.focus();
      }
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCustomDropdown(dropdown);
        trigger.focus();
      }
    });
  });
  if (!dropdownOutsideHandlerInstalled) {
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-custom-select], .custom-select-menu")) {
        document.querySelectorAll(".custom-select.is-open").forEach(closeCustomDropdown);
      }
    });
    document.addEventListener("scroll", () => {
      document.querySelectorAll(".custom-select.is-open").forEach(closeCustomDropdown);
    }, true);
    dropdownOutsideHandlerInstalled = true;
  }
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
  for (const url of imagePreviewUrls.get(container) || []) URL.revokeObjectURL(url);
  container.replaceChildren();
  const urls = [];
  Array.from(input.files || []).forEach((file) => {
    const url = URL.createObjectURL(file);
    urls.push(url);
    const link = document.createElement("a");
    link.className = "image-preview-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = `Preview ${file.name}`;
    const image = document.createElement("img");
    image.src = url;
    image.alt = file.name;
    link.append(image);
    container.append(link);
  });
  imagePreviewUrls.set(container, urls);
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
        if (state.section === "Add New") {
          state.newRecordSaved = { type: "case", id: testCase.id, title: testCase.title, count: 1 };
        }
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
      if (state.section === "Add New") {
        state.newRecordSaved = { type: "case", id: ids[0], title: titles[0], count: ids.length };
      }
    } else if (form.dataset.form === "ai-cases") {
      const drafts = readAiDraftForm(form);
      const ids = nextIds("TC", state.workspace.testCases, drafts.length);
      state.workspace.testCases.unshift(...drafts.map((draft, index) => ({
        id: ids[index],
        projectId: state.activeProjectId,
        ...draft,
        module: draft.featureName,
        priority: draft.priority || "Medium",
        status: draft.testResult || "Not Run",
        attachments: state.aiAttachments,
      })));
      if (state.section === "Add New") {
        state.newRecordSaved = { type: "case", id: ids[0], title: drafts[0].title, count: ids.length };
      }
      state.aiAttachments = [];
      state.aiDrafts = [];
      state.aiChatMessages = [];
      state.aiChatHistory = [];
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
        status: values.status,
        fixStatus: values.fixStatus,
        reportedBy: state.username || "QA Test Engineer",
        testerComments: values.testerComments.trim(),
        description: values.description.trim(),
        stepsToReproduce: values.stepsToReproduce.trim(),
        expectedResult: values.expectedResult.trim(),
        actualResult: values.actualResult.trim(),
        attachments,
      })));
      state.bugSavedId = ids[0];
      state.bugSavedCount = ids.length;
    } else if (form.dataset.form === "bug") {
      const attachments = await readImageAttachments(form.elements.images.files);
      const bug = {
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
        status: values.status,
        fixStatus: values.fixStatus,
        reportedBy: values.reportedBy.trim(),
        testerComments: values.testerComments.trim(),
        attachments,
      };
      state.workspace.bugs.unshift(bug);
      state.bugSavedId = bug.id;
      state.bugSavedCount = 1;
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
    if (form.dataset.form !== "bug" && form.dataset.form !== "bulk-bugs") state.modal = "";
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
      ? {
        id: "",
        projectId: state.activeProjectId,
        title,
        module,
        severity: normalizeChoice(record.severity || record.priority, ["Critical", "High", "Medium", "Low"], "Medium"),
        assignee: normalizeChoice(record.assignee, ["Developer", "QA Test Engineer"], "Developer"),
        status: normalizeChoice(record.status, ["Open", "In Progress", "Fixed"], "Open"),
        description: String(record.description || "").trim(),
        stepsToReproduce: String(record.stepsToReproduce || ""),
        expectedResult: String(record.expectedResult || ""),
        actualResult: String(record.actualResult || ""),
        testerComments: String(record.testerComments || ""),
        fixStatus: normalizeChoice(record.fixStatus === "Needs retest" ? "Needs QA retest" : record.fixStatus, ["Not started", "In progress", "Fixed", "Needs QA retest"], "Not started"),
        reportedBy: capitalizeQa(String(record.reportedBy || "QA Test Engineer").trim()),
        developerComments: String(record.developerComments || ""),
        attachments: [],
      }
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
        steps: Array.isArray(record.steps)
          ? record.steps.map(String)
          : splitLines(record.steps || "Review the feature"),
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
  if (!isBugImport) {
    state.pendingImport = { type: "test-cases", records: normalized };
    state.aiChatMessages = [];
    state.aiChatHistory = [];
    state.aiDrafts = [];
    state.section = "Add New";
    state.newRecordType = "case";
    state.testCaseMode = "import";
    state.modal = "";
    renderDashboard();
    return;
  }
  const ids = nextIds(isBugImport ? "BUG" : "TC", isBugImport ? state.workspace.bugs : state.workspace.testCases, normalized.length);
  normalized.forEach((record, index) => { record.id = ids[index]; });
  if (isBugImport) {
    state.workspace.bugs.unshift(...normalized);
    state.bugSavedId = ids[0];
    state.bugSavedCount = ids.length;
  } else {
    state.workspace.testCases.unshift(...normalized);
    if (state.section === "Add New") {
      state.newRecordSaved = { type: "case", id: ids[0], title: normalized[0].title, count: ids.length };
    }
  }
  state.modal = "";
  saveWorkspace();
  renderDashboard();
}

function readAiDraftForm(form) {
  const drafts = Array.from(form.querySelectorAll("[data-ai-case-index]"), (row) => {
    const value = (field) => row.querySelector(`[data-ai-field="${field}"]`).value.trim();
    return {
      ...state.aiDrafts[Number(row.dataset.aiCaseIndex)],
      featureName: value("featureName") || "General",
      title: value("title"),
      preconditions: value("preconditions"),
      testData: value("testData"),
      steps: splitLines(value("steps")),
      expectedResult: value("expectedResult"),
    };
  });
  if (!drafts.length) throw new Error("Generate at least one test case before adding it.");
  if (drafts.some((draft) => !draft.title || !draft.expectedResult)) {
    throw new Error("Each test case needs a title and expected result.");
  }
  state.aiDrafts = drafts;
  return drafts;
}

function saveImportedTestCases() {
  const review = document.querySelector(".import-review");
  const message = review.querySelector(".import-review-message");
  try {
    const rows = Array.from(review.querySelectorAll("[data-import-row]"));
    const records = rows.map((row) => {
      const record = { ...state.pendingImport.records[Number(row.dataset.importRow)] };
      row.querySelectorAll("[data-import-field]").forEach((field) => {
        const name = field.dataset.importField;
        record[name] = name === "steps" ? splitLines(field.value) : field.value.trim();
      });
      return record;
    });
    if (!records.length || records.some((record) => !record.title || !record.expectedResult || !record.steps.length)) {
      throw new Error("Every imported case needs a title, steps, and expected result.");
    }
    const ids = nextIds("TC", state.workspace.testCases, records.length);
    const saved = records.map((record, index) => ({
      ...record,
      id: ids[index],
      projectId: state.activeProjectId,
      module: record.featureName || "General",
      testResult: record.testResult || "Not Run",
      status: record.testResult || "Not Run",
      attachments: [],
    }));
    state.workspace.testCases.unshift(...saved);
    state.newRecordSaved = state.section === "Add New"
      ? { type: "case", id: ids[0], title: saved[0].title, count: ids.length }
      : null;
    state.pendingImport = null;
    saveWorkspace();
    renderDashboard();
  } catch (error) {
    message.textContent = error.message || "Could not save the imported test cases.";
    message.classList.add("error");
  }
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
    reportedby: "reportedBy",
    fixstatus: "fixStatus",
    priority: "priority",
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

function renderAiMessages() {
  return state.aiChatMessages.map((message) => `<div class="ai-chat-message ${message.role === "user" ? "user" : "assistant"}"><strong>${message.role === "user" ? "You" : "Gemini"}</strong><p>${escapeHtml(message.text)}</p>${message.images?.length ? `<div class="ai-chat-attachments">${message.images.map((image) => `<span class="preview-file">▧ ${escapeHtml(image.name)}</span>`).join("")}</div>` : ""}</div>`).join("")
    || `<div class="ai-chat-empty">Start a conversation with Gemini. Attach a screen image and ask for a QA test-case spreadsheet.</div>`;
}

function renderAiDraftTable() {
  if (!state.aiDrafts.length) return `<div class="ai-chat-empty">Generated test cases will appear here for review and editing.</div>`;
  const fields = [
    ["featureName", "Feature"],
    ["title", "Test case"],
    ["preconditions", "Prerequisites"],
    ["testData", "Test data"],
    ["steps", "Steps"],
    ["expectedResult", "Expected result"],
  ];
  return `<div class="ai-spreadsheet-actions"><span>${state.aiDrafts.length} editable test cases</span><button class="secondary-button" type="button" data-download-ai-cases>Download Excel CSV</button></div><div class="bug-table-wrap ai-spreadsheet-wrap"><form data-form="ai-cases" class="workspace-form ai-spreadsheet-form"><table class="workspace-table ai-spreadsheet"><thead><tr>${fields.map(([, label]) => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${state.aiDrafts.map((draft, index) => `<tr data-ai-case-index="${index}">${fields.map(([field]) => `<td><textarea data-ai-field="${field}" aria-label="${field} for test case ${index + 1}" rows="3" ${field === "title" ? "required" : ""}>${escapeHtml(field === "steps" ? draft.steps.join("\n") : draft[field] || "")}</textarea></td>`).join("")}</tr>`).join("")}</tbody></table><p class="form-message" aria-live="polite"></p><button class="primary-button" type="submit">+ Add reviewed cases to Test Cases</button></form></div>`;
}

async function sendGeminiMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const promptInput = form.querySelector("#ai-prompt");
  const imageInput = form.querySelector("#ai-images");
  const result = form.querySelector(".ai-result");
  const prompt = promptInput.value.trim();
  if (!prompt) {
    result.textContent = "Enter a message for Gemini first.";
    result.classList.add("error");
    return;
  }
  if (state.aiChatHistory.length >= 12) {
    result.textContent = "Start a new Gemini chat to continue; the current conversation has reached its context limit.";
    result.classList.add("error");
    return;
  }
  const sendButton = form.querySelector("#generate-ai-cases");
  sendButton.disabled = true;
  result.textContent = "Gemini is reviewing your request...";
  result.classList.remove("error");
  try {
    const attachments = await readImageAttachments(imageInput.files);
    const response = await fetch("/api/generate-test-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        images: attachments.map((image) => image.data),
        history: state.aiChatHistory,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Gemini could not respond. Please try again.");
    if (!Array.isArray(payload.testCases)) throw new Error("Gemini returned an invalid test-case response.");
    const assistantMessage = String(payload.assistantMessage || "I reviewed your request. You can refine the test cases or save the current spreadsheet.");
    const caseContext = payload.testCases.map((testCase) => ({
      featureName: testCase.featureName,
      title: testCase.title,
      preconditions: testCase.preconditions,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
    }));
    const assistantContext = `${assistantMessage}\nCurrent generated test cases: ${JSON.stringify(caseContext)}`.slice(0, 3_900);
    state.aiChatHistory.push({ role: "user", text: prompt }, { role: "model", text: assistantContext });
    state.aiChatMessages.push({ role: "user", text: prompt, images: attachments }, { role: "assistant", text: assistantMessage });
    if (payload.testCases.length) {
      state.aiDrafts = payload.testCases.map((draft) => ({
        title: String(draft.title || "").trim(),
        featureName: String(draft.featureName || "General"),
        testResult: String(draft.testResult || "Not Run"),
        priority: String(draft.priority || "Medium"),
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
    }
    state.aiAttachments = attachments;
    state.aiPromptDraft = "";
    promptInput.value = "";
    imageInput.value = "";
    showImagePreviews(imageInput);
    document.querySelector("#ai-chat-messages").innerHTML = renderAiMessages();
    const results = document.querySelector("#ai-draft-results");
    results.innerHTML = renderAiDraftTable();
    const draftsForm = results.querySelector('form[data-form="ai-cases"]');
    if (draftsForm) draftsForm.addEventListener("submit", handleFormSubmit);
    results.querySelector("[data-download-ai-cases]")?.addEventListener("click", downloadAiCases);
    result.textContent = state.aiDrafts.length
      ? `${state.aiDrafts.length} test cases are ready in the editable spreadsheet.`
      : "Gemini replied. Add a request for test cases whenever you are ready.";
    document.querySelector("#ai-chat-messages")?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    result.textContent = error instanceof TypeError
      ? "Could not reach Gemini. Start the Qyntra server at http://localhost:8080 and check its internet connection."
      : error.message;
    result.classList.add("error");
  } finally {
    sendButton.disabled = false;
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadAiCases() {
  const spreadsheetForm = document.querySelector("#ai-draft-results form[data-form='ai-cases']");
  if (spreadsheetForm) readAiDraftForm(spreadsheetForm);
  const headers = ["Feature Name", "TestCase Name", "Prerequisites", "Test Data", "Steps", "Expected Result", "Test Result", "Actual Result", "Bug Description", "Tester Comments", "Developer Comments", "Fix status IT1", "Test Result IT2", "Fix status IT2", "Test Result IT3"];
  const rows = state.aiDrafts.map((draft) => [
    draft.featureName, draft.title, draft.preconditions, draft.testData, draft.steps.join("\n"), draft.expectedResult,
    draft.testResult || "Not Run", draft.actualResult || "Not run", draft.bugDescription, draft.testerComments,
    draft.developerComments, draft.fixStatusIT1, draft.testResultIT2, draft.fixStatusIT2, draft.testResultIT3,
  ]);
  const csv = `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "qyntra-gemini-test-cases.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function notesCard() {
  const notes = projectItems("notes");
  const rows = notes.map((note) => `<tr><td><span class="record-table-id">${escapeHtml(note.date || "—")}</span></td><td><strong>${escapeHtml(note.title)}</strong></td><td class="note-table-body">${escapeHtml(note.body)}</td><td>${escapeHtml(note.author || "—")}</td></tr>`).join("");
  return `<section class="content-card"><div class="card-heading"><div><h2>${escapeHtml(activeProject().name)} notes</h2><p>${notes.length} notes in this project</p></div></div>${notes.length ? `<div class="bug-table-wrap"><table class="workspace-table"><thead><tr><th scope="col">Date</th><th scope="col">Title</th><th scope="col">Note</th><th scope="col">Added by</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("Add a note to share useful testing context with this project.")}</section>`;
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
  const icons = { Overview: "home", "Add New": "plus", "Test Cases": "cases", Bugs: "bugs", "Assigned Bugs": "queue", "Test Plans": "plans", Notes: "notes", Projects: "home" };
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
