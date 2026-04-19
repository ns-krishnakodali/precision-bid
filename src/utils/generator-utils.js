export const generateUniqueCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let idx = 0; idx < length; idx++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

export const getRandomInt = (min = 0, max) => {
  if (max === undefined) {
    max = min;
    min = 0;
  }

  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min)) + min;
};
