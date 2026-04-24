const API_BASE = '/api';

function getApiKey() {
  let key = sessionStorage.getItem('dashboard_api_key');
  if (!key) {
    key = prompt('Enter dashboard API key:');
    if (!key) { document.body.innerHTML = '<p style="color:red;padding:20px">API key required.</p>'; return null; }
    sessionStorage.setItem('dashboard_api_key', key);
  }
  return key;
}

const API_KEY = getApiKey();

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}
