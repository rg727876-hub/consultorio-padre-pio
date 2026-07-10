-- Sprint 3: Refactor campos de pasarela de pagos a genéricos
-- Motivación: desacoplar el modelo PAGO de una pasarela específica (Culqi)
-- para permitir integraciones con diferentes proveedores (Mercado Pago, Culqi, etc.)

USE consultorio_padre_pio;

ALTER TABLE PAGO 
  CHANGE culqi_charge_id pasarela_transaction_id VARCHAR(100) NULL,
  CHANGE culqi_outcome_code pasarela_status VARCHAR(50) NULL,
  ADD COLUMN pasarela_nombre VARCHAR(20) NULL AFTER pasarela_status;

-- Verificar
DESCRIBE PAGO;