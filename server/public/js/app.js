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

  document.getElementById('date-badge-day').textContent = d.getDate();
  document.getElementById('date-badge-month').textContent = d
    .toLocaleDateString('ro-RO', { month: 'short' })
    .replace('.', '');

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

const participantsState = {
  q: '',
  team: '',
  role: '',
  sortBy: 'registeredAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
  searchDebounce: null,
};
let allParticipantsCache = [];

function renderParticipants(list) {
  const tbody = document.getElementById('participants-body');
  tbody.innerHTML = '';

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'state-row';
    tr.innerHTML = '<td colspan="6">Niciun participant găsit.</td>';
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
      <td class="organizer-only" ${organizerKey ? '' : 'hidden'}>${escapeHtml(p.email)}</td>
      <td>${p.team ? `<span class="chip">${escapeHtml(p.team)}</span>` : '—'}</td>
      <td>${p.role ? `<span class="badge-role" data-role="${escapeHtml(p.role)}">${escapeHtml(p.role)}</span>` : '—'}</td>
      <td>${escapeHtml(new Date(p.registeredAt).toLocaleDateString('ro-RO'))}</td>
    `;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'organizer-only';
    actionsTd.hidden = !organizerKey;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'text-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Editează participantul ${p.name}`);
    editBtn.addEventListener('click', () => openEditParticipant(p));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'text-btn danger';
    delBtn.textContent = 'Șterge';
    delBtn.setAttribute('aria-label', `Șterge participantul ${p.name}`);
    delBtn.addEventListener('click', () =>
      confirmDelete(`Ștergi participantul ${p.name}?`, () => deleteParticipant(p.id))
    );

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'table-actions';
    actionsWrap.append(editBtn, delBtn);
    actionsTd.appendChild(actionsWrap);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }
}

function updateSortIndicators() {
  document.querySelectorAll('#participants-table th.sortable').forEach((th) => {
    if (th.dataset.sort === participantsState.sortBy) {
      th.dataset.dir = participantsState.sortDir;
    } else {
      delete th.dataset.dir;
    }
  });
}

function renderPagination({ page, totalPages, total }) {
  document.getElementById('participants-page-info').textContent =
    total === 0 ? '0 rezultate' : `Pagina ${page} din ${totalPages} (${total} rezultate)`;
  document.getElementById('participants-prev-btn').disabled = page <= 1;
  document.getElementById('participants-next-btn').disabled = page >= totalPages;
}

function buildParticipantsFilterParams() {
  const params = new URLSearchParams();
  if (participantsState.q) params.set('q', participantsState.q);
  if (participantsState.team) params.set('team', participantsState.team);
  if (participantsState.role) params.set('role', participantsState.role);
  params.set('sortBy', participantsState.sortBy);
  params.set('sortDir', participantsState.sortDir);
  return params;
}

async function loadParticipants() {
  const params = buildParticipantsFilterParams();
  params.set('page', participantsState.page);
  params.set('pageSize', participantsState.pageSize);
  try {
    const data = await api(`/participants?${params.toString()}`);
    renderParticipants(data.items);
    renderPagination(data);
    updateSortIndicators();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Separate, unfiltered fetch: feeds the "înscriși" count and the team-filter
// dropdown's options, independent of the current search/filter/page.
async function refreshParticipantsMeta() {
  try {
    allParticipantsCache = await api('/participants');
    document.getElementById('participant-count').textContent = allParticipantsCache.length;

    const teamSelect = document.getElementById('participants-team-filter');
    const current = teamSelect.value;
    const teams = [...new Set(allParticipantsCache.map((p) => p.team).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    teamSelect.innerHTML = '<option value="">Toate echipele</option>';
    for (const team of teams) {
      const opt = document.createElement('option');
      opt.value = team;
      opt.textContent = team;
      teamSelect.appendChild(opt);
    }
    if (teams.includes(current)) {
      teamSelect.value = current;
    } else if (current) {
      // The team filter's value disappeared (its last participant was
      // removed/edited) — fall back to "all" so the dropdown and state agree.
      participantsState.team = '';
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function refreshParticipants() {
  await Promise.all([loadParticipants(), refreshParticipantsMeta()]);
  if (organizerKey) loadStats();
}

document.getElementById('participants-search').addEventListener('input', (e) => {
  clearTimeout(participantsState.searchDebounce);
  participantsState.searchDebounce = setTimeout(() => {
    participantsState.q = e.target.value;
    participantsState.page = 1;
    loadParticipants();
  }, 300);
});

document.getElementById('participants-team-filter').addEventListener('change', (e) => {
  participantsState.team = e.target.value;
  participantsState.page = 1;
  loadParticipants();
});

document.getElementById('participants-role-filter').addEventListener('change', (e) => {
  participantsState.role = e.target.value;
  participantsState.page = 1;
  loadParticipants();
});

document.getElementById('participants-page-size').addEventListener('change', (e) => {
  participantsState.pageSize = Number(e.target.value);
  participantsState.page = 1;
  loadParticipants();
});

document.getElementById('participants-prev-btn').addEventListener('click', () => {
  if (participantsState.page > 1) {
    participantsState.page -= 1;
    loadParticipants();
  }
});

document.getElementById('participants-next-btn').addEventListener('click', () => {
  participantsState.page += 1;
  loadParticipants();
});

document.querySelectorAll('#participants-table th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    if (participantsState.sortBy === field) {
      participantsState.sortDir = participantsState.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      participantsState.sortBy = field;
      participantsState.sortDir = 'asc';
    }
    participantsState.page = 1;
    loadParticipants();
  });
});

document.getElementById('participants-export-btn').addEventListener('click', async () => {
  try {
    const params = buildParticipantsFilterParams();
    const res = await fetch(`/api/participants/export?${params.toString()}`, {
      headers: organizerKey ? { 'x-organizer-key': organizerKey } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data && data.error) || `Eroare ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'participanti.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    showToast('Export CSV generat.');
  } catch (err) {
    showToast(err.message, true);
  }
});

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
    await refreshParticipants();
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
    await refreshParticipants();
  } catch (err) {
    showToast(err.message, true);
  }
});

async function deleteParticipant(id) {
  try {
    await api(`/participants/${id}`, { method: 'DELETE' });
    showToast('Participant șters.');
    await refreshParticipants();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Stats panel (organizer-only) ----------
function renderBarList(entries) {
  if (!entries.length) return '<p class="state-row">Fără date.</p>';
  const max = Math.max(...entries.map((e) => e.count), 1);
  return entries
    .map(
      (e) => `
        <div class="chart-row">
          <span class="chart-label" title="${escapeHtml(e.label)}">${escapeHtml(e.label)}</span>
          <span class="chart-bar-track">
            <span class="chart-bar-fill" style="width:${((e.count / max) * 100).toFixed(1)}%"></span>
          </span>
          <span class="chart-count">${e.count}</span>
        </div>`
    )
    .join('');
}

function renderStats(stats) {
  const grid = document.getElementById('stats-grid');
  const byDayEntries = stats.byDay.map((d) => ({ label: d.date, count: d.count }));

  grid.innerHTML = `
    <div class="stat-card">
      <h3>Total participanți</h3>
      <div class="stat-total">${stats.total}</div>
    </div>
    <div class="stat-card">
      <h3>Înscrieri pe zi</h3>
      ${renderBarList(byDayEntries)}
    </div>
    <div class="stat-card">
      <h3>Distribuție pe rol</h3>
      ${renderBarList(stats.byRole)}
    </div>
    <div class="stat-card">
      <h3>Distribuție pe echipă</h3>
      ${renderBarList(stats.byTeam)}
    </div>
  `;
}

async function loadStats() {
  if (!organizerKey) return;
  try {
    const stats = await api('/participants/stats');
    renderStats(stats);
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
    article.classList.toggle('pinned', Boolean(a.pinned));

    const head = document.createElement('div');
    head.className = 'announcement-head';
    const tag = document.createElement('span');
    tag.className = 'announcement-tag';
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = '#anunț';
    const h3 = document.createElement('h3');
    h3.textContent = a.title;
    head.append(tag, h3);
    if (a.pinned) {
      const badge = document.createElement('span');
      badge.className = 'pin-badge';
      badge.textContent = '📌 Fixat';
      head.appendChild(badge);
    }

    const small = document.createElement('small');
    small.textContent = relativeTime(a.updatedAt);
    small.title = new Date(a.updatedAt).toLocaleString('ro-RO');

    const p = document.createElement('p');
    p.textContent = a.content;

    article.append(head, small, p);

    if (organizerKey) {
      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'btn-ghost';
      pinBtn.textContent = a.pinned ? 'Anulează fixarea' : 'Fixează';
      pinBtn.addEventListener('click', () => togglePin(a));

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-ghost';
      editBtn.textContent = 'Editează';
      editBtn.addEventListener('click', () => openEditAnnouncement(a));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-ghost danger';
      delBtn.textContent = 'Șterge';
      delBtn.addEventListener('click', () =>
        confirmDelete(`Ștergi anunțul "${a.title}"?`, () => deleteAnnouncement(a.id))
      );

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'announcement-actions';
      actionsWrap.append(pinBtn, editBtn, delBtn);
      article.appendChild(actionsWrap);
    }

    li.appendChild(article);
    ul.appendChild(li);
  }
}

async function togglePin(a) {
  try {
    await api(`/announcements/${a.id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pinned: !a.pinned }),
    });
    showToast(a.pinned ? 'Anunț anulat din fixare.' : 'Anunț fixat.');
    renderAnnouncements(await api('/announcements'));
  } catch (err) {
    showToast(err.message, true);
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
    ? 'Ieși din cont'
    : 'Acces echipă';
}

document.getElementById('organizer-toggle').addEventListener('click', () => {
  if (organizerKey) {
    organizerKey = null;
    sessionStorage.removeItem(ORGANIZER_KEY_STORAGE);
    applyOrganizerVisibility();
    loadAll();
    showToast('Te-ai delogat din cont.');
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
    showToast('Autentificat ca echipă Liga AC.');
  } else {
    showToast('Email sau parolă greșite.', true);
  }
});

// ---------- Live updates (SSE) ----------
// Browser tabs subscribe via EventSource and refetch whichever resource
// changed, instead of polling. EventSource reconnects on its own if the
// connection drops — onopen/onerror just drive the header's status pill.
function setLiveStatus(connected) {
  document.getElementById('live-pill').classList.toggle('is-connected', connected);
}

function initLiveUpdates() {
  const source = new EventSource('/api/stream');

  source.addEventListener('open', () => setLiveStatus(true));
  source.addEventListener('error', () => setLiveStatus(false));
  source.addEventListener('update', async (e) => {
    let type;
    try {
      type = JSON.parse(e.data).type;
    } catch {
      return;
    }
    try {
      if (type === 'event') {
        renderEvent(await api('/event'));
      } else if (type === 'participants') {
        await refreshParticipants();
      } else if (type === 'announcements') {
        renderAnnouncements(await api('/announcements'));
      }
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ---------- Init ----------
document.getElementById('retry-load-btn').addEventListener('click', () => loadAll());

async function loadAll() {
  const errorBanner = document.getElementById('load-error');
  errorBanner.hidden = true;
  document.body.classList.add('is-loading');

  try {
    const [event, announcements] = await Promise.all([api('/event'), api('/announcements')]);
    renderEvent(event);
    renderAnnouncements(announcements);
    await refreshParticipants();
  } catch (err) {
    errorBanner.hidden = false;
    showToast(err.message, true);
  } finally {
    document.body.classList.remove('is-loading');
  }
}

applyOrganizerVisibility();
loadAll();
initLiveUpdates();
