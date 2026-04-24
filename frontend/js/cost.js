async function refreshCost() {
  try {
    const data = await apiFetch('/cost');

    document.getElementById('cost-current').textContent =
      data.cost_inr != null ? data.cost_inr.toLocaleString('en-IN') : '0';
    document.getElementById('cost-projected').textContent =
      data.projected_monthly_inr != null ? `₹${data.projected_monthly_inr.toLocaleString('en-IN')}` : '—';
    document.getElementById('cost-target').textContent =
      `₹${(data.target_monthly_inr || 1600).toLocaleString('en-IN')}`;

    const el = document.getElementById('cost-on-track');
    if (data.on_track === true)  { el.textContent = 'On track';    el.className = 'r-val good'; }
    if (data.on_track === false) { el.textContent = 'Over budget'; el.className = 'r-val bad'; }
    if (data.on_track === null)  { el.textContent = '—';           el.className = 'r-val'; }

    document.getElementById('cost-period').textContent =
      data.period_start ? `${data.period_start} → ${data.period_end}` : 'month to date';
  } catch (e) {
    console.error('Cost refresh failed:', e);
  }
}
