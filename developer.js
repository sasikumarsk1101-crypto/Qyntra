const app = document.querySelector("#developer-app");
const STORAGE_KEY = "qyntra-workspace-v1";
const FIX_STATUSES = ["Not started", "In progress", "Fixed", "Needs QA retest"];
let activeProjectId = "";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function brand() {
  return `<a class="brand" href="index.html" aria-label="Qyntra home"><span class="brand-mark">Q</span><span>Qyntra</span></a>`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function renderLogin(message = "") {
  app.innerHTML = `
    <section class="developer-login-screen">
      <div class="developer-login-card">
        ${brand()}
        <span class="developer-kicker">DEVELOPER WORKSPACE</span>
        <h1>Developer sign in</h1>
        <p>Review bugs assigned to the development team and keep QA updated on every fix.</p>
        <form id="developer-login-form">
          <div class="field"><label for="developer-username">Username</label><input id="developer-username" name="username" autocomplete="username" required /></div>
          <div class="field"><label for="developer-password">Password</label><input id="developer-password" name="password" type="password" autocomplete="current-password" required /></div>
          <p class="developer-login-error" id="developer-login-error" role="alert">${escapeHtml(message)}</p>
          <button class="primary-button developer-submit" type="submit">Sign in to Developer workspace <span>→</span></button>
        </form>
        <a class="developer-back-link" href="index.html">← Back to QA sign in</a>
      </div>
    </section>`;

  document.querySelector("#developer-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    const error = document.querySelector("#developer-login-error");
    button.disabled = true;
    button.textContent = "Signing in...";
    error.textContent = "";
    try {
      await api("/api/developer-login", {
        method: "POST",
        body: JSON.stringify({
          username: String(form.get("username") || "").trim(),
          password: String(form.get("password") || ""),
        }),
      });
      await loadPortal();
    } catch (exception) {
      error.textContent = exception.message;
      button.disabled = false;
      button.innerHTML = 'Sign in to Developer workspace <span>→</span>';
    }
  });
}

function loadWorkspace() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { projects: [], bugs: [] };
  const data = JSON.parse(saved);
  if (!data || !Array.isArray(data.projects) || !Array.isArray(data.bugs)) {
    throw new Error("Saved Qyntra workspace data is invalid. Open the QA workspace and check the saved project data.");
  }
  return data;
}

function renderBug(bug) {
  const attachments = (bug.attachments || []).map((file) => {
    const data = file.data || file.dataUrl || "";
    if (data.startsWith("data:image/")) {
      return `<a class="developer-attachment" href="${escapeHtml(data)}" target="_blank" rel="noopener" aria-label="View ${escapeHtml(file.name)}"><img src="${escapeHtml(data)}" alt="${escapeHtml(file.name)}" /></a>`;
    }
    if (data) {
      return `<a class="developer-attachment-link" href="${escapeHtml(data)}" download="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>`;
    }
    return "";
  }).join("");
  const savedFixStatus = bug.fixStatus === "Needs retest" ? "Needs QA retest" : bug.fixStatus;
  const fixStatus = FIX_STATUSES.includes(savedFixStatus) ? savedFixStatus : "Not started";
  const status = ["Open", "In Progress", "Fixed"].includes(bug.status) ? bug.status : "Open";
  return `
    <article class="developer-bug-card">
      <header class="developer-bug-heading">
        <div class="developer-bug-title">
          <span class="developer-bug-icon" aria-hidden="true">🐞</span>
          <div><h3>${escapeHtml(bug.title || "Untitled bug")}</h3><span class="developer-bug-meta">${escapeHtml(bug.id)} · ${escapeHtml(bug.module || "General")}</span></div>
        </div>
        <span class="developer-severity">${escapeHtml(bug.severity || "Medium")} severity</span>
      </header>
      <div class="developer-bug-details">
        <p class="developer-detail"><strong>Description</strong>${escapeHtml(bug.description || "Not provided")}</p>
        <p class="developer-detail"><strong>Steps to reproduce</strong>${escapeHtml(bug.stepsToReproduce || "Not provided")}</p>
        <p class="developer-detail"><strong>Expected result</strong>${escapeHtml(bug.expectedResult || "Not provided")}</p>
        <p class="developer-detail"><strong>Actual result</strong>${escapeHtml(bug.actualResult || "Not provided")}</p>
        <p class="developer-detail"><strong>Priority</strong>${escapeHtml(bug.severity || "Medium")}</p>
        <p class="developer-detail"><strong>Reported by</strong>${escapeHtml(bug.reportedBy || "QA Test Engineer")}</p>
        <p class="developer-detail"><strong>Tester comments</strong>${escapeHtml(bug.testerComments || "Not provided")}</p>
        ${attachments ? `<div class="developer-detail"><strong>Attachments</strong><div class="developer-attachments">${attachments}</div></div>` : ""}
      </div>
      <form class="developer-update-form" data-bug-id="${escapeHtml(bug.id)}">
        <label>Bug status
          <select name="status">${["Open", "In Progress", "Fixed"].map((value) => `<option ${status === value ? "selected" : ""}>${value}</option>`).join("")}</select>
        </label>
        <label>Fix status
          <select name="fixStatus">${FIX_STATUSES.map((value) => `<option ${fixStatus === value ? "selected" : ""}>${value}</option>`).join("")}</select>
        </label>
        <label>Developer comments
          <textarea name="developerComments" maxlength="3000" placeholder="Share the fix details or anything QA should retest...">${escapeHtml(bug.developerComments || "")}</textarea>
        </label>
        <button class="developer-save-button" type="submit">Save update</button>
        <p class="developer-save-message" aria-live="polite"></p>
      </form>
    </article>`;
}

function renderPortal(username) {
  let data;
  try {
    data = loadWorkspace();
  } catch (exception) {
    app.innerHTML = `<div class="developer-main"><p class="developer-error">${escapeHtml(exception.message)}</p></div>`;
    return;
  }
  if (!data.projects.some((project) => project.id === activeProjectId)) {
    activeProjectId = data.projects[0]?.id || "";
  }
  const project = data.projects.find((item) => item.id === activeProjectId);
  const needsQaData = data.projects.length === 0;
  const assigned = data.bugs.filter((bug) => bug.assignee === "Developer");
  const visibleBugs = assigned.filter((bug) => !activeProjectId || bug.projectId === activeProjectId);
  const openCount = visibleBugs.filter((bug) => bug.status !== "Fixed").length;
  const fixedCount = visibleBugs.filter((bug) => bug.status === "Fixed").length;

  app.innerHTML = `
    <header class="developer-header">
      ${brand()}
      <div class="developer-header-actions"><span class="developer-user">Signed in as ${escapeHtml(username)}</span><button class="developer-logout" id="developer-logout" type="button">Sign out</button></div>
    </header>
    <main class="developer-main">
      <section class="developer-hero">
        <div><span class="developer-kicker">QYNTRA · DEVELOPER</span><h1>Bug resolution workspace</h1><p>Review QA reports, update fixes, and send clear feedback to the test team.</p></div>
        <label class="developer-filter">Project
          <select id="developer-project" ${needsQaData ? "disabled" : ""}>${needsQaData ? `<option value="">No projects loaded</option>` : data.projects.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === activeProjectId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>
        </label>
      </section>
      ${needsQaData ? `<section class="developer-data-notice" role="status"><div><strong>QA project data isn’t loaded at this address yet.</strong><p>QA and Developer pages share data only when both use the same address and port. If QA is open at a different port (for example, 8080), that data won’t appear here.</p><p>Open QA below using this same address and port, sign in, then return here. Projects will refresh automatically when QA data is saved.</p></div><a class="developer-open-qa" href="/" target="_blank" rel="noopener">Open QA on this server <span>→</span></a></section>` : ""}
      <section class="developer-stats" aria-label="Bug totals">
        <article class="developer-stat"><span>Assigned bugs</span><strong>${visibleBugs.length}</strong></article>
        <article class="developer-stat"><span>Needs attention</span><strong>${openCount}</strong></article>
        <article class="developer-stat"><span>Fixed</span><strong>${fixedCount}</strong></article>
      </section>
      <div class="developer-section-heading"><div><h2>${escapeHtml(project?.name || "Assigned bugs")}</h2><p>QA reports assigned to the development team.</p></div></div>
      <section class="developer-bug-list">
        ${visibleBugs.length ? visibleBugs.map(renderBug).join("") : `<div class="developer-empty">${needsQaData ? "No QA project data is available at this server address yet." : assigned.length ? "There are no bugs assigned to Developer in this project." : "No bugs are assigned to Developer yet. When QA assigns a bug to Developer, it will appear here."}</div>`}
      </section>
    </main>`;

  document.querySelector("#developer-project").addEventListener("change", (event) => {
    activeProjectId = event.currentTarget.value;
    renderPortal(username);
  });
  document.querySelector("#developer-logout").addEventListener("click", async () => {
    await api("/api/developer-logout", { method: "POST", body: "{}" });
    renderLogin();
  });
  document.querySelectorAll(".developer-update-form").forEach((form) => {
    form.addEventListener("submit", (event) => saveBugUpdate(event, username));
  });
}

function saveBugUpdate(event, username) {
  event.preventDefault();
  const form = event.currentTarget;
  const bugId = form.dataset.bugId;
  const saveMessage = form.querySelector(".developer-save-message");
  try {
    const data = loadWorkspace();
    const bug = data.bugs.find((item) => item.id === bugId && item.assignee === "Developer");
    if (!bug) throw new Error("This bug is no longer assigned to Developer. Refresh the workspace and try again.");
    const values = new FormData(form);
    bug.status = String(values.get("status") || "Open");
    bug.fixStatus = String(values.get("fixStatus") || "Not started");
    bug.developerComments = String(values.get("developerComments") || "").trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveMessage.textContent = "Update saved. The QA report will show these changes.";
    window.setTimeout(() => renderPortal(username), 700);
  } catch (exception) {
    saveMessage.textContent = exception.message;
    saveMessage.style.color = "#a22e2e";
  }
}

async function loadPortal() {
  try {
    const session = await api("/api/developer-session");
    if (!session.authenticated) {
      renderLogin();
      return;
    }
    renderPortal(session.username);
  } catch (exception) {
    app.innerHTML = `<section class="developer-login-screen"><div class="developer-login-card">${brand()}<h1>Developer portal unavailable</h1><p>${escapeHtml(exception.message)} Start the Qyntra Java server and open this page from http://localhost:8080.</p><a class="developer-back-link" href="index.html">← Back to QA sign in</a></div></section>`;
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  api("/api/developer-session")
    .then((session) => {
      if (session.authenticated) renderPortal(session.username);
    })
    .catch((exception) => {
      app.innerHTML = `<div class="developer-main"><p class="developer-error">${escapeHtml(exception.message)}</p></div>`;
    });
});

loadPortal();
