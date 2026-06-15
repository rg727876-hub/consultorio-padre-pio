// ─────────────────────────────────────────────────────────────────────────────
// Configuración central de seguridad (defensa en profundidad).
//
//   - validateEnv()    → valida los secretos críticos al arrancar (fail-fast)
//   - corsOptions      → CORS estricto basado en allowlist
//   - rate limiters    → límites por IP para frenar fuerza bruta / abuso
// ─────────────────────────────────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

// ── 1. Validación de variables de entorno críticas ──────────────────────────
// Si falta un secreto o es débil, el servidor NO debe arrancar en producción.
function validateEnv() {
  const errores = [];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    errores.push('JWT_SECRET no está definido.');
  } else if (secret.length < 32) {
    errores.push('JWT_SECRET es demasiado corto (mínimo 32 caracteres). Genera uno con: openssl rand -hex 32');
  } else if (/^(secret|changeme|password|123|test|dev)/i.test(secret)) {
    errores.push('JWT_SECRET parece un valor de ejemplo/débil. Usa un valor aleatorio.');
  }

  for (const k of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!process.env[k]) errores.push(`${k} no está definido.`);
  }

  if (errores.length) {
    const msg =
      '\n🔒 [SEGURIDAD] Configuración inválida, abortando:\n  - ' +
      errores.join('\n  - ') + '\n';
    if (isProd) {
      console.error(msg);
      process.exit(1);            // En producción: no arrancar con config insegura.
    } else {
      console.warn(msg + '  (en desarrollo se continúa, pero corrígelo antes de desplegar)\n');
    }
  }
}

// ── 2. CORS estricto (allowlist) ────────────────────────────────────────────
// Orígenes permitidos:
//   - FRONTEND_URL (producción)
//   - localhost dev (solo fuera de producción)
//   - CORS_EXTRA_ORIGINS: lista separada por comas (ej. dominios de Vercel concretos)
//   - Previews de Vercel SOLO si VERCEL_PREVIEW_REGEX está definido (opcional)
const allowlist = new Set(
  [
    process.env.FRONTEND_URL,
    !isProd && 'http://localhost:5173',
    !isProd && 'http://localhost:4173',
    ...(process.env.CORS_EXTRA_ORIGINS?.split(',').map((s) => s.trim()) ?? []),
  ].filter(Boolean)
);

// Patrón opcional para previews de Vercel. Por defecto NO se permite ningún
// *.vercel.app arbitrario; defínelo de forma acotada al proyecto, p.ej.:
//   VERCEL_PREVIEW_REGEX=^https://clinica-padre-pio[a-z0-9-]*\.vercel\.app$
const previewRegex = process.env.VERCEL_PREVIEW_REGEX
  ? new RegExp(process.env.VERCEL_PREVIEW_REGEX)
  : null;

const corsOptions = {
  origin(origin, cb) {
    // Permite herramientas sin Origin (curl, health checks, apps móviles).
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    if (previewRegex && previewRegex.test(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

// ── 3. Rate limiters por IP ─────────────────────────────────────────────────
const handler = (req, res) =>
  res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });

// Límite global razonable para toda la API.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 min
  max: 600,                     // 600 req / 15 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Límite estricto para autenticación y activación (anti fuerza-bruta).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,                      // 20 intentos / 15 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { validateEnv, corsOptions, globalLimiter, authLimiter };
