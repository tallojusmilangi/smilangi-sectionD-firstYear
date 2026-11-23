(() => {
  const API = (window.CAMPUS_CONFIG?.apiBaseUrl || "http://localhost:5000").replace(/\/+$/, "");
  const $ = (selector) => document.querySelector(selector);
  const grid = $("#eventsGrid");
  const status = $("#apiStatus");
  const eventDialog = $("#eventDialog");
  const profileDialog = $("#profileDialog");
  const toast = $("#toast");
  let events = [];
  let activeView = "events";
  let toastTimer;

  function notify(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function userId() { return localStorage.getItem("campus-user-id") || ""; }

  function setConnection(connected) {
    status.innerHTML = `<i></i> ${connected ? "Connected" : "API unavailable"}`;
    status.classList.toggle("connected", connected);
    status.classList.toggle("error", !connected);
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function eventCard(event, index) {
    const closed = ["closed", "full", "cancelled", "canceled"].includes(String(event.status || "").toLowerCase());
    const seatText = event.capacity == null ? "Capacity not listed" : `${escapeHtml(event.capacity)} ${Number(event.capacity) === 1 ? "seat" : "seats"}`;
    return `<article class="event-card" tabindex="0" role="button" data-event-id="${escapeHtml(event.id)}" aria-label="View ${escapeHtml(event.title)}">
      <div class="card-top"><span class="event-mark">${["✳", "◌", "⌁", "✦"][index % 4]}</span><span class="status-pill ${closed ? "closed" : ""}">${escapeHtml(event.status || "Campus event")}</span></div>
      <h3>${escapeHtml(event.title || "Untitled event")}</h3><div class="event-meta">Campus event <span>·</span> Hosted by campus</div>
      <div class="card-bottom"><span class="capacity"><strong>${seatText}</strong></span><span class="card-link">↗</span></div>
    </article>`;
  }

  async function loadEvents() {
    grid.innerHTML = '<div class="loading-card"><span class="spinner"></span> Finding what’s happening…</div>';
    const statusFilter = $("#statusFilter").value;
    const query = new URLSearchParams({ limit: "100" });
    if (statusFilter) query.set("status", statusFilter);
    try {
      const result = await api(`/api/events?${query}`);
      events = result.data || [];
      setConnection(true);
      renderEvents();
    } catch (error) {
      events = [];
      setConnection(false);
      grid.innerHTML = `<div class="empty-card"><span class="empty-icon">⌁</span><strong>We can’t reach your campus yet.</strong><span>${escapeHtml(error.message)}<br>Check the Render API URL and its CORS setting.</span></div>`;
      $("#eventCount").textContent = "0";
    }
  }

  function renderEvents() {
    const term = $("#searchInput").value.trim().toLowerCase();
    const visible = events.filter((event) => String(event.title || "").toLowerCase().includes(term));
    $("#eventCount").textContent = String(visible.length);
    grid.innerHTML = visible.length
      ? visible.map(eventCard).join("")
      : '<div class="empty-card"><span class="empty-icon">✳</span><strong>No events found just yet.</strong><span>Try another search or check back soon.</span></div>';
    grid.querySelectorAll(".event-card").forEach((card) => {
      const open = () => showEvent(card.dataset.eventId);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
  }

  async function showEvent(id) {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    const closed = ["closed", "full", "cancelled", "canceled"].includes(String(event.status || "").toLowerCase());
    $("#dialogContent").innerHTML = `<div class="dialog-art">✳</div><p class="eyebrow muted-eyebrow">CAMPUS EVENT</p><h2>${escapeHtml(event.title || "Event details")}</h2><p class="dialog-copy">A chance to try something new, meet someone interesting, and make campus feel a little more like yours.</p><div class="event-facts"><span class="fact">Status · ${escapeHtml(event.status || "Listed")}</span><span class="fact">Capacity · ${event.capacity == null ? "Not listed" : escapeHtml(event.capacity)}</span></div><button class="primary-button" id="registerButton" ${closed ? "disabled" : ""}>${closed ? "Registration unavailable" : "Save my spot"} <span>→</span></button>`;
    eventDialog.showModal();
    $("#registerButton").addEventListener("click", () => {
      if (!userId()) { eventDialog.close(); openProfile(); notify("Add your user ID to register."); return; }
      registerForEvent(event.id);
    });
  }

  async function registerForEvent(eventId) {
    const button = $("#registerButton");
    if (button) { button.disabled = true; button.textContent = "Saving your spot…"; }
    try {
      await api("/api/registrations", { method: "POST", body: JSON.stringify({ user_id: userId(), event_id: eventId }) });
      eventDialog.close();
      notify("You’re registered. See you there!");
    } catch (error) {
      if (button) { button.disabled = false; button.innerHTML = 'Save my spot <span>→</span>'; }
      notify(error.message, true);
    }
  }

  async function loadRegistrations() {
    const panel = $("#registrationsPanel");
    panel.classList.remove("hidden");
    grid.classList.add("hidden");
    $("#eventToolbar").classList.add("hidden");
    if (!userId()) {
      panel.innerHTML = '<div class="empty-card"><span class="empty-icon">▤</span><strong>Add your user ID to see registrations.</strong><span>Tap your profile circle at the top right to enter it.</span><button class="outline-button" id="addUserButton">Add user ID</button></div>';
      $("#addUserButton").addEventListener("click", openProfile);
      return;
    }
    panel.innerHTML = '<div class="loading-card"><span class="spinner"></span> Finding your registrations…</div>';
    try {
      const result = await api(`/api/me/registrations?user_id=${encodeURIComponent(userId())}`);
      const registrations = result.data || [];
      panel.innerHTML = registrations.length ? registrations.map((row) => {
        const title = row.events?.title || "Campus event";
        const created = row.created_at ? new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Registered";
        return `<article class="registration-row"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(created)}</p></div><span class="registration-status">Registered</span></article>`;
      }).join("") : '<div class="empty-card"><span class="empty-icon">✳</span><strong>Your next campus moment is out there.</strong><span>You haven’t registered for an event yet.</span><button class="outline-button" id="browseButton">Browse events</button></div>';
      $("#browseButton")?.addEventListener("click", () => setView("events"));
    } catch (error) {
      panel.innerHTML = `<div class="empty-card"><strong>Couldn’t load registrations.</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function setView(view) {
    activeView = view;
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    const eventsView = view === "events";
    $("#crumb").textContent = eventsView ? "Discover" : "My registrations";
    $("#pageTitle").innerHTML = eventsView ? 'Find your <em>people.</em>' : 'Your campus <em>moments.</em>';
    $("#pageIntro").textContent = eventsView ? "Good things happen when you show up. Find what’s happening on campus and save your spot." : "The plans you made, all in one place. Your next good campus story starts here.";
    $("#sectionTitle").innerHTML = eventsView ? 'Events for you <span id="eventCount" class="count-pill">—</span>' : "Your registrations";
    $("#eventToolbar").classList.toggle("hidden", !eventsView);
    grid.classList.toggle("hidden", !eventsView);
    $("#registrationsPanel").classList.toggle("hidden", eventsView);
    if (eventsView) loadEvents(); else loadRegistrations();
  }

  function openProfile() {
    $("#userIdInput").value = userId();
    $("#profileFeedback").textContent = "";
    profileDialog.showModal();
  }

  $("#profileButton").addEventListener("click", openProfile);
  $("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#userIdInput").value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      $("#profileFeedback").textContent = "Enter a valid user UUID.";
      return;
    }
    localStorage.setItem("campus-user-id", id);
    $("#profileButton").textContent = "✓";
    profileDialog.close();
    notify("User ID saved on this device.");
    if (activeView === "registrations") loadRegistrations();
  });
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#searchInput").addEventListener("input", renderEvents);
  $("#statusFilter").addEventListener("change", loadEvents);
  $("#refreshButton").addEventListener("click", activeView === "events" ? loadEvents : loadRegistrations);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#searchInput").focus(); }
  });
  if (userId()) $("#profileButton").textContent = "✓";
  loadEvents();
})();
