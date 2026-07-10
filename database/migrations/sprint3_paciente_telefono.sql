-- =========================================================
-- MIGRACIÓN: Hacer telefono NULLABLE en tabla PACIENTE
-- Sprint 3 - Portal del Paciente
-- =========================================================
--
-- CONTEXTO:
-- El modelo Titular+Familiar contempla pacientes familiares 
-- (menores, dependientes) que pueden no tener teléfono propio.
-- La comunicación se garantiza a través del titular vinculado 
-- o del contacto de emergencia.
--
-- CAMBIO:
-- La columna telefono pasa de NOT NULL a NULL.
--
-- REGLA DE NEGOCIO:
-- Todo paciente debe tener al menos un canal de contacto:
-- - Teléfono propio
-- - Correo propio
-- - Contacto de emergencia
-- - Titular vinculado (para familiares)
-- Esta validación se aplica a nivel backend según el contexto.
--
-- =========================================================

USE consultorio_padre_pio;

ALTER TABLE PACIENTE MODIFY COLUMN telefono VARCHAR(15) NULL;

-- Verificación
DESCRIBE PACIENTE;