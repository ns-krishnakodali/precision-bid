export const setStorageValue = (key, value) => {
  try {
    const serializedValue = JSON.stringify(value);
    try {
      localStorage.setItem(key, serializedValue);
    } catch (storageErr) {
      console.error(`Failed to store local value for key "${key}":`, storageErr);
    }

    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
          serializedValue
        )}; path=/; max-age=2592000; samesite=lax`;
      }
    } catch (cookieErr) {
      console.error(`Failed to store cookie value for key "${key}":`, cookieErr);
    }
  } catch (error) {
    console.error(`Failed to serialize value for key "${key}":`, error);
  }
};

export const getStorageValue = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);
    if (value) return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to retrieve value for key "${key}":`, error);
  }

  if (typeof document === 'undefined') return defaultValue;

  try {
    const cookieValue = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${encodeURIComponent(key)}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    if (!cookieValue) return defaultValue;

    const decodedValue = decodeURIComponent(cookieValue);
    const parsedValue = JSON.parse(decodedValue);

    try {
      localStorage.setItem(key, decodedValue);
    } catch (err) {
      console.error('Failed to set decoded item', err);
    }

    return parsedValue;
  } catch (cookieErr) {
    console.error(`Failed to retrieve cookie value for key "${key}":`, cookieErr);
    return defaultValue;
  }
};

export const deleteStorageValue = (key) => {
  try {
    try {
      localStorage.removeItem(key);
    } catch (storageErr) {
      console.error(`Failed to delete local value for key "${key}":`, storageErr);
    }

    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; samesite=lax`;
      }
    } catch (cookieErr) {
      console.error(`Failed to delete cookie value for key "${key}":`, cookieErr);
    }
  } catch (error) {
    console.error(`Failed to delete value for key "${key}":`, error);
  }
};
