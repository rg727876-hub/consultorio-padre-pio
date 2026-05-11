-- ============================================
-- DENTAL CLINIC SYSTEM - Database Schema FINAL
-- Versión integrada: lo mejor de ambos modelos
-- 
-- Decisiones de diseño:
-- - PACIENTE: solo datos personales y de cuenta de login
-- - HISTORIA_CLINICA: 1 por paciente, contiene antecedentes médicos generales
-- - CONSULTA_CLINICA: 1 por cita atendida, contiene los datos clínicos de esa visita
-- ============================================

DROP DATABASE IF EXISTS clinica_padre_pio;
CREATE DATABASE clinica_padre_pio;
USE clinica_padre_pio;

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
-- TABLA: DOCTOR (especialización de USUARIO)
-- ============================================
CREATE TABLE DOCTOR (
    doctor_id INT,
    especialidad VARCHAR(120) NOT NULL,
    nroColegiatura INT NOT NULL, -- ver si cambiar
    CONSTRAINT PK_DOCTOR PRIMARY KEY (doctor_id),
    CONSTRAINT FK_DOCTOR_USUARIO FOREIGN KEY (doctor_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_DOCTOR_NROCOLEGIATURA UNIQUE (nroColegiatura)
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
-- Agregado: descripcion (idea tomada del modelo del compañero)
-- ============================================
CREATE TABLE SERVICIO (
    servicio_id INT AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT NULL,                       -- útil para mostrar en web pública
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
-- AHORA MÁS LIMPIA: solo datos personales, contacto y cuenta de login
-- (los antecedentes médicos van en HISTORIA_CLINICA)
-- ============================================
CREATE TABLE PACIENTE (
    paciente_id INT AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    email VARCHAR(100) NULL,                     -- email de CONTACTO
    email_cuenta VARCHAR(100) NULL,              -- email de LOGIN (único, NULL si no tiene cuenta)
    tipo_documento ENUM('DNI', 'CE', 'PASAPORTE') NOT NULL DEFAULT 'DNI',
	numero_documento VARCHAR(20) NOT NULL,  -- ya no CHAR(8)
    telefono VARCHAR(15) NOT NULL,
    direccion VARCHAR(299),
    sexo ENUM('FEMENINO', 'MASCULINO') NOT NULL,
    fecha_nacimiento DATE NULL,
    ocupacion VARCHAR(100) NULL,
    contacto_emergencia VARCHAR(150) NULL,
    -- Datos de cuenta de paciente (login)
    password_hash VARCHAR(255) NULL,
    estado_cuenta ENUM('SIN_CUENTA', 'ACTIVO') DEFAULT 'SIN_CUENTA',
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    -- Estado del paciente como entidad
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    foto VARCHAR(255),
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion_cuenta DATETIME NULL,
    CONSTRAINT PK_PACIENTE PRIMARY KEY (paciente_id),
	CONSTRAINT UQ_PACIENTE_DOCUMENTO UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT UQ_PACIENTE_EMAIL_CUENTA UNIQUE (email_cuenta),
    CONSTRAINT CK_PACIENTE_TELEFONO CHECK (CHAR_LENGTH(telefono) >= 9)
);

-- ============================================
-- TABLA: CITA (la reserva del horario)
-- usuario_id NULL si la creó el paciente desde la web
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
    CONSTRAINT PK_CITA PRIMARY KEY (cita_id),
    CONSTRAINT FK_CITA_PACIENTE FOREIGN KEY (paciente_id) REFERENCES PACIENTE(paciente_id),
    CONSTRAINT FK_CITA_DOCTOR FOREIGN KEY (doctor_id) REFERENCES DOCTOR(doctor_id),
    CONSTRAINT FK_CITA_SERVICIO FOREIGN KEY (servicio_id) REFERENCES SERVICIO(servicio_id),
    CONSTRAINT FK_CITA_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIO(usuario_id),
    CONSTRAINT UK_CITA_DOCTOR_FECHA_HORA UNIQUE (doctor_id, fecha, hora_inicio),
    CONSTRAINT UK_CITA_CODIGO_CITA UNIQUE (codigo_cita)
);

-- ============================================
-- TABLA: HISTORIA_CLINICA
-- 1 fila por paciente (UNIQUE paciente_id).
-- Contiene los antecedentes médicos generales que casi no cambian.
-- Se crea cuando el paciente tiene su primera consulta.
-- ============================================
CREATE TABLE HISTORIA_CLINICA (
    historia_id INT AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    -- Antecedentes médicos generales (los actualiza el doctor)
    antecedentes_sistemicos TEXT NULL,
    antecedentes_estomatologicos TEXT NULL,
    antecedentes_farmacologicos TEXT NULL,
    antecedentes_familiares TEXT NULL,
    antecedentes_otros TEXT NULL,
    alergias TEXT NULL,
    -- Auditoría de la historia clínica
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
-- 1 fila por cada cita atendida (UNIQUE cita_id).
-- Registra los datos clínicos específicos de esa visita.
-- Inmutable: no se permite UPDATE, solo INSERT y SELECT (controlado en backend).
-- ============================================
CREATE TABLE CONSULTA_CLINICA (
    consulta_id INT AUTO_INCREMENT,
    cita_id INT NOT NULL,
    historia_id INT NOT NULL,                    -- cada consulta pertenece a una historia clínica
    motivo_consulta TEXT NULL,
    enfermedad_actual TEXT NULL,
    examen_extraoral TEXT NULL,
    examen_intraoral TEXT NULL,
    diagnostico_presuntivo TEXT NULL,
    examenes_complementarios TEXT NULL,
    diagnostico_definitivo TEXT NULL,
    plan_tratamiento TEXT NULL,
    tratamiento_aplicado TEXT NULL,
    pronostico TEXT NULL,
    control_evolucion TEXT NULL,                 -- idea tomada del modelo del compañero
    alta_paciente TEXT NULL,                     -- idea tomada del modelo del compañero
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
-- TABLA: PAGO
-- usuario_id NULL para pagos online (sin cajero)
-- Agregados: cambio, numero_operacion (ideas tomadas del modelo del compañero)
-- ============================================
CREATE TABLE PAGO (
    pago_id INT AUTO_INCREMENT,
    cita_id INT NOT NULL,
    usuario_id INT NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto_total DECIMAL(10, 2) NOT NULL,
    metodo_pago ENUM('YAPE', 'EFECTIVO', 'TARJETA', 'PLIN', 'MERCADOPAGO_ONLINE') NOT NULL,
    cambio DECIMAL(10, 2) DEFAULT 0,             -- útil para pagos en efectivo
    numero_operacion VARCHAR(100) NULL,          -- número de operación local (Yape, Plin, tarjeta presencial)
    referencia_externa VARCHAR(100) NULL,        -- ID de transacción de MercadoPago
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
    CONSTRAINT PK_COMPROBANTE PRIMARY KEY (comprobante_id),
    CONSTRAINT FK_COMPROBANTE_PAGO FOREIGN KEY (pago_id) REFERENCES PAGO(pago_id),
    CONSTRAINT UK_COMPROBANTE_SERIE_NUMERO UNIQUE (serie, numero)
);

-- ============================================
-- TABLA: AUDITORIA
-- Registro de acciones críticas del sistema
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


-- ============================================================
-- DATOS INICIALES (SEED)
-- ============================================================

-- Roles del sistema
INSERT INTO ROL (nombre_rol) VALUES
    ('ADMINISTRADOR'),
    ('RECEPCIONISTA'),
    ('DOCTOR'),
    ('CAJERO');

-- Usuario administrador por defecto
-- Email: admin@clinica.com | Password: Admin123!
INSERT INTO USUARIO (nombre, apellido, email, DNI, telefono, estado, password_hash)
VALUES (
    'Admin',
    'Sistema',
    'admin@clinica.com',
    '00000001',
    '999999999',
    'ACTIVO',
    '$2b$10$vNrK3VOQ1TwR8Yi8ws.0eO.kQ0qal/YfHmLE7uVSyRBQ2y9fktRDu'
);

-- Asignar rol ADMINISTRADOR al admin
INSERT INTO ROL_USUARIO (rol_id, usuario_id)
SELECT r.rol_id, u.usuario_id
FROM ROL r, USUARIO u
WHERE r.nombre_rol = 'ADMINISTRADOR'
  AND u.email = 'admin@clinica.com';

-- Servicios dentales de ejemplo
INSERT INTO SERVICIO (nombre, descripcion, duracion, costo, buffer, estado) VALUES
    ('Limpieza Dental',   'Profilaxis dental completa con ultrasonido',    30,  80.00, 10, 'ACTIVO'),
    ('Extracción Simple', 'Extracción de pieza dental sin complicaciones', 45, 120.00, 15, 'ACTIVO'),
    ('Curación Dental',   'Restauración con resina fotocurada',            40, 100.00, 10, 'ACTIVO'),
    ('Blanqueamiento',    'Blanqueamiento dental con lámpara LED',         60, 250.00, 10, 'ACTIVO'),
    ('Consulta General',  'Evaluación y diagnóstico inicial',              20,  50.00, 10, 'ACTIVO');