async function refreshSSL() {
  try {
    const certs = await apiFetch('/ssl');
    const container = document.getElementById('ssl-list');
    container.innerHTML = '';

    let hasCritical = false;

    for (const cert of certs) {
      const cls = `ssl-${cert.status}`;
      const days = cert.days_remaining != null ? cert.days_remaining : '?';
      if (cert.status === 'critical') hasCritical = true;

      const dateStr = cert.expiry_date
        ? new Date(cert.expiry_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        : (cert.error || 'Unknown');

      container.insertAdjacentHTML('beforeend', `
        <div class="ssl-item">
          <div>
            <div class="ssl-domain">${cert.domain}</div>
            <div class="ssl-expiry-date">Expires ${dateStr}</div>
          </div>
          <div class="ssl-days-badge ${cls}">
            <div class="ssl-days-num">${days}</div>
            <div class="ssl-days-label">days</div>
          </div>
        </div>
      `);
    }

    const banner = document.getElementById('alert-ssl');
    if (hasCritical) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
  } catch (e) {
    console.error('SSL refresh failed:', e);
  }
}
