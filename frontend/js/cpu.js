function updateCpuCard(credits, instanceType) {
  const el = document.getElementById('cpu-value');
  const tag = document.getElementById('cpu-type-tag');

  if (instanceType && tag) tag.textContent = instanceType;

  if (credits == null) {
    el.textContent = 'N/A';
    el.className = 'cpu-num';
    return;
  }
  el.textContent = credits;
  el.className = 'cpu-num' +
    (credits < 10 ? ' crit' : credits < 30 ? ' warn' : '');
}
