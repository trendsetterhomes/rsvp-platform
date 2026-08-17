(function () {
  const searchInput = document.getElementById('search-input');
  const resultsEl = document.getElementById('results');
  const emptyNoteEl = document.getElementById('empty-note');
  const searchStatusEl = document.getElementById('search-status');
  const searchView = document.getElementById('search-view');
  const rsvpView = document.getElementById('rsvp-view');
  const deadlineNote = document.getElementById('deadline-note');

  let debounceTimer = null;
  let currentGuest = null;
  let selectedStatus = null;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadEvent() {
    try {
      const res = await fetch('/api/event');
      const data = await res.json();
      document.getElementById('event-name').textContent = data.event_name || 'Our Event';

      const metaParts = [data.event_date, data.event_time, data.event_location].filter(Boolean);
      document.getElementById('event-meta').textContent = metaParts.join(' · ');
      document.getElementById('event-desc').textContent = data.event_description || '';

      if (data.header_image_url) {
        const img = document.createElement('img');
        img.src = data.header_image_url;
        img.className = 'header-image';
        img.alt = data.event_name || 'Event';
        document.getElementById('hero').insertBefore(img, document.querySelector('.eyebrow'));
      }

      if (data.accent_color) {
        document.documentElement.style.setProperty('--accent', data.accent_color);
      }

      if (data.rsvp_deadline) {
        deadlineNote.textContent = `Please RSVP by ${data.rsvp_deadline}`;
      }

      document.title = (data.event_name || 'RSVP') + ' — RSVP';
    } catch (e) {
      document.getElementById('event-name').textContent = 'RSVP';
    }
  }

  function renderResults(results) {
    if (!results.length) {
      resultsEl.classList.add('hidden');
      emptyNoteEl.classList.remove('hidden');
      return;
    }
    emptyNoteEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = results.map(r => `
      <div class="result-item" data-id="${r.id}">
        <div>
          <div class="name">${escapeHtml(r.full_name)}</div>
        </div>
        <div class="status-pill ${r.rsvp_status}">${r.rsvp_status === 'yes' ? 'Attending' : r.rsvp_status === 'no' ? 'Not attending' : 'Not yet responded'}</div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        const guest = results.find(r => String(r.id) === el.dataset.id);
        openRsvp(guest);
      });
    });
  }

  async function doSearch(q) {
    if (!q || q.trim().length < 2) {
      resultsEl.classList.add('hidden');
      emptyNoteEl.classList.add('hidden');
      searchStatusEl.classList.add('hidden');
      return;
    }
    searchStatusEl.textContent = 'Searching…';
    searchStatusEl.classList.remove('hidden');
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      searchStatusEl.classList.add('hidden');
      renderResults(data.results || []);
    } catch (e) {
      searchStatusEl.textContent = 'Something went wrong. Please try again.';
    }
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const q = e.target.value;
    debounceTimer = setTimeout(() => doSearch(q), 250);
  });

  function openRsvp(guest) {
    currentGuest = guest;
    selectedStatus = guest.rsvp_status === 'yes' || guest.rsvp_status === 'no' ? guest.rsvp_status : null;
    searchView.classList.add('hidden');
    rsvpView.classList.remove('hidden');
    renderRsvpForm();
  }

  function renderRsvpForm() {
    const g = currentGuest;
    const showPartySize = g.max_party_size > 1;
    const partyOptions = Array.from({ length: g.max_party_size }, (_, i) => i + 1)
      .map(n => `<option value="${n}" ${g.attending_count === n ? 'selected' : ''}>${n} ${n === 1 ? 'guest' : 'guests'}</option>`).join('');

    rsvpView.innerHTML = `
      <div class="card">
        <h2>${escapeHtml(g.full_name)}</h2>
        ${g.party_label ? `<div class="party-label">${escapeHtml(g.party_label)} · up to ${g.max_party_size} ${g.max_party_size === 1 ? 'guest' : 'guests'}</div>` : (g.max_party_size > 1 ? `<div class="party-label">Party of up to ${g.max_party_size}</div>` : '')}

        <div class="rsvp-choices">
          <button type="button" class="choice-btn yes ${selectedStatus === 'yes' ? 'selected' : ''}" id="btn-yes">Joyfully Accepts</button>
          <button type="button" class="choice-btn no ${selectedStatus === 'no' ? 'selected' : ''}" id="btn-no">Regretfully Declines</button>
        </div>

        <div id="party-field" class="field ${showPartySize && selectedStatus === 'yes' ? '' : 'hidden'}">
          <label for="party-size">Number attending</label>
          <select id="party-size">${partyOptions}</select>
        </div>

        <div class="field">
          <label for="guest-notes">Message (optional)</label>
          <textarea id="guest-notes" placeholder="Dietary restrictions, well wishes, etc.">${escapeHtml(g.guest_notes || '')}</textarea>
        </div>

        <button class="btn-primary" id="submit-rsvp" disabled>Submit RSVP</button>
        <button class="btn-secondary" id="back-btn">← Search again</button>
      </div>
    `;

    document.getElementById('btn-yes').addEventListener('click', () => selectStatus('yes'));
    document.getElementById('btn-no').addEventListener('click', () => selectStatus('no'));
    document.getElementById('submit-rsvp').addEventListener('click', submitRsvp);
    document.getElementById('back-btn').addEventListener('click', goBackToSearch);
    updateSubmitState();
  }

  function selectStatus(status) {
    selectedStatus = status;
    renderRsvpForm();
  }

  function updateSubmitState() {
    const btn = document.getElementById('submit-rsvp');
    if (btn) btn.disabled = !selectedStatus;
  }

  function goBackToSearch() {
    rsvpView.classList.add('hidden');
    searchView.classList.remove('hidden');
    searchInput.value = '';
    resultsEl.classList.add('hidden');
    emptyNoteEl.classList.add('hidden');
    currentGuest = null;
    selectedStatus = null;
  }

  async function submitRsvp() {
    const btn = document.getElementById('submit-rsvp');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const partySizeEl = document.getElementById('party-size');
    const notesEl = document.getElementById('guest-notes');

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: currentGuest.id,
          status: selectedStatus,
          attending_count: partySizeEl ? parseInt(partySizeEl.value, 10) : 1,
          guest_notes: notesEl ? notesEl.value : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      renderConfirmation(selectedStatus);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Submit RSVP';
      alert(e.message || 'Something went wrong. Please try again.');
    }
  }

  function renderConfirmation(status) {
    rsvpView.innerHTML = `
      <div class="card confirmation">
        <div class="icon">${status === 'yes' ? '🎉' : '💌'}</div>
        <h2>${status === 'yes' ? "You're on the list!" : 'Thanks for letting us know'}</h2>
        <p>${status === 'yes' ? 'We can\'t wait to celebrate with you.' : 'We\'ll miss you, but thank you for responding.'}</p>
        <button class="btn-secondary" id="edit-again">Made a mistake? Update your response</button>
      </div>
    `;
    document.getElementById('edit-again').addEventListener('click', () => renderRsvpForm());
  }

  // Wire party size visibility toggle whenever the choice changes
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'party-size' && currentGuest) {
      currentGuest.attending_count = parseInt(e.target.value, 10);
    }
  });

  loadEvent();
})();
