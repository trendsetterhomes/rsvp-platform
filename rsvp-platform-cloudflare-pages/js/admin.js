(function () {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  let allGuests = [];

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function checkAuth() {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    if (data.isAdmin) {
      showApp();
    } else {
      loginScreen.classList.remove('hidden');
      appScreen.classList.add('hidden');
    }
  }

  document.getElementById('login-btn').addEventListener('click', doLogin);
  loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    loginError.classList.add('hidden');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword.value }),
      });
      if (!res.ok) throw new Error('Incorrect password');
      loginPassword.value = '';
      showApp();
    } catch (e) {
      loginError.textContent = e.message;
      loginError.classList.remove('hidden');
    }
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
  });

  function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    loadEventName();
    loadStats();
    loadGuests();
    loadSettings();
  }

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ---------- Overview ----------
  async function loadEventName() {
    const res = await fetch('/api/event');
    const data = await res.json();
    document.getElementById('top-event-name').textContent = data.event_name || 'RSVP Admin';
  }

  async function loadStats() {
    const res = await fetch('/api/admin/stats');
    const s = await res.json();
    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card"><div class="num">${s.total}</div><div class="label">Invited</div></div>
      <div class="stat-card"><div class="num">${s.yes}</div><div class="label">Said Yes</div></div>
      <div class="stat-card"><div class="num">${s.no}</div><div class="label">Said No</div></div>
      <div class="stat-card"><div class="num">${s.pending}</div><div class="label">Awaiting Response</div></div>
      <div class="stat-card"><div class="num">${s.attendingTotal}</div><div class="label">Total Attending (incl. plus-ones)</div></div>
    `;
  }

  document.getElementById('export-btn').addEventListener('click', () => {
    window.location.href = '/api/admin/export';
  });

  // ---------- Guests ----------
  async function loadGuests() {
    const res = await fetch('/api/admin/guests');
    const data = await res.json();
    allGuests = data.guests || [];
    renderGuestsTable();
  }

  function renderGuestsTable() {
    const search = document.getElementById('guest-search').value.trim().toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;

    const rows = allGuests.filter(g => {
      if (search && !g.full_name.toLowerCase().includes(search)) return false;
      if (statusFilter && g.rsvp_status !== statusFilter) return false;
      return true;
    });

    document.getElementById('guests-tbody').innerHTML = rows.map(g => `
      <tr data-id="${g.id}">
        <td>${escapeHtml(g.full_name)}</td>
        <td>${escapeHtml(g.party_label || '')}${g.max_party_size > 1 ? ` (up to ${g.max_party_size})` : ''}</td>
        <td>${escapeHtml(g.email || '')}${g.email && g.phone ? '<br>' : ''}${escapeHtml(g.phone || '')}</td>
        <td><span class="pill ${g.rsvp_status}">${g.rsvp_status === 'yes' ? 'Attending' : g.rsvp_status === 'no' ? 'Not attending' : 'Pending'}</span></td>
        <td>${g.rsvp_status === 'yes' ? (g.attending_count ?? '') : ''}</td>
        <td>${escapeHtml(g.guest_notes || g.notes || '')}</td>
        <td class="row-actions">
          <button class="action" data-edit="${g.id}">Edit</button>
          <button class="action danger" data-delete="${g.id}">Delete</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="7" style="text-align:center;color:#7a6f5e;">No guests match.</td></tr>`;

    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEditModal(b.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteGuest(b.dataset.delete)));
  }

  document.getElementById('guest-search').addEventListener('input', renderGuestsTable);
  document.getElementById('status-filter').addEventListener('change', renderGuestsTable);

  async function deleteGuest(id) {
    if (!confirm('Remove this guest from the list? This cannot be undone.')) return;
    await fetch('/api/admin/guests/' + id, { method: 'DELETE' });
    await loadGuests();
    await loadStats();
  }

  // ---------- Add / Edit modal ----------
  const modal = document.getElementById('guest-modal');
  let editingId = null;

  document.getElementById('add-guest-btn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add Guest';
    document.getElementById('m-full-name').value = '';
    document.getElementById('m-party-label').value = '';
    document.getElementById('m-max-party').value = '1';
    document.getElementById('m-email').value = '';
    document.getElementById('m-phone').value = '';
    document.getElementById('m-notes').value = '';
    modal.classList.remove('hidden');
  });

  function openEditModal(id) {
    const g = allGuests.find(x => String(x.id) === String(id));
    if (!g) return;
    editingId = id;
    document.getElementById('modal-title').textContent = 'Edit Guest';
    document.getElementById('m-full-name').value = g.full_name || '';
    document.getElementById('m-party-label').value = g.party_label || '';
    document.getElementById('m-max-party').value = g.max_party_size || 1;
    document.getElementById('m-email').value = g.email || '';
    document.getElementById('m-phone').value = g.phone || '';
    document.getElementById('m-notes').value = g.notes || '';
    modal.classList.remove('hidden');
  }

  document.getElementById('modal-cancel').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('modal-save').addEventListener('click', async () => {
    const payload = {
      full_name: document.getElementById('m-full-name').value.trim(),
      party_label: document.getElementById('m-party-label').value.trim(),
      max_party_size: document.getElementById('m-max-party').value.trim() || '1',
      email: document.getElementById('m-email').value.trim(),
      phone: document.getElementById('m-phone').value.trim(),
      notes: document.getElementById('m-notes').value.trim(),
    };
    if (!payload.full_name) { alert('Full name is required.'); return; }

    const url = editingId ? '/api/admin/guests/' + editingId : '/api/admin/guests';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Something went wrong'); return; }

    modal.classList.add('hidden');
    await loadGuests();
    await loadStats();
  });

  // ---------- Upload ----------
  document.getElementById('upload-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('csv-file');
    const msgEl = document.getElementById('upload-msg');
    if (!fileInput.files.length) {
      msgEl.innerHTML = `<div class="msg error">Please choose a CSV file first.</div>`;
      return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    msgEl.innerHTML = `<div class="msg">Uploading…</div>`;
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      let text = `Imported ${data.inserted} of ${data.totalRows} rows.`;
      if (data.skipped && data.skipped.length) {
        text += ` Skipped ${data.skipped.length} row(s) missing a name.`;
      }
      msgEl.innerHTML = `<div class="msg success">${text}</div>`;
      fileInput.value = '';
      await loadGuests();
      await loadStats();
    } catch (e) {
      msgEl.innerHTML = `<div class="msg error">${escapeHtml(e.message)}</div>`;
    }
  });

  document.getElementById('download-template-btn').addEventListener('click', () => {
    const csv = 'full_name,party_label,max_party_size,email,phone,notes\n"Jane Smith","The Smith Family",2,jane@example.com,555-123-4567,\n"John Doe","",1,john@example.com,,\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'guest-list-template.csv';
    a.click();
  });

  // ---------- Event settings ----------
  async function loadSettings() {
    const res = await fetch('/api/event');
    const s = await res.json();
    document.getElementById('set-event-name').value = s.event_name || '';
    document.getElementById('set-event-date').value = s.event_date || '';
    document.getElementById('set-event-time').value = s.event_time || '';
    document.getElementById('set-event-location').value = s.event_location || '';
    document.getElementById('set-event-description').value = s.event_description || '';
    document.getElementById('set-rsvp-deadline').value = s.rsvp_deadline || '';
    document.getElementById('set-header-image').value = s.header_image_url || '';
    document.getElementById('set-accent-color').value = s.accent_color || '#8a6d3b';
  }

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const payload = {
      event_name: document.getElementById('set-event-name').value.trim(),
      event_date: document.getElementById('set-event-date').value.trim(),
      event_time: document.getElementById('set-event-time').value.trim(),
      event_location: document.getElementById('set-event-location').value.trim(),
      event_description: document.getElementById('set-event-description').value.trim(),
      rsvp_deadline: document.getElementById('set-rsvp-deadline').value.trim(),
      header_image_url: document.getElementById('set-header-image').value.trim(),
      accent_color: document.getElementById('set-accent-color').value,
    };
    const res = await fetch('/api/admin/event', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const msgEl = document.getElementById('settings-msg');
    if (res.ok) {
      msgEl.innerHTML = `<div class="msg success">Saved.</div>`;
      loadEventName();
    } else {
      msgEl.innerHTML = `<div class="msg error">Something went wrong.</div>`;
    }
  });

  checkAuth();
})();
