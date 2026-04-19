import { LOCAL_STORAGE_KEYS } from '../../constants';
import { deleteStorageValue, getStorageValue, setStorageValue } from '../../utils';

const getLegacyRawValue = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const createClientId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `client_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
};

const getOrCreateClientId = () => {
  const storedId = getStorageValue(LOCAL_STORAGE_KEYS.CLIENT_ID, null);
  if (typeof storedId === 'string' && storedId) return storedId;

  const legacyId = getLegacyRawValue(LOCAL_STORAGE_KEYS.CLIENT_ID);
  if (typeof legacyId === 'string' && legacyId) {
    setStorageValue(LOCAL_STORAGE_KEYS.CLIENT_ID, legacyId);
    return legacyId;
  }

  const nextId = createClientId();
  setStorageValue(LOCAL_STORAGE_KEYS.CLIENT_ID, nextId);
  return nextId;
};

const getDisplayName = () => {
  const storedName = getStorageValue(LOCAL_STORAGE_KEYS.DISPLAY_NAME, '');
  if (typeof storedName === 'string' && storedName) return storedName;

  const legacyName = getLegacyRawValue(LOCAL_STORAGE_KEYS.DISPLAY_NAME);
  if (typeof legacyName === 'string' && legacyName) {
    setStorageValue(LOCAL_STORAGE_KEYS.DISPLAY_NAME, legacyName);
    return legacyName;
  }

  return '';
};

const setDisplayName = (displayName) => {
  const trimmed = String(displayName ?? '').trim();
  if (!trimmed) {
    deleteStorageValue(LOCAL_STORAGE_KEYS.DISPLAY_NAME);
    return;
  }

  setStorageValue(LOCAL_STORAGE_KEYS.DISPLAY_NAME, trimmed);
};

export const clientService = {
  getDisplayName,
  getOrCreateClientId,
  setDisplayName,
};

