// ── Constants ───────────────────────────────────────────
const RULE_LABELS = {
  daily_start: 'Daily Start (Mon–Sat)',
  daily_stop:  'Daily Stop  (Mon–Sat)',
};

const DAY_ORDER = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5, SUN:6 };

// ── Schedule Viewer ─────────────────────────────────────
async function refreshSchedule() {
  try {
    const data = await apiFetch('/schedule');
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = '';

    for (const [key, info] of Object.entries(data)) {
      const label = RULE_LABELS[key] || key;
      const sched = info?.schedule || '—';
      const state = info?.state || 'NOT_FOUND';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${label}</td>
          <td>${sched !== '—' ? `<span class="cron-pill">${sched}</span>` : '<span style="color:var(--textDim)">—</span>'}</td>
          <td><span class="state-pill state-${state.replace(/\s/g,'_')}">${state}</span></td>
        </tr>
      `);
    }
  } catch (e) {
    console.error('Schedule refresh failed:', e);
  }
}

// ── IST time list ────────────────────────────────────────
function buildTimeOptions() {
  const opts = [];
  for (let h = 5; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      const hh   = String(h).padStart(2, '0');
      const mm   = String(m).padStart(2, '0');
      const ampm = h < 12 ? 'AM' : 'PM';
      const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${String(h12).padStart(2,'0')}:${mm} ${ampm} IST`;
      opts.push({ value: `${hh}:${mm}`, label });
    }
  }
  return opts;
}

function populateTimeSelects() {
  const opts = buildTimeOptions();
  ['time-start', 'time-stop'].forEach((id, i) => {
    const sel = document.getElementById(id);
    opts.forEach(o => {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      sel.appendChild(el);
    });
    // defaults: 9:00 AM start, 9:00 PM stop
    sel.value = i === 0 ? '09:00' : '21:00';
  });
}

// ── IST → UTC conversion ────────────────────────────────
function istToUtc(timeStr) {
  let [h, m] = timeStr.split(':').map(Number);
  m -= 30;
  h -= 5;
  if (m < 0) { m += 60; h--; }
  if (h < 0) h += 24;
  return { h, m };
}

// ── Cron day string builder ─────────────────────────────
function buildDayString(selected) {
  if (!selected.length) return '?';
  const sorted = [...selected].sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b]);

  // Detect full week range shortcuts
  const all7 = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const allSat = ['MON','TUE','WED','THU','FRI','SAT'];
  const allFri = ['MON','TUE','WED','THU','FRI'];
  const eq = (a, b) => a.length === b.length && a.every((v,i) => v === b[i]);

  if (eq(sorted, all7))    return 'MON-SUN';
  if (eq(sorted, allSat))  return 'MON-SAT';
  if (eq(sorted, allFri))  return 'MON-FRI';
  return sorted.join(',');
}

// ── Cron expression builder ─────────────────────────────
function buildCron(days, timeStr) {
  const { h, m } = istToUtc(timeStr);
  const dayStr   = buildDayString(days);
  return `cron(${m} ${h} ? * ${dayStr} *)`;
}

// ── Update cron preview labels ──────────────────────────
function updatePreview() {
  const selected = getSelectedDays();
  const startTime = document.getElementById('time-start').value;
  const stopTime  = document.getElementById('time-stop').value;

  document.getElementById('preview-start').textContent =
    selected.length ? buildCron(selected, startTime) : 'Select at least one day';
  document.getElementById('preview-stop').textContent =
    selected.length ? buildCron(selected, stopTime)  : 'Select at least one day';
}

function getSelectedDays() {
  return [...document.querySelectorAll('.day-btn.active')].map(b => b.dataset.day);
}

// ── Schedule Editor Setup ───────────────────────────────
function setupScheduleEditor() {
  populateTimeSelects();
  updatePreview();

  // Day toggle
  document.getElementById('day-grid').addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    btn.classList.toggle('active');
    updatePreview();
  });

  // Time change → update preview
  document.getElementById('time-start').addEventListener('change', updatePreview);
  document.getElementById('time-stop').addEventListener('change', updatePreview);

  // Save
  document.getElementById('btn-save-schedule').addEventListener('click', async () => {
    const selected  = getSelectedDays();
    const startTime = document.getElementById('time-start').value;
    const stopTime  = document.getElementById('time-stop').value;

    if (!selected.length) { alert('Select at least one active day.'); return; }

    const startCron = buildCron(selected, startTime);
    const stopCron  = buildCron(selected, stopTime);

    const btn = document.getElementById('btn-save-schedule');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>&nbsp;Applying…';

    try {
      await Promise.all([
        apiFetch('/schedule', { method:'POST', body: JSON.stringify({ rule_key:'daily_start', cron_expression: startCron }) }),
        apiFetch('/schedule', { method:'POST', body: JSON.stringify({ rule_key:'daily_stop',  cron_expression: stopCron  }) }),
      ]);

      // Update the summary strip
      const dayLabel = buildDayString(selected).replace('MON-SAT','Mon – Sat').replace('MON-FRI','Mon – Fri').replace('MON-SUN','Every day');
      document.getElementById('sched-summary-days').textContent = dayLabel;

      const fmt = t => {
        const [h,m] = t.split(':').map(Number);
        const ap = h < 12 ? 'AM' : 'PM';
        const h12 = h === 0 ? 12 : h > 12 ? h-12 : h;
        return `${h12}:${String(m).padStart(2,'0')} ${ap}`;
      };
      document.getElementById('sched-summary-hours').textContent = `${fmt(startTime)} – ${fmt(stopTime)}`;

      await refreshSchedule();
    } catch (e) {
      alert(`Failed to save schedule: ${e.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Schedule';
    }
  });
}
