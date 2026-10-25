const ORGANIZER_KEY_STORAGE = 'ligaac_organizer_key';
let organizerKey = sessionStorage.getItem(ORGANIZER_KEY_STORAGE) || null;
let eventDate = null;
let countdownInterval = null;
let pendingConfirmAction = null;

// ---------- API helper ----------
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (organizerKey) headers['x-organizer-key'] = organizerKey;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Eroare ${res.status}`);
  return data;
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// ---------- Programmatic centering ----------
// Deliberately not relying on CSS margin:auto / flex centering: this computes
// the position from the element's own measured size and the viewport size,
// the way you would for an element whose dimensions aren't known up front.
function centerElement(el) {
  el.style.position = 'fixed';
  const rect = el.getBoundingClientRect();
  const left = Math.max(0, (window.innerWidth - rect.width) / 2);
  const top = Math.max(0, (window.innerHeight - rect.height) / 2);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function centerToast(toast) {
  toast.style.position = 'fixed';
  const rect = toast.getBoundingClientRect();
  const left = Math.max(0, (window.innerWidth - rect.width) / 2);
  toast.style.left = `${left}px`;
  toast.style.top = '16px';
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  requestAnimationFrame(() => centerElement(dialog));
}

window.addEventListener('resize', () => {
  document.querySelectorAll('dialog[open]').forEach(centerElement);
  const toast = document.getElementById('toast');
  if (toast && !toast.hidden) centerToast(toast);
});

let toastTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle('toast-error', isError);
  centerToast(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

// ---------- Event section ----------
function renderEvent(event) {
  document.getElementById('event-name').textContent = event.name;
  document.getElementById('event-description').textContent = event.description;
  document.getElementById('event-location').textContent = event.location;

  const dateEl = document.getElementById('event-date');
  const d = new Date(event.date);
  dateEl.dateTime = event.date;
  dateEl.textContent = d.toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' });

  eventDate = d;
  startCountdown();
}

function startCountdown() {
  clearInterval(countdownInterval);
  const el = document.getElementById('countdown');

  function tick() {
    const diffMs = eventDate.getTime() - Date.now();
    if (diffMs <= 0) {
      el.textContent = 'Evenimentul a început!';
      clearInterval(countdownInterval);
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    el.textContent = `${days}z ${hours}h ${minutes}m ${seconds}s`;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

document.getElementById('edit-event-btn').addEventListener('click', () => {
  if (!eventDate) return;
  document.getElementById('edit-event-name').value = document.getElementById('event-name').textContent;
  document.getElementById('edit-event-date').value = toLocalInputValue(eventDate);
  document.getElementById('edit-event-location').value = document.getElementById('event-location').textContent;
  document.getElementById('edit-event-description').value = document.getElementById('event-description').textContent;
  openDialog(document.getElementById('edit-event-dialog'));
});

document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('edit-event-name').value,
    date: new Date(document.getElementById('edit-event-date').value).toISOString(),
    location: document.getElementById('edit-event-location').value,
    description: document.getElementById('edit-event-description').value,
  };
  try {
    const event = await api('/event', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('edit-event-dialog').close();
    renderEvent(event);
    showToast('Eveniment actualizat.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Participants section ----------
function renderParticipants(list) {
  document.getElementById('participant-count').textContent = list.length;
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  for (const p of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.email)}</td>
      <td>${escapeHtml(p.team || '—')}</td>
      <td>${escapeHtml(p.role || '—')}</td>
    `;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'organizer-only';
    actionsTd.hidden = !organizerKey;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Editează';
    editBtn.addEventListener('click', () => openEditParticipant(p));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Șterge';
    delBtn.addEventListener('click', () =>
      confirmDelete(`Ștergi participantul ${p.name}?`, () => deleteParticipant(p.id))
    );

    actionsTd.append(editBtn, delBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.name.value,
    email: form.email.value,
    team: form.team.value,
    role: form.role.value,
  };
  try {
    await api('/participants', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    showToast('Te-ai înscris cu succes!');
    renderParticipants(await api('/participants'));
  } catch (err) {
    showToast(err.message, true);
  }
});

function openEditParticipant(p) {
  document.getElementById('edit-participant-id').value = p.id;
  document.getElementById('edit-participant-name').value = p.name;
  document.getElementById('edit-participant-email').value = p.email;
  document.getElementById('edit-participant-team').value = p.team || '';
  document.getElementById('edit-participant-role').value = p.role || '';
  openDialog(document.getElementById('edit-participant-dialog'));
}

document.getElementById('edit-participant-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-participant-id').value;
  const payload = {
    name: document.getElementById('edit-participant-name').value,
    email: document.getElementById('edit-participant-email').value,
    team: document.getElementById('edit-participant-team').value,
    role: document.getElementById('edit-participant-role').value,
  };
  try {
    await api(`/participants/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('edit-participant-dialog').close();
    showToast('Participant actualizat.');
    renderParticipants(await api('/participants'));
  } catch (err) {
    showToast(err.message, true);
  }
});

async function deleteParticipant(id) {
  try {
    await api(`/participants/${id}`, { method: 'DELETE' });
    showToast('Participant șters.');
    renderParticipants(await api('/participants'));
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Announcements section ----------
function renderAnnouncements(list) {
  const ul = document.getElementById('announcements-list');
  ul.innerHTML = '';

  for (const a of list) {
    const li = document.createElement('li');
    const article = document.createElement('article');

    const h3 = document.createElement('h3');
    h3.textContent = a.title;

    const p = document.createElement('p');
    p.textContent = a.content;

    const small = document.createElement('small');
    small.textContent = new Date(a.updatedAt).toLocaleString('ro-RO');

    article.append(h3, small, p);

    if (organizerKey) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Editează';
      editBtn.addEventListener('click', () => openEditAnnouncement(a));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Șterge';
      delBtn.addEventListener('click', () =>
        confirmDelete(`Ștergi anunțul "${a.title}"?`, () => deleteAnnouncement(a.id))
      );

      article.append(editBtn, delBtn);
    }

    li.appendChild(article);
    ul.appendChild(li);
  }
}

document.getElementById('announcement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/announcements', {
      method: 'POST',
      body: JSON.stringify({ title: form.title.value, content: form.content.value }),
    });
    form.reset();
    showToast('Anunț publicat.');
    renderAnnouncements(await api('/announcements'));
  } catch (err) {
    showToast(err.message, true);
  }
});

function openEditAnnouncement(a) {
  document.getElementById('edit-announcement-id').value = a.id;
  document.getElementById('edit-announcement-title').value = a.title;
  document.getElementById('edit-announcement-content').value = a.content;
  openDialog(document.getElementById('edit-announcement-dialog'));
}

document.getElementById('edit-announcement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-announcement-id').value;
  try {
    await api(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: document.getElementById('edit-announcement-title').value,
        content: document.getElementById('edit-announcement-content').value,
      }),
    });
    document.getElementById('edit-announcement-dialog').close();
    showToast('Anunț actualizat.');
    renderAnnouncements(await api('/announcements'));
  } catch (err) {
    showToast(err.message, true);
  }
});

async function deleteAnnouncement(id) {
  try {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    showToast('Anunț șters.');
    renderAnnouncements(await api('/announcements'));
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Confirm dialog (shared by participants & announcements) ----------
function confirmDelete(message, action) {
  document.getElementById('confirm-message').textContent = message;
  pendingConfirmAction = action;
  openDialog(document.getElementById('confirm-dialog'));
}

document.getElementById('confirm-yes').addEventListener('click', () => {
  document.getElementById('confirm-dialog').close();
  if (pendingConfirmAction) pendingConfirmAction();
  pendingConfirmAction = null;
});

// ---------- Dialog close buttons ----------
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).close();
  });
});

// ---------- Organizer mode ----------
function applyOrganizerVisibility() {
  document.querySelectorAll('.organizer-only').forEach((el) => {
    el.hidden = !organizerKey;
  });
  document.getElementById('organizer-toggle').textContent = organizerKey
    ? 'Delogare organizator'
    : 'Login organizator';
}

document.getElementById('organizer-toggle').addEventListener('click', () => {
  if (organizerKey) {
    organizerKey = null;
    sessionStorage.removeItem(ORGANIZER_KEY_STORAGE);
    applyOrganizerVisibility();
    loadAll();
    showToast('Delogat din modul organizator.');
  } else {
    openDialog(document.getElementById('organizer-dialog'));
  }
});

document.getElementById('organizer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = document.getElementById('organizer-key').value;
  const result = await api('/organizer/verify', {
    method: 'POST',
    body: JSON.stringify({ key }),
  }).catch(() => ({ ok: false }));

  if (result && result.ok) {
    organizerKey = key;
    sessionStorage.setItem(ORGANIZER_KEY_STORAGE, key);
    document.getElementById('organizer-dialog').close();
    document.getElementById('organizer-form').reset();
    applyOrganizerVisibility();
    loadAll();
    showToast('Autentificat ca organizator.');
  } else {
    showToast('Cheie invalidă.', true);
  }
});

// ---------- Init ----------
async function loadAll() {
  try {
    const [event, participants, announcements] = await Promise.all([
      api('/event'),
      api('/participants'),
      api('/announcements'),
    ]);
    renderEvent(event);
    renderParticipants(participants);
    renderAnnouncements(announcements);
  } catch (err) {
    showToast(err.message, true);
  }
}

applyOrganizerVisibility();
loadAll();
