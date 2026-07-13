/**
 * Devuelve la URL completa de un recurso estático (imagen, avatar, etc.)
 * almacenado en el backend. Recibe la ruta relativa tal como la devuelve la API
 * (e.g. "/uploads/avatars/foto.jpg") y le antepone la URL base del servidor.
 *
 * @param {string | null | undefined} path  - ruta relativa del archivo
 * @returns {string | null}
 */
export const getMediaUrl = (path) => {
  if (!path) return null;
  const base = import.meta.env.VITE_BASE_URL || 'http://localhost:4000';
  return `${base}${path}`;
};
