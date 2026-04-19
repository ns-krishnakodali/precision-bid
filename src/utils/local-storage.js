export const setStorageValue = (key, value) => {
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    console.error(`Failed to store value for key "${key}":`, error);
  }
};

export const getStorageValue = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Failed to retrieve value for key "${key}":`, error);
    return defaultValue;
  }
};

export const deleteStorageValue = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to delete value for key "${key}":`, error);
  }
};
