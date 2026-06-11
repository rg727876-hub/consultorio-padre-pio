# 🏥 Sistema de Gestión Clínica - Consultorio Padre Pío

Sistema web completo para la gestión integral de una clínica dental, desarrollado con **Node.js + Express** en el backend y **React + Vite** en el frontend.

> ⚠️ **PROYECTO EN DESARROLLO** - Sprint 1: MVP Funcional en progreso

---

## 📋 Tabla de Contenidos

- [Estado del Proyecto](#-estado-del-proyecto--roadmap)
- [Características](#características)
- [Requisitos del Sistema](#requisitos-del-sistema)
- [Instalación](#instalación)
- [Configuración del Entorno](#configuración-del-entorno)
- [Ejecutar el Sistema](#ejecutar-el-sistema)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [API Endpoints](#api-endpoints)
- [Informe Técnico](#informe-técnico)

---

## 🆕 Novedades en la rama `feature/admin`

En esta rama se han implementado las funcionalidades de **Listado y control centralizado de personal** (PIO-16) y **Gestión de roles administrativos** (PIO-17).

**Nuevos Endpoints (API):**
- `GET /api/users`: Listado completo de usuarios (solo administradores).
- `GET /api/users/:id`: Obtiene el perfil detallado del usuario junto con su historial de auditoría.
- `PUT /api/users/:id`: Edición de datos personales (valida unicidad de correo).
- `PUT /api/users/:id/status`: Activa/Desactiva usuarios. Evita desactivar al último administrador.
- `POST /api/users/:id/resend-activation`: Reenvía correos de activación e invalida tokens anteriores.
- `GET /api/doctors/:id/profile`: Obtiene la información personal, profesional, servicios vinculados, horarios y citas futuras de un doctor (PIO-19).
- `PUT /api/doctors/:id`: Edición avanzada para doctores, asegurando la unicidad del C.O.P. y asignación de múltiples servicios (PIO-19).
- `PUT /api/doctors/:id/status`: Activa/Desactiva doctores. Cancela automáticamente las citas futuras en estado Reservada o Confirmada (PIO-19).

**Nuevas Vistas Frontend:**
- `/admin/usuarios`: Tabla de listado de personal con filtros por rol y estado. Al seleccionar un Doctor, te redirige automáticamente a su perfil médico especializado.
- `/admin/usuarios/:id`: Perfil general con formulario de edición bloqueado parcialmente, validaciones offline y una pestaña de **Historial de Actividad**.
- `/admin/medicos/:id`: Perfil especializado de Doctor (PIO-19). Incluye el C.O.P., selección múltiple de servicios médicos, y un **calendario semanal de solo lectura** con sus bloques horarios.
- Alerta inteligente de cancelación: Si se desactiva un doctor con agenda activa, se cancelan automáticamente sus citas futuras.

---

## 🚀 Estado del Proyecto & Roadmap

### Sprint 1: MVP Funcional (Vertical Slice)

**Objetivo:** Implementar funcionalidades core del sistema para validar el flujo completo de negocio.

#### Historias de Usuario en Desarrollo:

| ID | Descripción | Estado |
|----|-----------|---------| 
| **INT-HU001** | Login seguro con email y contraseña | 🟢 Completada |
| **INT-HU003** | Registro de nuevos usuarios por administrador | 🟢 Completada |
| **INT-HU008** | Registrar nuevos servicios clínicos | 🟡 En Progreso |
| **INT-HU007** | Definir y gestionar horarios de doctores | 🟡 En Progreso |
| **INT-HU010** | Registrar pacientes por recepcionista | 🟡 En Progreso |
| **INT-HU012** | Crear citas a pacientes registrados | 🟡 En Progreso |
| **INT-HU021** | Registrar pagos de citas | 🟡 En Progreso |
| **INT-HU013** | Listar y buscar citas existentes | 🟡 En Progreso |
| **INT-HU014** | Visualizar información completa de cita | 🟡 En Progreso |
| **INT-HU018** | Visualizar agenda de doctor con diferentes vistas | 🟡 En Progreso |

**Leyenda:** 🟢 Completada | 🟡 En Progreso | 🔵 Planificado | ⚫ Bloqueado

---

## ✨ Características

---

## ✨ Características

### 🔐 Autenticación y Autorización
- Autenticación de pacientes y personal
- Sistema de roles (Admin, Doctor, Recepción, Paciente)
- Tokens JWT con expiración automática
- Bloqueo de cuenta tras intentos fallidos

### 👥 Gestión de Usuarios
- Registro de pacientes y personal
- Activación de cuentas por email
- Perfiles de usuario con información personal
- Sistema de auditoría de cambios

### 📅 Citas y Agendamiento
- Reserva de citas médicas
- Calendario de disponibilidad de doctores
- Expiración automática de citas no atendidas
- Confirmación y cancelación de citas

### 💰 Pagos
- Registro de pagos por citas
- Diferentes métodos de pago
- Historial de transacciones

### 👨‍⚕️ Gestión de Doctores
- Base de datos de profesionales
- Horarios disponibles
- Especialidades
- Calendario de turnos

### 🦷 Servicios Clínicos
- Catálogo de servicios
- Precios y descripciones
- Categorización de tratamientos

### 📑 Historia Clínica
- Registro de antecedentes médicos
- Consultas clínicas con detalles de tratamientos
- Acceso seguro a información del paciente

---

## 📋 Requisitos del Sistema

### Software Necesario
- **Node.js** v18+ ([Descargar](https://nodejs.org/))
- **npm** o **yarn** (incluido con Node.js)
- **MySQL** 8.0+ ([Descargar](https://dev.mysql.com/downloads/mysql/))
- **Git** (opcional, para clonar el repositorio)

### Requisitos de Hardware
- Mínimo 2GB RAM
- 500MB espacio en disco
- Conexión a Internet (para envío de emails)

---

## 🚀 Instalación

### 1️⃣ Clonar o Descargar el Proyecto

```bash
git clone <URL_DEL_REPOSITORIO>
cd consultorio-padre-pio
```

### 2️⃣ Instalar pnpm

```bash
npm install -g pnpm
```

Verifica que se instaló correctamente:
```bash
pnpm --version
```

### 3️⃣ Instalar Dependencias del Backend

```bash
cd backend
pnpm install
```

---

### 4️⃣ Instalar Dependencias del Frontend

```bash
cd ../frontend
pnpm install
```

---

## ⚙️ Configuración del Entorno

### 🔧 Configurar Backend

1. **Crear archivo `.env` en la carpeta `backend/`**

```bash
cd backend
copy .env.example .env
```

2. **Editar `.env` con tus datos:**

```env
# Servidor
PORT=4000
NODE_ENV=development

# MySQL Local
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=clinica_padre_pio

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura_aqui
JWT_EXPIRES_IN=8h

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Email (Mailtrap para desarrollo, Gmail para producción)
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=587
MAIL_USER=tu_usuario_mailtrap
MAIL_PASS=tu_contraseña_mailtrap
MAIL_FROM=Clínica Padre Pio <no-reply@clinica.com>

# Activación de cuentas
ACTIVATION_TOKEN_HOURS=24
```

### 📦 Crear Base de Datos

1. **Abre MySQL desde terminal o MySQL Workbench**

```bash
mysql -u root -p
```

2. **Ejecuta el script de schema:**

```sql
source database/schema.sql
```

3. **(Opcional) Agregar datos de prueba:**

```sql
source database/seed.sql
```

---

## ▶️ Ejecutar el Sistema

### Opción 1️⃣: Ejecutar Frontend y Backend Simultáneamente

**Terminal 1 - Backend (Puerto 4000):**

```bash
cd backend
pnpm dev
```

Esperarás ver:
```
Servidor corriendo en http://localhost:4000
Entorno: development
MySQL conectado — BD: clinica_padre_pio
```

**Terminal 2 - Frontend (Puerto 5173):**

```bash
cd frontend
pnpm dev
```

Verás:
```
VITE v8.0.10  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Opción 2️⃣: Compilar para Producción

**Frontend:**

```bash
cd frontend
pnpm build
```

Esto generará una carpeta `dist/` con los archivos optimizados.

**Backend (Producción):**

```bash
cd backend
NODE_ENV=production pnpm start
```

---

## 📁 Estructura del Proyecto

```
consultorio-padre-pio/
├── backend/                          # API REST (Node.js + Express)
│   ├── src/
│   │   ├── app.js                   # Configuración de Express
│   │   ├── config/
│   │   │   ├── db.js                # Conexión MySQL
│   │   │   └── mailer.js            # Configuración de emails
│   │   ├── controllers/             # Lógica de negocio
│   │   │   ├── authPatient.controller.js
│   │   │   ├── authStaff.controller.js
│   │   │   ├── appointment.controller.js
│   │   │   ├── patient.controller.js
│   │   │   ├── doctor.controller.js
│   │   │   ├── payment.controller.js
│   │   │   ├── service.controller.js
│   │   │   └── ...
│   │   ├── models/                  # Modelos de datos (SQL)
│   │   ├── routes/                  # Rutas de API
│   │   ├── middlewares/             # Autenticación, errores, roles
│   │   ├── jobs/                    # Tareas programadas (cron)
│   │   └── utils/                   # Utilidades (JWT, mailer, etc)
│   ├── server.js                    # Entrada del servidor
│   ├── package.json
│   ├── .env.example
│   └── .env                         # (crear después)
│
├── frontend/                         # Aplicación React + Vite
│   ├── src/
│   │   ├── components/              # Componentes React
│   │   │   └── auth/
│   │   │       └── Login.jsx
│   │   ├── pages/                   # Páginas/Pantallas
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── admin/
│   │   │   └── auth/
│   │   ├── context/                 # Context API (AuthContext)
│   │   ├── hooks/                   # Custom hooks (useAuth)
│   │   ├── api/                     # Configuración axios
│   │   ├── assets/                  # Imágenes, fuentes
│   │   ├── routes/                  # Rutas (AppRouter)
│   │   ├── App.jsx                  # Componente principal
│   │   └── main.jsx                 # Entrada
│   ├── vite.config.js
│   ├── package.json
│   ├── index.html
│   └── public/
│
├── database/
│   ├── schema.sql                   # Esquema completo
│   └── seed.sql                     # Datos de prueba (opcional)
│
└── README.md                         # Este archivo
```

---

## 🔌 API Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/staff/login` | Login personal |
| `POST` | `/api/auth/patient/login` | Login paciente |
| `POST` | `/api/auth/patient/register` | Registro paciente |
| `POST` | `/api/auth/activate` | Activar cuenta por email |

### Pacientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/patients` | Listar pacientes |
| `GET` | `/api/patients/:id` | Obtener paciente |
| `PUT` | `/api/patients/:id` | Actualizar paciente |
| `DELETE` | `/api/patients/:id` | Eliminar paciente |

### Citas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/appointments` | Listar citas |
| `POST` | `/api/appointments` | Crear cita |
| `PUT` | `/api/appointments/:id` | Actualizar cita |
| `DELETE` | `/api/appointments/:id` | Cancelar cita |

### Doctores

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/doctors` | Listar doctores |
| `GET` | `/api/doctors/:id` | Obtener doctor |
| `GET` | `/api/doctors/:id/schedule` | Agenda disponible |

### Servicios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/services` | Listar servicios |
| `POST` | `/api/services` | Crear servicio |
| `PUT` | `/api/services/:id` | Actualizar servicio |

### Pagos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/payments` | Listar pagos |
| `POST` | `/api/payments` | Registrar pago |

---

## 🐛 Solución de Problemas

### ❌ Error: "MySQL conectado falla"

**Solución:**
1. Verifica que MySQL esté ejecutándose: `services.msc` (Windows)
2. Comprueba las credenciales en `.env`
3. Asegúrate de que la BD existe: `mysql -u root -p clinica_padre_pio`

### ❌ Error: "EADDRINUSE: address already in use :::4000"

**Solución:**
```bash
# Mata el proceso en puerto 4000
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

### ❌ CORS Error en Frontend

**Solución:**
- Verifica que `FRONTEND_URL` en `.env.backend` sea correcto
- El CORS está configurado en `src/app.js`

### ❌ Emails no se envían

**Solución:**
1. Usa Mailtrap para desarrollo ([Crear cuenta gratuita](https://mailtrap.io))
2. Copia credenciales en `MAIL_USER` y `MAIL_PASS`
3. Para producción usa Gmail o SendGrid



---

## 📊 Informe Técnico

### 🎯 Descripción General

El **Sistema de Gestión Clínica** es una aplicación web full-stack diseñada para optimizar la operación de una clínica dental. Implementa una arquitectura cliente-servidor moderna con separación clara de responsabilidades y seguridad robusta.



### 🔐 Seguridad

- **Autenticación:** JWT (JSON Web Tokens) con expiración
- **Contraseñas:** Hash bcryptjs (salt rounds: 10)
- **CORS:** Configurado para origen específico
- **Helmet:** Headers de seguridad HTTP
- **Validación:** express-validator en todas las rutas
- **Bloqueo de cuenta:** Después de 5 intentos fallidos

### 📦 Tecnologías Utilizadas

#### Backend
| Tecnología | Propósito |
|------------|----------|
| Node.js | Runtime JavaScript |
| Express | Framework web |
| MySQL2 | Driver de base de datos |
| JWT | Autenticación |
| bcryptjs | Hash de contraseñas |
| nodemailer | Envío de emails |
| node-cron | Tareas programadas |
| Helmet | Seguridad HTTP |
| CORS | Control de origenes |
| Morgan | Logging HTTP |

#### Frontend
| Tecnología | Propósito |
|------------|----------|
| React | Librería UI |
| Vite | Bundler de módulos |
| React Router | Enrutamiento |
| Axios | Cliente HTTP |
| Tailwind CSS | Estilos CSS |
| Lucide React | Iconos |
| React Hot Toast | Notificaciones |
| Day.js | Manipulación de fechas |

### 💾 Modelo de Datos

**Tablas Principales:**

1. **USUARIO** - Personal interno de la clínica (recepcionistas, cajeros, administradores, doctores)
   - Relaciones: Rol_Usuario, Doctor, Cita, Pago, Auditoria, Token_Activacion
   - Estados: ACTIVO, INACTIVO, PENDIENTE

2. **ROL** - Categorías de permisos y acceso en el sistema
   - Relaciones: Rol_Usuario
   - Roles permitidos: RECEPCIONISTA, CAJERO, ADMINISTRADOR, DOCTOR

3. **ROL_USUARIO** - Asignación de roles a los usuarios (Tabla intermedia N:N)
   - Relaciones: Rol, Usuario

4. **DOCTOR** - Especialización del usuario con datos médicos (colegiatura, especialidad)
   - Relaciones: Usuario, Horario, Servicio_Doctor, Cita, Historia_Clinica, Consulta_Clinica

5. **HORARIO** - Disponibilidad recurrente de cada doctor en la semana
   - Relaciones: Doctor
   - Estados: ACTIVO, INACTIVO

6. **SERVICIO** - Catálogo de tratamientos y servicios odontológicos ofrecidos
   - Relaciones: Servicio_Doctor, Cita
   - Estados: ACTIVO, INACTIVO

7. **SERVICIO_DOCTOR** - Relación de qué servicios puede realizar cada doctor (Tabla intermedia N:N)
   - Relaciones: Doctor, Servicio
   - Estados: ACTIVO, INACTIVO

8. **PACIENTE** - Datos personales, información de contacto y credenciales de acceso web
   - Relaciones: Cita, Historia_Clinica, Auditoria
   - Estados de paciente: ACTIVO, INACTIVO
   - Estados de cuenta: SIN_CUENTA, ACTIVO

9. **CITA** - Reservas de turnos y programación de visitas
   - Relaciones: Paciente, Doctor, Servicio, Usuario (personal que la creó), Consulta_Clinica, Pago
   - Estados: RESERVADA, CONFIRMADA, EXPIRADA, CANCELADA, ATENDIDA, NO_ASISTIO

10. **HISTORIA_CLINICA** - Registro único por paciente con antecedentes médicos generales (permanentes)
    - Relaciones: Paciente, Doctor (creador), Doctor (actualizador), Consulta_Clinica

11. **CONSULTA_CLINICA** - Datos clínicos inmutables específicos de una sola visita o atención
    - Relaciones: Cita, Historia_Clinica, Doctor (quien firma la consulta)

12. **PAGO** - Transacciones económicas vinculadas a una cita médica
    - Relaciones: Cita, Usuario (cajero), Comprobante
    - Estados: PENDIENTE, COMPLETADO, FALLIDO

13. **COMPROBANTE** - Documentos fiscales y de facturación electrónica (Boletas/Facturas)
    - Relaciones: Pago
    - Estados: EMITIDO, ANULADO

14. **AUDITORIA** - Registro (log) de seguridad sobre acciones críticas dentro del sistema
    - Relaciones: Usuario, Paciente

15. **TOKEN_ACTIVACION** - Tokens temporales de seguridad para activar o recuperar cuentas
    - Relaciones: Usuario
    - Estados: Usado (Booleano: TRUE/FALSE) y Expirado (según fecha)

### 🔄 Flujos Principales

#### 1. Registro e Inicio de Sesión
```
Paciente → Registro → Email Confirmación → Activación → Login → Token JWT → Dashboard
```

#### 2. Reserva de Cita
```
Paciente → Selecciona Doctor → Elige Hora → Elige Servicio → Confirma → Cita Creada
```

#### 3. Pago
```
Cita Completada → Genera Monto → Paciente Paga → Registro de Pago → Recibo
```

#### 4. Expiración de Citas
```
Job Cron (cada hora) → Busca Citas no Atendidas > 24h → Marca EXPIRADA
```

### 📈 Escalabilidad y Performance

- **Pool de conexiones MySQL:** Maneja múltiples usuarios simultáneamente
- **Cron jobs:** Ejecutan tareas en background sin bloquear API
- **Validación cliente + servidor:** Reduce carga innecesaria
- **Compresión gzip:** Habilitada en responses
- **HTTPS ready:** Configurable con certificados SSL

### 📝 Convenciones de Código

- **Controladores:** Lógica de negocio y validaciones
- **Middlewares:** Autenticación, autorización, manejo de errores
- **Rutas:** Endpoints RESTful agrupados por recurso
- **Modelos:** Consultas SQL parametrizadas (previene SQL injection)
- **Utils:** Funciones reutilizables (JWT, emails, generadores)

### ✅ Testing

Rutas con validación y error handling:
```bash
# Pruebas manuales con cURL o Postman
curl http://localhost:4000/api/doctors -H "Authorization: Bearer TOKEN"
```

### 🚀 Despliegue Recomendado

- **Backend:** Heroku, AWS EC2, DigitalOcean
- **Frontend:** Vercel, Netlify, AWS S3 + CloudFront
- **Base de Datos:** AWS RDS MySQL, PlanetScale, DigitalOcean

---

## � Roadmap Futuro

### Sprint 2: Gestión Integral
- Gestión completa de usuarios y roles
- Portal del paciente (WEB-HU001 - WEB-HU007)
- Autenticación para pacientes
- Dashboard personalizado por rol

### Sprint 3: Reportes y Análisis
- Reportes financieros con filtros por fecha
- Gráficas de crecimiento y satisfacción
- Exportación de reportes (PDF/Excel)
- Dashboard de métricas clínicas

### Sprint 4: Optimización y Producción
- Tests automatizados (unit, integration)
- Documentación OpenAPI/Swagger
- Implementación de caché (Redis)
- Optimización de performance
- Despliegue a producción

### Features Futuros
- Notificaciones por SMS/Email a pacientes
- Integración con pasarela de pago
- Portal de pacientes móvil
- Sistema de feedback y satisfacción
- Telemedicina (videollamadas)
- Integración con sistemas externos de facturación

---

## �📞 Contacto y Soporte

Para problemas técnicos, contacta al equipo de desarrollo.

---

**Última actualización:** 14 de Mayo, 2026
**Versión:** 1.0.0
**Estado:** En Desarrollo