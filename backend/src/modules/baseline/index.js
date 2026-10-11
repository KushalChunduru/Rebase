import { store } from '../../store/index.js';

export function captureBaseline(normalized) {
  const snapshot = {
    schema: JSON.parse(JSON.stringify(normalized.schema)),
    data: JSON.parse(JSON.stringify(normalized.data)),
    metadata: { ...normalized.metadata }
  };
  store.setBaseline(normalized.dependencyId, snapshot);
  return snapshot;
}

export function getBaseline(dependencyId) {
  return store.getBaseline(dependencyId);
}

export function hasBaseline(dependencyId) {
  return store.getBaseline(dependencyId) !== null;
}
