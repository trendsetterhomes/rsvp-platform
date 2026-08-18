(function () {
  const searchInput = document.getElementById('search-input');
  const resultsEl = document.getElementById('results');
  const emptyNoteEl = document.getElementById('empty-note');
  const searchStatusEl = document.getElementById('search-status');
  const searchView = document.getElementById('search-view');
  const rsvpView = document.getElementById('rsvp-view');
  const deadlineNote = document.getElementById('deadline-note');

  let debounceTimer = null;
  let currentMembers = [];       // everyone in the party being responded for (length 1 if no party)
  let currentPartyLabel = null;
  let memberState = {};          // guest id -> { status: 'yes'|'no'|null, count: number }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadEvent() {
    try {
      const res = await fetch('/api/event');
      const data = await res.json();
      document.getElementById('event-name').textContent = data.event_name || 'Our Event';

      const dateTimeParts = [data.event_date, data.event_time].filter(Boolean);
      const metaLines = [];
      if (dateTimeParts.length) metaLines.push(`<span class="meta-line">${escapeHtml(dateTimeParts.join(' · '))}</span>`);
      if (data.event_location) metaLines.push(`<span class="meta-line meta-location">${escapeHtml(data.event_location)}</span>`);
      document.getElementById('event-meta').innerHTML = metaLines.join('');
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

  async function openRsvp(guest) {
    searchView.classList.add('hidden');
    rsvpView.classList.remove('hidden');
    rsvpView.innerHTML = `<div class="card"><div class="spinner-inline">Loading…</div></div>`;

    let members = [guest];
    let partyLabel = guest.party_label || null;
    try {
      const res = await fetch('/api/party?guest_id=' + encodeURIComponent(guest.id));
      const data = await res.json();
      if (res.ok && Array.isArray(data.members) && data.members.length) {
        members = data.members;
        partyLabel = data.party_label || null;
      }
    } catch (e) {
      // fall back to just the one guest found via search
    }

    setMembers(members, partyLabel);
    renderRsvpForm();
  }

  function setMembers(members, partyLabel) {
    currentMembers = members;
    currentPartyLabel = partyLabel;
    memberState = {};
    members.forEach(m => {
      memberState[m.id] = {
        status: m.rsvp_status === 'yes' || m.rsvp_status === 'no' ? m.rsvp_status : null,
        count: m.attending_count || 1,
      };
    });
  }

  function renderRsvpForm() {
    const isParty = currentMembers.length > 1;
    const titleText = isParty ? (currentPartyLabel || 'Your Party') : currentMembers[0].full_name;

    const memberBlocks = currentMembers.map(m => {
      const st = memberState[m.id];
      const showPartySize = m.max_party_size > 1 && st.status === 'yes';
      const partyOptions = Array.from({ length: m.max_party_size }, (_, i) => i + 1)
        .map(n => `<option value="${n}" ${st.count === n ? 'selected' : ''}>${n} ${n === 1 ? 'guest' : 'guests'}</option>`).join('');

      return `
        <div class="party-member" data-member-id="${m.id}">
          <div class="party-member-name">${escapeHtml(m.full_name)}${m.max_party_size > 1 ? ` <span class="party-member-hint">(up to ${m.max_party_size})</span>` : ''}</div>
          <div class="rsvp-choices">
            <button type="button" class="choice-btn yes ${st.status === 'yes' ? 'selected' : ''}" data-action="yes">${isParty ? 'Attending' : 'Joyfully Accepts'}</button>
            <button type="button" class="choice-btn no ${st.status === 'no' ? 'selected' : ''}" data-action="no">${isParty ? 'Not Attending' : 'Regretfully Declines'}</button>
          </div>
          <div class="field party-size-field ${showPartySize ? '' : 'hidden'}">
            <label>Number attending</label>
            <select class="party-size-select">${partyOptions}</select>
          </div>
        </div>
      `;
    }).join('');

    const sharedNotes = currentMembers[0].guest_notes || '';

    rsvpView.innerHTML = `
      <div class="card">
        <h2>${escapeHtml(titleText)}</h2>
        ${isParty ? `<div class="party-label">Respond for everyone in your party below.</div>` : ''}

        ${memberBlocks}

        <div class="field">
          <label for="guest-notes">Message (optional)</label>
          <textarea id="guest-notes" placeholder="Dietary restrictions, well wishes, etc.">${escapeHtml(sharedNotes)}</textarea>
        </div>

        <button class="btn-primary" id="submit-rsvp" disabled>${isParty ? 'Submit RSVP for ' + escapeHtml(titleText) : 'Submit RSVP'}</button>
        <button class="btn-secondary" id="back-btn">← Search again</button>
      </div>
    `;

    rsvpView.querySelectorAll('.party-member').forEach(el => {
      const id = el.dataset.memberId;
      el.querySelector('[data-action="yes"]').addEventListener('click', () => selectMemberStatus(id, 'yes'));
      el.querySelector('[data-action="no"]').addEventListener('click', () => selectMemberStatus(id, 'no'));
      const sizeSelect = el.querySelector('.party-size-select');
      if (sizeSelect) {
        sizeSelect.addEventListener('change', (e) => { memberState[id].count = parseInt(e.target.value, 10); });
      }
    });

    document.getElementById('submit-rsvp').addEventListener('click', submitRsvp);
    document.getElementById('back-btn').addEventListener('click', goBackToSearch);
    updateSubmitState();
  }

  function selectMemberStatus(id, status) {
    memberState[id].status = status;
    renderRsvpForm();
  }

  function updateSubmitState() {
    const btn = document.getElementById('submit-rsvp');
    if (!btn) return;
    const allSet = currentMembers.every(m => memberState[m.id].status);
    btn.disabled = !allSet;
  }

  function goBackToSearch() {
    rsvpView.classList.add('hidden');
    searchView.classList.remove('hidden');
    searchInput.value = '';
    resultsEl.classList.add('hidden');
    emptyNoteEl.classList.add('hidden');
    currentMembers = [];
    currentPartyLabel = null;
    memberState = {};
  }

  async function submitRsvp() {
    const btn = document.getElementById('submit-rsvp');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const notesEl = document.getElementById('guest-notes');
    const noteValue = notesEl ? notesEl.value : '';

    const updates = currentMembers.map(m => ({
      guest_id: m.id,
      status: memberState[m.id].status,
      attending_count: memberState[m.id].count,
      guest_notes: noteValue,
    }));

    try {
      let resultMembers;
      if (updates.length === 1) {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates[0]),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        resultMembers = [data.guest];
      } else {
        const res = await fetch('/api/rsvp/party', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        resultMembers = data.members;
      }
      setMembers(resultMembers, currentPartyLabel);
      renderConfirmation(resultMembers);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      alert(e.message || 'Something went wrong. Please try again.');
    }
  }

  function renderConfirmation(members) {
    const allYes = members.every(m => m.rsvp_status === 'yes');
    const allNo = members.every(m => m.rsvp_status === 'no');
    const icon = allYes ? '🎉' : allNo ? '💌' : '📋';

    let heading;
    let summary;
    if (members.length === 1) {
      const yes = members[0].rsvp_status === 'yes';
      heading = yes ? "You're on the list!" : 'Thanks for letting us know';
      summary = yes ? 'We can’t wait to celebrate with you.' : 'We’ll miss you, but thank you for responding.';
    } else {
      heading = 'Thanks — your party’s response is in!';
      summary = members.map(m => `${escapeHtml(m.full_name)}: ${m.rsvp_status === 'yes' ? 'Attending' : 'Not attending'}`).join(' · ');
    }

    rsvpView.innerHTML = `
      <div class="card confirmation">
        <div class="icon">${icon}</div>
        <h2>${heading}</h2>
        <p>${summary}</p>
        <button class="btn-secondary" id="edit-again">Made a mistake? Update your response</button>
      </div>
    `;
    document.getElementById('edit-again').addEventListener('click', () => renderRsvpForm());
  }

  loadEvent();
})();
