const ORGANIZER_KEY_STORAGE = 'ligaac_organizer_key';
const THEME_STORAGE = 'ligaac_theme';
let organizerKey = sessionStorage.getItem(ORGANIZER_KEY_STORAGE) || null;
let eventDate = null;
let countdownInterval = null;
let pendingConfirmAction = null;

// ---------- Theme ----------
function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

applyTheme(localStorage.getItem(THEME_STORAGE));

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || (prefersDark() ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE, next);
});

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
  const opener = document.activeElement;

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    // Fallback for browsers without <dialog> support: showModal() (and its
    // built-in focus trap + Escape handling) isn't available, so provide a
    // minimal manual trap instead.
    dialog.setAttribute('open', '');
    trapFocus(dialog);
  }

  requestAnimationFrame(() => centerElement(dialog));

  dialog.addEventListener(
    'close',
    () => {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    },
    { once: true }
  );
}

function trapFocus(dialog) {
  const focusable = dialog.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      dialog.close();
    } else if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  dialog.addEventListener('keydown', handleKeydown);
  dialog.addEventListener(
    'close',
    () => dialog.removeEventListener('keydown', handleKeydown),
    { once: true }
  );
}

window.addEventListener('resize', () => {
  document.querySelectorAll('dialog[open]').forEach(centerElement);
  const toast = document.getElementById('toast');
  if (toast && !toast.hidden) centerToast(toast);
});

let toastTimer = null;
let toastHideTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle('toast-error', isError);
  centerToast(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toastHideTimer = setTimeout(() => {
      toast.hidden = true;
    }, 220);
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
  // One sr-only live region with the full sentence (for assistive tech),
  // plus four decorative number boxes (aria-hidden) that only sighted users see.
  const liveEl = document.getElementById('countdown');
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minEl = document.getElementById('cd-min');
  const secEl = document.getElementById('cd-sec');
  const pad = (n) => String(n).padStart(2, '0');

  function tick() {
    const diffMs = eventDate.getTime() - Date.now();
    if (diffMs <= 0) {
      liveEl.textContent = 'Evenimentul a început!';
      daysEl.textContent = hoursEl.textContent = minEl.textContent = secEl.textContent = '00';
      clearInterval(countdownInterval);
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    daysEl.textContent = pad(days);
    hoursEl.textContent = pad(hours);
    minEl.textContent = pad(minutes);
    secEl.textContent = pad(seconds);
    liveEl.textContent = `${days}z ${hours}h ${minutes}m ${seconds}s`;
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
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 60% 42%)`;
}

function renderParticipants(list) {
  document.getElementById('participant-count').textContent = list.length;
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'state-row';
    tr.innerHTML = '<td colspan="5">Niciun participant înscris încă.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const p of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="participant-cell">
          <span class="avatar" style="background:${avatarColor(p.name)}">${escapeHtml(initials(p.name))}</span>
          <span>${escapeHtml(p.name)}</span>
        </div>
      </td>
      <td>${escapeHtml(p.email)}</td>
      <td>${p.team ? `<span class="chip">${escapeHtml(p.team)}</span>` : '—'}</td>
      <td>${p.role ? `<span class="badge-role" data-role="${escapeHtml(p.role)}">${escapeHtml(p.role)}</span>` : '—'}</td>
    `;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'organizer-only';
    actionsTd.hidden = !organizerKey;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'text-btn';
    editBtn.textContent = 'edit';
    editBtn.setAttribute('aria-label', `Editează participantul ${p.name}`);
    editBtn.addEventListener('click', () => openEditParticipant(p));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'text-btn danger';
    delBtn.textContent = 'del';
    delBtn.setAttribute('aria-label', `Șterge participantul ${p.name}`);
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
function relativeTime(dateStr) {
  const diffMin = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'chiar acum';
  if (diffMin < 60) return `acum ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `acum ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `acum ${diffD} zile`;
  return new Date(dateStr).toLocaleDateString('ro-RO');
}

function renderAnnouncements(list) {
  const ul = document.getElementById('announcements-list');
  ul.innerHTML = '';

  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'state-row';
    li.textContent = 'Niciun anunț publicat momentan.';
    ul.appendChild(li);
    return;
  }

  for (const a of list) {
    const li = document.createElement('li');
    const article = document.createElement('article');

    const head = document.createElement('div');
    head.className = 'announcement-head';
    const tag = document.createElement('span');
    tag.className = 'announcement-tag';
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = '#anunț';
    const h3 = document.createElement('h3');
    h3.textContent = a.title;
    head.append(tag, h3);

    const small = document.createElement('small');
    small.textContent = relativeTime(a.updatedAt);
    small.title = new Date(a.updatedAt).toLocaleString('ro-RO');

    const p = document.createElement('p');
    p.textContent = a.content;

    article.append(head, small, p);

    if (organizerKey) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-ghost';
      editBtn.textContent = 'editează';
      editBtn.addEventListener('click', () => openEditAnnouncement(a));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'șterge';
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
document.getElementById('retry-load-btn').addEventListener('click', () => loadAll());

async function loadAll() {
  const errorBanner = document.getElementById('load-error');
  errorBanner.hidden = true;
  document.body.classList.add('is-loading');

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
    errorBanner.hidden = false;
    showToast(err.message, true);
  } finally {
    document.body.classList.remove('is-loading');
  }
}

applyOrganizerVisibility();
loadAll();
