async function refreshStatus() {
  try {
    const data = await apiFetch('/status');

    const stateEl = document.getElementById('ec2-state');
    stateEl.className = `badge badge-${data.state}`;
    stateEl.innerHTML = `<span class="badge-dot"></span>${data.state}`;

    document.getElementById('ec2-instance-id').textContent = data.instance_id || '—';
    document.getElementById('ec2-type').textContent = data.instance_type || '—';
    document.getElementById('ec2-ip').textContent = data.public_ip || '—';
    document.getElementById('ec2-uptime').textContent =
      data.uptime_hours != null ? `${data.uptime_hours}h` : '—';

    document.getElementById('last-updated').textContent =
      'Updated ' + new Date().toLocaleTimeString();

    const isRunning = data.state === 'running';
    const isStopped = data.state === 'stopped';
    document.getElementById('btn-start').disabled = !isStopped;
    document.getElementById('btn-stop').disabled  = !isRunning;
  } catch (e) {
    console.error('Status refresh failed:', e);
    const stateEl = document.getElementById('ec2-state');
    stateEl.className = 'badge badge-unknown';
    stateEl.innerHTML = '<span class="badge-dot"></span>error';
  }
}
