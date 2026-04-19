export const formatCreatedAt = (createdAt) => {
  if (!createdAt) return '';
  if (typeof createdAt !== 'number') return '';

  try {
    return new Date(createdAt).toLocaleString();
  } catch {
    return '';
  }
};
