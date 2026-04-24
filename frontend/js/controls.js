function setupControls() {
  const modal     = document.getElementById('modal-confirm');
  const modalMsg  = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const cancelBtn  = document.getElementById('modal-cancel-btn');
  let pendingAction = null;

  function showModal(message, action) {
    modalMsg.textContent = message;
    pendingAction = action;
    modal.classList.remove('hidden');
  }

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    pendingAction = null;
  });

  confirmBtn.addEventListener('click', async () => {
    modal.classList.add('hidden');
    if (!pendingAction) return;
    const action = pendingAction;
    pendingAction = null;

    const btn = document.getElementById(`btn-${action}`);
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await apiFetch(`/${action}`, { method: 'POST' });
      setTimeout(refreshStatus, 3000);
      setTimeout(refreshStatus, 8000);
    } catch (e) {
      alert(`Failed to ${action} instance: ${e.message}`);
    } finally {
      btn.textContent = originalText;
      await refreshStatus();
    }
  });

  document.getElementById('btn-start').addEventListener('click', () =>
    showModal('Start the EC2 instance? This will also run the post-start health check.', 'start')
  );

  document.getElementById('btn-stop').addEventListener('click', () =>
    showModal('Stop the EC2 instance? Sidekiq will be gracefully flushed first.', 'stop')
  );
}
