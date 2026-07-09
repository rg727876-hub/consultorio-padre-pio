-- Sprint 3: Reserva y pago de cita online (WEB-HU003)
-- Motivación: el portal permite que un titular reserve una cita para sí mismo o para un
-- familiar vinculado. paciente_id sigue siendo para quién es la cita; titular_id identifica
-- quién inició la reserva desde el portal (requerido para auditoría).

USE consultorio_padre_pio;

ALTER TABLE CITA
  ADD COLUMN titular_id INT NULL AFTER paciente_id,
  ADD CONSTRAINT FK_CITA_TITULAR FOREIGN KEY (titular_id) REFERENCES PACIENTE(paciente_id);

-- Verificar
DESCRIBE CITA;
