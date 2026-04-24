async function refreshDisk() {
  try {
    const data = await apiFetch('/disk');
    const pct = data.usage_percent ?? 0;

    const big = document.getElementById('disk-pct');
    big.textContent = data.usage_percent != null ? `${pct}%` : '—';
    big.style.color = pct > 85 ? 'var(--red)' : pct > 70 ? 'var(--yellow)' : 'var(--green)';

    const bar = document.getElementById('disk-bar');
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.className = `disk-fill disk-fill-${data.status || 'ok'}`;

    document.getElementById('disk-used').textContent =
      data.used_gb != null ? `${data.used_gb} GB used` : 'N/A';
    document.getElementById('disk-total').textContent =
      data.total_gb != null ? `${data.total_gb} GB total` : '';

    const banner = document.getElementById('alert-disk');
    if (data.status === 'warning' || data.status === 'critical') {
      banner.textContent = `⚠ Disk at ${pct}% (${data.used_gb}GB / ${data.total_gb}GB) — above 70% threshold.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {
    console.error('Disk refresh failed:', e);
  }
}
