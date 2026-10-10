
const $ = (id) => document.getElementById(id);

const KEYS = {
  events: "sfEvents",
  participants: "sfParticipants",
  profile: "sfProfile"
};

function loadData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    notify("Unable to save. Check your browser storage.");
    return false;
  }
}

let events = loadData(KEYS.events);
let participants = loadData(KEYS.participants);
let selectedCategory = "Workshop";
let currentUser = "";
let toastTimer;

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function localDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}


$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !password) {
    notify("Please enter your email and password.");
    return;
  }

  currentUser = email.split("@")[0];

  const profile = loadProfile();
  if (profile.email !== email) {
    profile.email = email;
    profile.name = currentUser;
    saveProfile(profile);
  }

  updateProfileUI();
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");

  renderAll();
  showPage("dashboardPage");
  notify("Demo login successful.");
});

function logout() {
  currentUser = "";
  $("app").classList.add("hidden");
  $("auth").classList.remove("hidden");
  $("loginForm").reset();
}

$("logoutBtn").addEventListener("click", logout);
$("profileLogoutBtn").addEventListener("click", logout);


function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.go === pageId);
  });

  if (pageId === "dashboardPage") renderDashboard();
  if (pageId === "eventsPage") renderEvents();
  if (pageId === "participantsPage") renderParticipants();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    showPage(button.dataset.go);
  });
});

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;

    document.querySelectorAll("[data-category]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });
  });
});


$("eventForm").addEventListener("submit", event => {
  event.preventDefault();

  const newEvent = {
    id: makeId(),
    name: $("eventName").value.trim(),
    date: $("eventDate").value,
    time: $("eventTime").value,
    venue: $("eventVenue").value.trim(),
    capacity: Number($("eventCapacity").value),
    category: selectedCategory,
    description: $("eventDescription").value.trim()
  };

  if (
    !newEvent.name ||
    !newEvent.date ||
    !newEvent.time ||
    !newEvent.venue ||
    !Number.isInteger(newEvent.capacity) ||
    newEvent.capacity < 1
  ) {
    notify("Please complete all required fields.");
    return;
  }

  if (newEvent.date < localDateString()) {
    if (!confirm("This event is in the past. Save it anyway?")) {
      return;
    }
  }

  events.push(newEvent);

  if (!saveData(KEYS.events, events)) {
    events.pop();
    return;
  }

  event.target.reset();
  selectedCategory = "Workshop";

  document.querySelectorAll("[data-category]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.category === selectedCategory
    );
  });

  renderAll();

  $("successTitle").textContent = "Event Created!";
  $("successMessage").textContent =
    `${newEvent.name} has been saved successfully.`;

  showPage("successPage");
});


function dateParts(dateString) {
  if (!dateString) return { day: "--", month: "---" };

  const date = new Date(`${dateString}T12:00:00`);

  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleString("en-US", { month: "short" }).toUpperCase()
  };
}

function formatTime(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";

  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function countParticipants(eventId) {
  return participants.filter(person => person.eventId === eventId).length;
}


function eventCard(event, allowDelete = false) {
  const date = dateParts(event.date);
  const past = event.date < localDateString();
  const registered = countParticipants(event.id);
  const full = registered >= event.capacity;

  return `
    <article class="event-card">
      <div class="date-box">
        <strong>${date.day}</strong>
        <small>${date.month}</small>
      </div>

      <div class="event-info">
        <h4>${escapeHTML(event.name)}</h4>
        <p>▦ ${escapeHTML(event.category)}</p>
        <p>⌖ ${escapeHTML(event.venue)}</p>
        <p>◷ ${escapeHTML(formatTime(event.time))}</p>
        <p>Participants: ${registered}/${event.capacity}</p>
      </div>

      <div class="event-side">
        <span class="status ${past || full ? "past" : ""}">
          ${past ? "Past" : full ? "Full" : "Scheduled"}
        </span>

        ${allowDelete ? `
          <button class="delete-btn"
            data-delete="${escapeHTML(event.id)}">Delete</button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderDashboard() {
  const upcoming = events
    .filter(event => event.date >= localDateString())
    .sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time)
    );

  $("eventCount").textContent = upcoming.length;
  $("participantCount").textContent = participants.length;

  $("venueCount").textContent = new Set(
    events.map(event => event.venue.trim().toLowerCase())
  ).size;

  $("dashboardEvents").innerHTML = upcoming.length
    ? upcoming.slice(0, 5).map(event => eventCard(event)).join("")
    : `<div class="empty-state">
         No upcoming events yet.<br>
         Create your first event to get started.
       </div>`;
}


function renderEvents() {
  const query = $("eventSearch").value.trim().toLowerCase();

  const filtered = events
    .filter(event =>
      [event.name, event.venue, event.category, event.description]
        .some(value =>
          String(value || "").toLowerCase().includes(query)
        )
    )
    .sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time)
    );

  $("allEvents").innerHTML = filtered.length
    ? filtered.map(event => eventCard(event, true)).join("")
    : `<div class="empty-state">
         No events found.<br>
         Try another search or create an event.
       </div>`;
}

$("eventSearch").addEventListener("input", renderEvents);


$("allEvents").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  if (!confirm("Delete this event and its registrations?")) return;

  const id = button.dataset.delete;
  const previousEvents = events;
  const previousParticipants = participants;

  events = events.filter(item => item.id !== id);
  participants = participants.filter(person => person.eventId !== id);

  if (
    saveData(KEYS.events, events) &&
    saveData(KEYS.participants, participants)
  ) {
    renderAll();
    notify("Event deleted successfully.");
  } else {
    events = previousEvents;
    participants = previousParticipants;
    saveData(KEYS.events, events);
    saveData(KEYS.participants, participants);
    renderAll();
  }
});


function renderEventOptions() {
  const select = $("participantEvent");
  const previousValue = select.value;

  select.innerHTML = '<option value="">Choose an event</option>';

  events
    .filter(event => event.date >= localDateString())
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(event => {
      const option = document.createElement("option");
      option.value = event.id;

      const full = countParticipants(event.id) >= event.capacity;
      option.textContent =
        `${event.name} — ${event.date}${full ? " (Full)" : ""}`;
      option.disabled = full;

      select.appendChild(option);
    });

  if ([...select.options].some(option =>
    option.value === previousValue && !option.disabled
  )) {
    select.value = previousValue;
  }
}

$("participantForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("participantName").value.trim();
  const email = $("participantEmail").value.trim().toLowerCase();
  const eventId = $("participantEvent").value;
  const selectedEvent = events.find(item => item.id === eventId);

  if (!name || !email || !selectedEvent) {
    notify("Please complete all registration fields.");
    return;
  }

  if (selectedEvent.date < localDateString()) {
    notify("Registration is closed for past events.");
    return;
  }

  if (countParticipants(eventId) >= selectedEvent.capacity) {
    notify("This event has reached its capacity.");
    renderEventOptions();
    return;
  }

  const duplicate = participants.some(person =>
    person.eventId === eventId &&
    person.email.toLowerCase() === email
  );

  if (duplicate) {
    notify("This email is already registered for the event.");
    return;
  }

  const participant = {
    id: makeId(),
    name,
    email,
    eventId,
    registeredAt: new Date().toISOString()
  };

  participants.push(participant);

  if (!saveData(KEYS.participants, participants)) {
    participants.pop();
    return;
  }

  event.target.reset();
  renderAll();

  $("successTitle").textContent = "Registration Successful!";
  $("successMessage").textContent =
    `${name} has been registered for ${selectedEvent.name}.`;

  showPage("successPage");
});


function renderParticipants() {
  renderEventOptions();

  const query = $("participantSearch").value.trim().toLowerCase();

  const filtered = participants.filter(person => {
    const event = events.find(item => item.id === person.eventId);
    return (
      person.name.toLowerCase().includes(query) ||
      person.email.toLowerCase().includes(query) ||
      (event && event.name.toLowerCase().includes(query))
    );
  });

  $("participantList").innerHTML = filtered.length
    ? filtered.map(person => {
        const event = events.find(item => item.id === person.eventId);

        return `
          <article class="event-card">
            <div class="user-circle">
              ${escapeHTML(person.name.charAt(0).toUpperCase())}
            </div>
            <div class="event-info">
              <h4>${escapeHTML(person.name)}</h4>
              <p>${escapeHTML(person.email)}</p>
              <p>Event: ${escapeHTML(event?.name || "Event unavailable")}</p>
            </div>
            <div class="event-side">
              <button class="delete-btn"
                data-remove-participant="${escapeHTML(person.id)}">
                Remove
              </button>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="empty-state">
         No participants found.<br>
         Register a participant to get started.
       </div>`;
}

$("participantSearch").addEventListener("input", renderParticipants);

$("participantList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-participant]");
  if (!button) return;

  if (!confirm("Remove this participant's registration?")) return;

  const previous = participants;
  participants = participants.filter(
    person => person.id !== button.dataset.removeParticipant
  );

  if (saveData(KEYS.participants, participants)) {
    renderAll();
    renderParticipants();
    notify("Participant removed.");
  } else {
    participants = previous;
  }
});


function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.profile) || "{}");
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(KEYS.profile, JSON.stringify(profile));
    return true;
  } catch {
    notify("Unable to save profile.");
    return false;
  }
}

function updateProfileUI() {
  const profile = loadProfile();
  const email = profile.email || "";
  const name = profile.name || currentUser || "User";

  $("dashboardName").textContent = name;
  $("userInitial").textContent = name.charAt(0).toUpperCase() || "U";
  $("profileAvatar").textContent = name.charAt(0).toUpperCase() || "U";
  $("profileName").value = name;
  $("profileEmail").value = email;
}

$("saveProfileBtn").addEventListener("click", () => {
  const name = $("profileName").value.trim();

  if (!name) {
    notify("Please enter a display name.");
    return;
  }

  const profile = loadProfile();
  profile.name = name;

  if (saveProfile(profile)) {
    updateProfileUI();
    notify("Display name saved.");
  }
});


function renderAll() {
  renderDashboard();
  renderEvents();
  renderEventOptions();
  renderParticipants();
}


renderAll();
