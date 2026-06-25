-- ════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Modelo Titular + Familiar para portal web del paciente
-- Sprint 3
-- ════════════════════════════════════════════════════════════════════════

USE consultorio_padre_pio;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Extender ENUM estado_cuenta en PACIENTE
--    Agregamos 'FAMILIAR' para identificar pacientes vinculados como familiar
--    de un titular (sin cuenta web propia).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE PACIENTE 
MODIFY COLUMN estado_cuenta ENUM('SIN_CUENTA', 'ACTIVO', 'FAMILIAR') 
NOT NULL DEFAULT 'SIN_CUENTA';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Crear tabla PACIENTE_FAMILIAR
--    Relación N:N entre titulares (cuentas web) y sus familiares (pacientes).
--    Un familiar puede estar vinculado a varios titulares (madre Y padre).
--    Las vinculaciones tienen estado para permitir desvincular sin eliminar.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE PACIENTE_FAMILIAR (
    relacion_id           INT AUTO_INCREMENT,
    titular_id            INT NOT NULL,
    familiar_id           INT NOT NULL,
    parentesco            ENUM(
                            'HIJO', 'HIJA', 'CONYUGE',
                            'PADRE', 'MADRE',
                            'HERMANO', 'HERMANA',
                            'ABUELO', 'ABUELA',
                            'OTRO'
                          ) NOT NULL,
    estado                ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    fecha_vinculacion     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_desvinculacion  DATETIME NULL,

    CONSTRAINT PK_PACIENTE_FAMILIAR PRIMARY KEY (relacion_id),
    
    CONSTRAINT FK_PF_TITULAR  
        FOREIGN KEY (titular_id)  REFERENCES PACIENTE(paciente_id),
    
    CONSTRAINT FK_PF_FAMILIAR 
        FOREIGN KEY (familiar_id) REFERENCES PACIENTE(paciente_id),
    
    CONSTRAINT UK_PF_RELACION 
        UNIQUE (titular_id, familiar_id),
    
    CONSTRAINT CHK_PF_NO_AUTO  
        CHECK (titular_id != familiar_id)
);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Índices para mejorar rendimiento de queries comunes
-- ──────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_pf_titular  ON PACIENTE_FAMILIAR(titular_id);
CREATE INDEX idx_pf_familiar ON PACIENTE_FAMILIAR(familiar_id);

-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN
-- Después de ejecutar el script, valida con:
-- ════════════════════════════════════════════════════════════════════════

-- 1. Verificar ENUM extendido:
-- SHOW COLUMNS FROM PACIENTE LIKE 'estado_cuenta';
-- Esperado: enum('SIN_CUENTA','ACTIVO','FAMILIAR')

-- 2. Verificar tabla nueva:
-- DESCRIBE PACIENTE_FAMILIAR;

-- 3. Verificar constraints:
-- SHOW CREATE TABLE PACIENTE_FAMILIAR;

-- 4. Verificar índices:
-- SHOW INDEX FROM PACIENTE_FAMILIAR;