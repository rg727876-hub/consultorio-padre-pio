-- ============================================
-- DENTAL CLINIC SYSTEM - Database Schema FINAL
-- Versión actualizada con:
-- - Especialidades multi-valor (N:N)
-- - Soporte para motivo de cancelación
-- - Soporte para reprogramación
-- - Liberación de slot al cancelar (slot_activo)
-- - Registro de Atención Médica / Historia Clínica Odontológica (INT-HU019)
-- ============================================

DROP DATABASE IF EXISTS consultorio_padre_pio;
CREATE DATABASE consultorio_padre_pio;
USE consultorio_padre_pio;

-- ============================================
-- TABLA: USUARIO (personal interno de la clínica)
-- ============================================
CREATE TABLE USUARIO (
    usuario_id INT AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    DNI CHAR(8) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    direccion VARCHAR(120),
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_hash VARCHAR(255) NULL,
    estado ENUM('ACTIVO', 'INACTIVO', 'PENDIENTE') NOT NULL DEFAULT 'PENDIENTE',
    avatar VARCHAR(255),
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    CONSTRAINT PK_USUARIO PRIMARY KEY (usuario_id),
    CONSTRAINT UK_USUARIO_EMAIL UNIQUE (email),
    CONSTRAINT UK_USUARIO_DNI UNIQUE (DNI)
);

-- ============================================
-- TABLA: ROL
-- ============================================
CREATE TABLE ROL (
    rol_id INT AUTO_INCREMENT,
    nombre_rol ENUM('RECEPCIONISTA', 'CAJERO', 'ADMINISTRADOR', 'DOCTOR') NOT NULL,
    CONSTRAINT PK_ROL PRIMARY KEY (rol_id)
);

-- ============================================
-- TABLA: ROL_USUARIO (relación N:N)
-- ============================================
CREATE TABLE ROL_USUARIO (
    rol_id INT,
    usuario_id INT,
    CONSTRAINT PK_ROL_USUARIO PRIMARY KEY (rol_id, usuario_id),
    CONSTRAINT FK_ROL_USUARIO_ROL FOREIGN KEY (rol_id) REFERENCES ROL(rol_id),
    CONSTRAINT FK_ROL_USUARIO_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id)
);

-- ============================================
-- TABLA: ESPECIALIDAD (catálogo)
-- ============================================
CREATE TABLE ESPECIALIDAD (
    especialidad_id INT AUTO_INCREMENT,
    nombre VARCHAR(120) NOT NULL,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT PK_ESPECIALIDAD PRIMARY KEY (especialidad_id),
    CONSTRAINT UK_ESPECIALIDAD_NOMBRE UNIQUE (nombre)
);

-- ============================================
-- TABLA: DOCTOR (especialidades ahora en N:N)
-- ============================================
CREATE TABLE DOCTOR (
    doctor_id INT,
    nroColegiatura INT NOT NULL,
    CONSTRAINT PK_DOCTOR PRIMARY KEY (doctor_id),
    CONSTRAINT FK_DOCTOR_USUARIO FOREIGN KEY (doctor_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_DOCTOR_NROCOLEGIATURA UNIQUE (nroColegiatura)
);

-- ============================================
-- TABLA: DOCTOR_ESPECIALIDAD (relación N:N)
-- ============================================
CREATE TABLE DOCTOR_ESPECIALIDAD (
    doctor_id INT,
    especialidad_id INT,
    CONSTRAINT PK_DOCTOR_ESPECIALIDAD PRIMARY KEY (doctor_id, especialidad_id),
    CONSTRAINT FK_DE_DOCTOR FOREIGN KEY (doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT FK_DE_ESPECIALIDAD FOREIGN KEY (especialidad_id) REFERENCES ESPECIALIDAD(especialidad_id)
);

-- ============================================
-- TABLA: HORARIO (disponibilidad recurrente del doctor)
-- ============================================
CREATE TABLE HORARIO (
    horario_id INT AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    dia_semana ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT PK_HORARIO PRIMARY KEY (horario_id),
    CONSTRAINT FK_HORARIO_DOCTOR FOREIGN KEY (doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT CHECK_HORAS_ORDEN CHECK (hora_inicio < hora_fin),
    CONSTRAINT UQ_HORARIO_DOCTOR_DIA_HORA UNIQUE (doctor_id, dia_semana, hora_inicio)
);

-- ============================================
-- TABLA: SERVICIO
-- ============================================
CREATE TABLE SERVICIO (
    servicio_id INT AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT NULL,
    duracion INT NOT NULL,
    costo DECIMAL(10, 2) NOT NULL,
    buffer INT NOT NULL DEFAULT 0,
    imagen VARCHAR(255),
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT PK_SERVICIO PRIMARY KEY (servicio_id),
    CONSTRAINT UK_SERVICIO_NOMBRE UNIQUE (nombre),
    CONSTRAINT CK_SERVICIO_DURACION CHECK (duracion > 0),
    CONSTRAINT CK_SERVICIO_BUFFER CHECK (buffer >= 0)
);

-- ============================================
-- TABLA: SERVICIO_DOCTOR (relación N:N)
-- ============================================
CREATE TABLE SERVICIO_DOCTOR (
    doctor_id INT,
    servicio_id INT,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT PK_SERVICIO_DOCTOR PRIMARY KEY (doctor_id, servicio_id),
    CONSTRAINT FK_SERVICIO_DOCTOR_DOCTOR FOREIGN KEY (doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT FK_SERVICIO_DOCTOR_SERVICIO FOREIGN KEY (servicio_id) REFERENCES SERVICIO(servicio_id)
);

-- ============================================
-- TABLA: PACIENTE
-- ============================================
CREATE TABLE PACIENTE (
    paciente_id INT AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    email VARCHAR(100) NULL,
    email_cuenta VARCHAR(100) NULL,
    tipo_documento ENUM('DNI', 'CE', 'PASAPORTE') NOT NULL DEFAULT 'DNI',
    numero_documento VARCHAR(20) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    direccion VARCHAR(299),
    sexo ENUM('FEMENINO', 'MASCULINO') NOT NULL,
    fecha_nacimiento DATE NULL,
    ocupacion VARCHAR(100) NULL,
    contacto_emergencia VARCHAR(150) NULL,
    password_hash VARCHAR(255) NULL,
    estado_cuenta ENUM('SIN_CUENTA', 'ACTIVO') DEFAULT 'SIN_CUENTA',
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    foto VARCHAR(255),
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion_cuenta DATETIME NOT NULL,
    CONSTRAINT PK_PACIENTE PRIMARY KEY (paciente_id),
    CONSTRAINT UQ_PACIENTE_DOCUMENTO UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT UQ_PACIENTE_EMAIL_CUENTA UNIQUE (email_cuenta),
    CONSTRAINT CK_PACIENTE_TELEFONO CHECK (CHAR_LENGTH(telefono) >= 9)
);

-- ============================================
-- TABLA: CITA (con cancelación, reprogramación y liberación de slot)
-- ============================================
CREATE TABLE CITA (
    cita_id INT AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    doctor_id INT NOT NULL,
    servicio_id INT NOT NULL,
    usuario_id INT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    precio_aplicado DECIMAL(10, 2) NOT NULL,
    codigo_cita CHAR(10) NOT NULL,
    estado ENUM('RESERVADA', 'CONFIRMADA', 'EXPIRADA', 'CANCELADA', 'ATENDIDA', 'NO_ASISTIO') NOT NULL DEFAULT 'RESERVADA',
    creado_por ENUM('PERSONAL', 'PACIENTE_ONLINE') NOT NULL DEFAULT 'PERSONAL',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Campos de cancelación
    motivo_cancelacion ENUM('PACIENTE_VOLUNTARIO', 'CLINICA_OPERATIVO', 'OTRO') NULL,
    observacion_cancelacion TEXT NULL,
    fecha_cancelacion DATETIME NULL,
    -- Campo de reprogramación
    veces_reprogramada INT DEFAULT 0,
    -- Vale 1 solo mientras la cita ocupa el horario (RESERVADA/CONFIRMADA) y NULL
    -- en cualquier otro estado. MySQL ignora los NULL en índices UNIQUE, por lo que
    -- una cita CANCELADA/EXPIRADA/etc. libera el slot para reservar de nuevo,
    -- conservando su registro en el historial.
    slot_activo TINYINT GENERATED ALWAYS AS (
        CASE WHEN estado IN ('RESERVADA', 'CONFIRMADA') THEN 1 ELSE NULL END
    ) STORED,
    CONSTRAINT PK_CITA PRIMARY KEY (cita_id),
    CONSTRAINT FK_CITA_PACIENTE FOREIGN KEY (paciente_id) REFERENCES PACIENTE(paciente_id),
    CONSTRAINT FK_CITA_DOCTOR FOREIGN KEY (doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT FK_CITA_SERVICIO FOREIGN KEY (servicio_id) REFERENCES SERVICIO(servicio_id),
    CONSTRAINT FK_CITA_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_CITA_DOCTOR_FECHA_HORA UNIQUE (doctor_id, fecha, hora_inicio, slot_activo),
    CONSTRAINT UK_CITA_CODIGO_CITA UNIQUE (codigo_cita)
);

-- ============================================
-- TABLA: HISTORIA_CLINICA (1 por paciente, antecedentes generales)
-- ============================================
CREATE TABLE HISTORIA_CLINICA (
    historia_id INT AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    antecedentes_sistemicos TEXT NULL,
    antecedentes_estomatologicos TEXT NULL,
    antecedentes_farmacologicos TEXT NULL,
    antecedentes_familiares TEXT NULL,
    antecedentes_otros TEXT NULL,
    alergias TEXT NULL,
    creado_por_doctor_id INT NOT NULL,
    actualizado_por_doctor_id INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT PK_HISTORIA_CLINICA PRIMARY KEY (historia_id),
    CONSTRAINT FK_HC_PACIENTE FOREIGN KEY (paciente_id) REFERENCES PACIENTE(paciente_id),
    CONSTRAINT FK_HC_CREADO_DOCTOR FOREIGN KEY (creado_por_doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT FK_HC_ACTUALIZADO_DOCTOR FOREIGN KEY (actualizado_por_doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT UK_HC_PACIENTE UNIQUE (paciente_id)
);

-- ============================================
-- TABLA: CONSULTA_CLINICA
-- 1 fila por cita atendida. Inmutable: solo INSERT/SELECT (controlado en backend).
-- Estructura alineada con la Historia Clínica Odontológica oficial del consultorio.
-- ============================================
CREATE TABLE CONSULTA_CLINICA (
    consulta_id INT AUTO_INCREMENT,
    cita_id INT NOT NULL,
    historia_id INT NOT NULL,
    motivo_consulta TEXT NULL,
    -- Funciones vitales al ingreso (P.A, Pulso, F.R, T)
    presion_arterial VARCHAR(20) NULL,
    pulso VARCHAR(20) NULL,
    frecuencia_respiratoria VARCHAR(20) NULL,
    temperatura DECIMAL(4,1) NULL,
    -- Enfermedad actual desglosada
    enfermedad_actual TEXT NULL,
    enfermedad_inicio TEXT NULL,
    enfermedad_evolucion TEXT NULL,
    enfermedad_estado_actual TEXT NULL,
    -- Examen regional
    examen_extraoral TEXT NULL,
    examen_intraoral TEXT NULL,
    -- Diagnósticos
    diagnostico_presuntivo TEXT NULL,
    examenes_complementarios TEXT NULL,
    diagnostico_definitivo TEXT NULL,
    diagnostico_cie10 VARCHAR(30) NULL,
    -- Plan y tratamiento
    plan_tratamiento TEXT NULL,
    prescripciones TEXT NULL,
    tratamiento_aplicado TEXT NULL,
    pronostico TEXT NULL,
    control_evolucion TEXT NULL,
    alta_paciente TEXT NULL,
    observaciones TEXT NULL,
    odontograma_url VARCHAR(255) NULL,
    firmado_por_doctor_id INT NOT NULL,
    fecha_atencion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_CONSULTA PRIMARY KEY (consulta_id),
    CONSTRAINT FK_CONSULTA_CITA FOREIGN KEY (cita_id) REFERENCES CITA(cita_id),
    CONSTRAINT FK_CONSULTA_HISTORIA FOREIGN KEY (historia_id) REFERENCES HISTORIA_CLINICA(historia_id),
    CONSTRAINT FK_CONSULTA_DOCTOR FOREIGN KEY (firmado_por_doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT UK_CONSULTA_CITA UNIQUE (cita_id)
);

-- ============================================
-- TABLA: PAGO (Forma B: solo se crea al pagar)
-- ============================================
CREATE TABLE PAGO (
    pago_id INT AUTO_INCREMENT,
    cita_id INT NOT NULL,
    usuario_id INT NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto_total DECIMAL(10, 2) NOT NULL,
    metodo_pago ENUM('YAPE', 'EFECTIVO', 'TARJETA_PRESENCIAL', 'PLIN', 'TARJETA_ONLINE') NOT NULL,
    cambio DECIMAL(10, 2) DEFAULT 0,
    numero_operacion VARCHAR(100) NULL,
    culqi_charge_id VARCHAR(100) NULL,
    culqi_outcome_code VARCHAR(50) NULL,
    ultimos_4_tarjeta CHAR(4) NULL,
    marca_tarjeta VARCHAR(20) NULL,
    estado ENUM('PENDIENTE', 'COMPLETADO', 'FALLIDO') NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT PK_PAGO PRIMARY KEY (pago_id),
    CONSTRAINT FK_PAGO_CITA FOREIGN KEY (cita_id) REFERENCES CITA(cita_id),
    CONSTRAINT FK_PAGO_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_PAGO_CITA UNIQUE (cita_id)
);

-- ============================================
-- TABLA: COMPROBANTE
-- ============================================
CREATE TABLE COMPROBANTE (
    comprobante_id INT AUTO_INCREMENT,
    pago_id INT NOT NULL,
    tipo_comprobante ENUM('BOLETA', 'FACTURA') NOT NULL,
    serie VARCHAR(10) NOT NULL,
    numero INT NOT NULL,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('EMITIDO', 'ANULADO') NOT NULL DEFAULT 'EMITIDO',
    monto_final DECIMAL(10, 2) NOT NULL,
    nubefact_id VARCHAR(50) NULL,
    nubefact_cpe_url VARCHAR(500) NULL,
    nubefact_pdf_url VARCHAR(500) NULL,
    nubefact_hash VARCHAR(255) NULL,
    nubefact_aceptado_sunat BOOLEAN DEFAULT NULL,
    subtotal_exonerado DECIMAL(10,2) DEFAULT 0,
    igv DECIMAL(10,2) DEFAULT 0,
    cliente_ruc CHAR(11) NULL,
    cliente_razon_social VARCHAR(200) NULL,
    enviado_correo BOOLEAN DEFAULT FALSE,
    fecha_envio_correo DATETIME NULL,
    CONSTRAINT PK_COMPROBANTE PRIMARY KEY (comprobante_id),
    CONSTRAINT FK_COMPROBANTE_PAGO FOREIGN KEY (pago_id) REFERENCES PAGO(pago_id),
    CONSTRAINT UK_COMPROBANTE_SERIE_NUMERO UNIQUE (serie, numero)
);

-- ============================================
-- TABLA: AUDITORIA
-- ============================================
CREATE TABLE AUDITORIA (
    auditoria_id INT AUTO_INCREMENT,
    usuario_id INT NULL,
    paciente_id INT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(50) NULL,
    entidad_id INT NULL,
    detalles TEXT NULL,
    ip_origen VARCHAR(45) NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_AUDITORIA PRIMARY KEY (auditoria_id),
    CONSTRAINT FK_AUDIT_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT FK_AUDIT_PACIENTE FOREIGN KEY (paciente_id) REFERENCES PACIENTE(paciente_id)
);

-- ============================================
-- TABLA: TOKEN_ACTIVACION
-- ============================================
CREATE TABLE TOKEN_ACTIVACION (
    token_id INT AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_expira DATETIME NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_usado DATETIME NULL,
    CONSTRAINT PK_TOKEN PRIMARY KEY (token_id),
    CONSTRAINT FK_TOKEN_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_TOKEN UNIQUE (token)
);

-- ============================================
-- TABLA: TOKEN_RECUPERACION_USUARIO
-- ============================================
CREATE TABLE TOKEN_RECUPERACION_USUARIO (
    token_id INT AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_expira DATETIME NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_usado DATETIME NULL,
    CONSTRAINT PK_TOKEN_REC_USUARIO PRIMARY KEY (token_id),
    CONSTRAINT FK_TOKEN_REC_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_TOKEN_REC_USUARIO UNIQUE (token)
);

-- ============================================
-- TABLA: TOKEN_RECUPERACION_PACIENTE
-- ============================================
CREATE TABLE TOKEN_RECUPERACION_PACIENTE (
    token_id INT AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_expira DATETIME NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_usado DATETIME NULL,
    CONSTRAINT PK_TOKEN_REC_PACIENTE PRIMARY KEY (token_id),
    CONSTRAINT FK_TOKEN_REC_PACIENTE FOREIGN KEY (paciente_id) REFERENCES PACIENTE(paciente_id),
    CONSTRAINT UK_TOKEN_REC_PACIENTE UNIQUE (token)
);

-- ============================================
-- ÍNDICES PARA RENDIMIENTO
-- ============================================
CREATE INDEX idx_cita_fecha ON CITA(fecha);
CREATE INDEX idx_cita_doctor_fecha ON CITA(doctor_id, fecha);
CREATE INDEX idx_cita_paciente ON CITA(paciente_id);
CREATE INDEX idx_cita_estado ON CITA(estado);
CREATE INDEX idx_pago_fecha ON PAGO(fecha_pago);
CREATE INDEX idx_paciente_documento ON PACIENTE(tipo_documento);
CREATE INDEX idx_consulta_doctor ON CONSULTA_CLINICA(firmado_por_doctor_id);
CREATE INDEX idx_consulta_historia ON CONSULTA_CLINICA(historia_id);
CREATE INDEX idx_token_usuario ON TOKEN_ACTIVACION(usuario_id);
CREATE INDEX idx_doctor_especialidad ON DOCTOR_ESPECIALIDAD(especialidad_id);

-- ============================================================
-- DATOS INICIALES (SEED)
-- ============================================================

-- Especialidades odontológicas reconocidas (catálogo) — para doctores especializados
INSERT INTO ESPECIALIDAD (nombre) VALUES
    ('Ortodoncia y Ortopedia Maxilar'),
    ('Cirugía Bucal y Maxilofacial'),
    ('Endodoncia'),
    ('Periodoncia e Implantología'),
    ('Rehabilitación Oral'),
    ('Odontopediatría'),
    ('Radiología Bucal y Maxilofacial'),
    ('Patología Bucal'),
    ('Salud Pública Estomatológica');

-- Roles del sistema
INSERT INTO ROL (nombre_rol) VALUES
    ('ADMINISTRADOR'),
    ('RECEPCIONISTA'),
    ('CAJERO'),
    ('DOCTOR');

-- Usuario administrador (único usuario inicial)
-- IMPORTANTE: el password_hash de abajo es una credencial temporal SOLO para el
-- primer arranque. Cámbiala inmediatamente tras el primer login. NO documentes
-- la contraseña en texto plano aquí ni en ningún archivo versionado.
INSERT INTO USUARIO (nombre, apellido, email, DNI, telefono, estado, password_hash)
VALUES (
    'Admin',
    'Consultorio',
    'consultoripadrepio@gmail.com',
    '00000001',
    '999999999',
    'ACTIVO',
    '$2b$10$8ekeEhx0Abi9VOQp/hkFgOC0.2HY2zCIGHDpGZ2uOkhwcHaMHLUuO'
);

-- Asignar rol ADMINISTRADOR al admin
INSERT INTO ROL_USUARIO (rol_id, usuario_id)
SELECT r.rol_id, u.usuario_id
FROM ROL r, USUARIO u
WHERE r.nombre_rol = 'ADMINISTRADOR'
  AND u.email = 'consultoripadrepio@gmail.com';

-- Servicios que ofrece la clínica
-- NOTA: duración (min) y costo son valores iniciales; ajústalos en "Gestionar servicios".
INSERT INTO SERVICIO (nombre, duracion, costo, buffer) VALUES
    ('Brackets de ortodoncia', 60, 0.00, 10),
    ('Limpieza dental',        30, 0.00,  5),
    ('Curaciones',             30, 0.00, 10),
    ('Blanqueamiento dental',  60, 0.00, 15),
    ('Prótesis fija',          60, 0.00, 15),
    ('Prótesis removible',     60, 0.00, 15),
    ('Exodoncias',             45, 0.00, 15),
    ('Endodoncia',             60, 0.00, 15),
    ('Odontopediatría',        30, 0.00, 10),
    ('Implante dental',        90, 0.00, 20);
