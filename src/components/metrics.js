export function updateMetrics(metrics, dependencyCount) {
  const count = dependencyCount !== undefined ? dependencyCount : metrics.registeredApis;

  const regNum = document.querySelector('.metric-card-white .metric-giant-number');
  if (regNum) regNum.textContent = String(count).padStart(2, '0');

  const navCounter = document.querySelector('.nav-counter');
  if (navCounter) navCounter.textContent = String(count).padStart(2, '0');

  const changesNum = document.querySelector('.metric-card-coral .metric-giant-number');
  if (changesNum) changesNum.textContent = String(metrics.changesDetected).padStart(2, '0');

  const protectedNum = document.querySelector('.metric-card-lime .metric-giant-number');
  if (protectedNum) protectedNum.textContent = String(metrics.workflowsProtected).padStart(2, '0');

  const notifIndicator = document.querySelector('.notification-indicator');
  if (notifIndicator) notifIndicator.textContent = String(metrics.changesDetected);
}
