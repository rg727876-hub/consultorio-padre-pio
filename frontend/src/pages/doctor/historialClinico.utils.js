import { fmtFecha, fmtFechaHora } from '../recepcion/citaEstados';

export const SIN_INFO = 'Sin información registrada';

// Antecedentes generales (HISTORIA_CLINICA) en orden de la HU
export const ANTECEDENTES_FIELDS = [
  ['antecedentes_sistemicos',      'Antecedentes sistémicos'],
  ['antecedentes_estomatologicos', 'Antecedentes estomatológicos'],
  ['antecedentes_farmacologicos',  'Antecedentes farmacológicos'],
  ['antecedentes_familiares',      'Antecedentes familiares'],
  ['antecedentes_otros',           'Antecedentes otros'],
  ['alergias',                     'Alergias'],
];

const esVacio = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export const valorODefecto = (v) => (esVacio(v) ? SIN_INFO : String(v));

// Resumen de la atención (lista colapsada)
export const resumenAtencion = (a) => ({
  fecha:      fmtFechaHora(a.fecha_atencion),
  doctor:     a.firmado_por || '—',
  servicio:   a.servicio_nombre || '—',
  diagnostico: esVacio(a.diagnostico_definitivo) ? null : a.diagnostico_definitivo,
});

// Filas clínicas completas de una atención (CONSULTA_CLINICA), en orden de la HU.
// Devuelve [{ label, value }] — value=null cuando no hay dato (→ "Sin información").
export const filasAtencion = (a) => {
  const enfermedad = a.enfermedad_actual || [
    a.enfermedad_inicio       && `Inicio: ${a.enfermedad_inicio}`,
    a.enfermedad_evolucion    && `Evolución: ${a.enfermedad_evolucion}`,
    a.enfermedad_estado_actual && `Estado actual: ${a.enfermedad_estado_actual}`,
  ].filter(Boolean).join('\n');

  const vitales = [
    a.presion_arterial        && `P.A: ${a.presion_arterial}`,
    a.pulso                   && `Pulso: ${a.pulso}`,
    a.frecuencia_respiratoria && `F.R: ${a.frecuencia_respiratoria}`,
    (a.temperatura !== null && a.temperatura !== undefined) && `T: ${a.temperatura} °C`,
  ].filter(Boolean).join('  ·  ');

  const dxDefinitivo = a.diagnostico_definitivo
    ? (a.diagnostico_cie10
        ? `${a.diagnostico_definitivo} (CIE-10: ${a.diagnostico_cie10})`
        : a.diagnostico_definitivo)
    : null;

  return [
    ['Motivo de consulta',                 a.motivo_consulta],
    ['Funciones vitales',                  vitales || null],
    ['Enfermedad actual',                  enfermedad || null],
    ['Examen extraoral',                   a.examen_extraoral],
    ['Examen intraoral',                   a.examen_intraoral],
    ['Diagnóstico presuntivo',             a.diagnostico_presuntivo],
    ['Exámenes complementarios solicitados', a.examenes_complementarios],
    ['Diagnóstico definitivo',             dxDefinitivo],
    ['Plan de tratamiento',                a.plan_tratamiento],
    ['Tratamiento aplicado',               a.tratamiento_aplicado],
    ['Prescripciones / recetas',           a.prescripciones],
    ['Pronóstico',                         a.pronostico],
    ['Control y evolución',                a.control_evolucion],
    ['¿Paciente dado de alta?',            a.alta_paciente],
    ['Observaciones',                      a.observaciones],
  ].map(([label, value]) => ({ label, value: esVacio(value) ? null : String(value) }));
};

// ─────────────────────────────────────────────────────────────────
// PDF por impresión: arma un documento HTML self-contained y abre el
// diálogo de impresión del navegador ("Guardar como PDF").
// ─────────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─────────────────────────────────────────────────────────────────
// Plantilla oficial "Historia Clínica Odontológica" — Padre Pío.
// Se rellena UNA ficha por cada atención registrada.
// ─────────────────────────────────────────────────────────────────

// Línea de campo rotulado con valor (estilo formulario, subrayado)
const linea = (label, value) =>
  `<div class="fld"><span class="l">${esc(label)}</span>` +
  `<span class="v">${value ? esc(value).replace(/\n/g, '<br>') : ''}</span></div>`;

// Bloque de texto largo con caja
const bloque = (value) =>
  `<div class="box">${value ? esc(value).replace(/\n/g, '<br>') : ''}</div>`;

// Casillas N H.C con el número de historia clínica (único por paciente),
// alineado a la derecha dentro de 8 celdas, como en la ficha oficial.
const nhcBoxes = (nhc) => {
  const CELDAS = 8;
  const digits = String(nhc ?? '').slice(-CELDAS);
  const pad = CELDAS - digits.length;
  let out = '<span class="nhc-lbl">N H.C</span>';
  for (let i = 0; i < CELDAS; i++) {
    out += `<span class="nhc-cell">${esc(i < pad ? '' : digits[i - pad])}</span>`;
  }
  return `<div class="nhc">${out}</div>`;
};

// Cabecera oficial: logo a la izquierda; a la derecha PADRE PÍO /
// CENTRO ODONTOLÓGICO + casilla N H.C. Título centrado debajo.
const encabezado = (logo, nhc) => `
  <div class="head">
    <div class="head-top">
      ${logo ? `<img class="logo" src="${logo}" alt="Padre Pío" />` : '<span></span>'}
      <div class="head-right">
        <div class="clinic">PADRE PÍO</div>
        <div class="clinic-sub">CENTRO ODONTOLÓGICO</div>
        ${nhcBoxes(nhc)}
      </div>
    </div>
    <h1 class="title">HISTORIA CLÍNICA ODONTOLÓGICA</h1>
  </div>`;

// Rellena la ficha oficial de una atención
const fichaAtencion = (paciente, antecedentes, a, logo, nhc) => {
  const sexoLetra = paciente.sexo === 'FEMENINO' ? 'F' : paciente.sexo === 'MASCULINO' ? 'M' : (paciente.sexo || '');
  const dxCie10 = a.diagnostico_definitivo
    ? (a.diagnostico_cie10 ? `${a.diagnostico_definitivo}  ·  CIE-10: ${a.diagnostico_cie10}` : a.diagnostico_definitivo)
    : (a.diagnostico_cie10 || '');
  const tratamiento = [a.tratamiento_aplicado, a.prescripciones && `Prescripciones: ${a.prescripciones}`]
    .filter(Boolean).join('\n');

  return `
  <section class="ficha">
    ${encabezado(logo, nhc)}
    <div class="fechahora">FECHA Y HORA: <b>${esc(fmtFechaHora(a.fecha_atencion))}</b></div>

    <h2>I. ANAMNESIS</h2>
    <h3>1. Datos de filiación</h3>
    ${linea('Nombres y Apellidos:', paciente.nombre_completo)}
    <div class="row">
      ${linea('DNI/CE:', `${paciente.tipo_documento}: ${paciente.numero_documento}`)}
      ${linea('Edad:', paciente.edad != null ? `${paciente.edad} años` : '')}
      ${linea('Sexo:', sexoLetra)}
    </div>
    ${linea('Dirección:', paciente.direccion)}
    <div class="row">
      ${linea('Fecha de nacimiento:', paciente.fecha_nacimiento ? fmtFecha(paciente.fecha_nacimiento) : '')}
      ${linea('Ocupación:', paciente.ocupacion)}
    </div>
    ${linea('Teléfono:', paciente.telefono)}
    ${linea('En caso de emergencia llamar a:', paciente.contacto_emergencia)}

    <h3>2. Motivo de consulta</h3>
    ${bloque(a.motivo_consulta)}

    <h3>3. Enfermedad actual</h3>
    ${linea('Inicio:', a.enfermedad_inicio || a.enfermedad_actual)}
    ${linea('Evolución:', a.enfermedad_evolucion)}
    ${linea('Estado actual:', a.enfermedad_estado_actual)}

    <h3>4. Antecedentes</h3>
    <p class="sub">4.1 Personales</p>
    ${linea('Sistémicos:', antecedentes?.antecedentes_sistemicos)}
    ${linea('Estomatológicos:', antecedentes?.antecedentes_estomatologicos)}
    ${linea('Farmacológicos:', antecedentes?.antecedentes_farmacologicos)}
    ${linea('Otros:', antecedentes?.antecedentes_otros)}
    <p class="sub">4.2 Familiares</p>
    ${linea('Familiares:', antecedentes?.antecedentes_familiares)}
    ${linea('Alergias:', antecedentes?.alergias)}

    <h2>II. EXAMEN CLÍNICO</h2>
    <h3>1. General — Funciones vitales al ingreso</h3>
    <div class="row">
      ${linea('P.A:', a.presion_arterial)}
      ${linea('Pulso:', a.pulso)}
      ${linea('F.R:', a.frecuencia_respiratoria)}
      ${linea('T:', a.temperatura != null ? `${a.temperatura} °C` : '')}
    </div>
    <h3>2. Regional</h3>
    <p class="sub">Extra oral</p>
    ${bloque(a.examen_extraoral)}
    <p class="sub">Intra oral</p>
    ${bloque(a.examen_intraoral)}

    <h2>III. DIAGNÓSTICO PRESUNTIVO</h2>
    ${bloque(a.diagnostico_presuntivo)}

    <h2>IV. EXÁMENES COMPLEMENTARIOS</h2>
    ${bloque(a.examenes_complementarios)}

    <h2>V. DIAGNÓSTICO - CIE 10</h2>
    ${bloque(dxCie10)}

    <h2>VI. PLAN DE TRATAMIENTO</h2>
    ${bloque(a.plan_tratamiento)}

    <h2>VII. TRATAMIENTO</h2>
    ${bloque(tratamiento)}

    ${a.odontograma_url ? `<h3>Odontograma</h3><img class="odo" src="${esc(a.odontograma_url)}" alt="Odontograma" />` : ''}

    <h2>VIII. PRONÓSTICO</h2>
    ${bloque(a.pronostico)}

    <h2>IX. CONTROL Y EVOLUCIÓN</h2>
    ${bloque(a.control_evolucion)}

    <h2>X. ALTA DEL PACIENTE</h2>
    ${bloque(a.alta_paciente)}

    ${a.observaciones ? `<h2>OBSERVACIONES</h2>${bloque(a.observaciones)}` : ''}

    <div class="firma">
      <div class="firma-line"></div>
      <div>FIRMA Y SELLO DEL PROFESIONAL</div>
      <div class="firma-doc">${esc(a.firmado_por || '')}</div>
      <div class="firma-cita">N° Cita: ${esc(a.codigo_cita || '')} · Servicio: ${esc(a.servicio_nombre || '')}</div>
    </div>
  </section>`;
};

export const generarHistorialPDF = ({ paciente, tiene_historia, historia_id, antecedentes, atenciones }, logo = '') => {
  const generado = fmtFechaHora(new Date().toISOString());

  let cuerpo;
  if (!tiene_historia || atenciones.length === 0) {
    // Sin atenciones: una ficha con la filiación y el aviso
    cuerpo = `
      <section class="ficha">
        ${encabezado(logo, historia_id)}
        ${linea('Nombres y Apellidos:', paciente.nombre_completo)}
        <div class="row">
          ${linea('DNI/CE:', `${paciente.tipo_documento}: ${paciente.numero_documento}`)}
          ${linea('Edad:', paciente.edad != null ? `${paciente.edad} años` : '')}
          ${linea('Sexo:', paciente.sexo)}
        </div>
        ${linea('Teléfono:', paciente.telefono)}
        <p class="aviso">Este paciente no tiene historial clínico registrado todavía.</p>
      </section>`;
  } else {
    // Una ficha oficial por atención (más reciente primero)
    cuerpo = atenciones
      .map((a) => fichaAtencion(paciente, antecedentes, a, logo, historia_id))
      .join('<div class="pagebreak"></div>');
  }

  const html = `<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><title>Historia clínica — ${esc(paciente.nombre_completo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; font-size: 12px; background: #f3f4f6; }
    .toolbar { position: sticky; top: 0; background: #fff; padding: 10px 24px; border-bottom: 1px solid #e5e7eb; }
    .toolbar button { background: #0059B3; color: #fff; border: 0; border-radius: 8px;
                      padding: 9px 16px; font-size: 13px; font-weight: bold; cursor: pointer; }
    .ficha { background: #fff; max-width: 820px; margin: 18px auto; padding: 32px 40px; }
    /* Encabezado oficial: logo (izq) + clínica y N.H.C (der), título centrado */
    .head { border-bottom: 2px solid #0059B3; padding-bottom: 10px; margin-bottom: 12px; }
    .head-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .head .logo { height: 84px; width: auto; object-fit: contain; }
    .head-right { text-align: center; }
    .clinic { color: #0059B3; font-size: 20px; font-weight: 800; letter-spacing: .5px; }
    .clinic-sub { color: #111827; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; }
    .nhc { display: flex; align-items: stretch; justify-content: center; }
    .nhc-lbl { font-size: 10px; font-weight: bold; color: #1f2937; background: #dbeafe;
               border: 1px solid #94a3b8; padding: 0 6px; display: flex; align-items: center; }
    .nhc-cell { width: 20px; height: 24px; border: 1px solid #94a3b8; border-left: 0;
                display: inline-flex; align-items: center; justify-content: center; font-size: 12px; background: #fff; }
    .title { text-align: center; color: #111827; font-size: 16px; font-weight: 800; margin: 12px 0 0; }
    .fechahora { text-align: right; font-size: 11px; margin-bottom: 10px; }
    h2 { color: #0059B3; font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; }
    h3 { font-size: 12px; margin: 10px 0 4px; color: #374151; }
    p.sub { font-size: 11px; font-weight: bold; color: #6b7280; margin: 6px 0 2px; }
    .fld { display: flex; gap: 6px; align-items: baseline; margin: 3px 0; }
    .fld .l { font-weight: bold; color: #374151; white-space: nowrap; }
    .fld .v { flex: 1; border-bottom: 1px solid #cbd5e1; min-height: 15px; white-space: pre-wrap; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    .row .fld { flex: 1; min-width: 140px; }
    .box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; min-height: 30px; white-space: pre-wrap; margin: 2px 0 4px; }
    .odo { max-width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; margin: 4px 0; }
    .firma { text-align: center; margin-top: 38px; }
    .firma-line { width: 240px; border-top: 1px solid #374151; margin: 0 auto 4px; }
    .firma > div:nth-child(2) { font-size: 11px; font-weight: bold; letter-spacing: 1px; }
    .firma-doc { font-size: 12px; margin-top: 2px; }
    .firma-cita { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .aviso { background: #eff6ff; border: 1px solid #bfdbfe; color: #0059B3; padding: 10px 12px; border-radius: 8px; margin-top: 12px; }
    .pagebreak { page-break-after: always; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .ficha { margin: 0 auto; max-width: none; padding: 0; }
      .ficha + .ficha, .ficha { page-break-inside: auto; }
    }
  </style></head>
  <body onload="setTimeout(function(){ window.focus(); window.print(); }, 500)">
    <div class="toolbar no-print">
      <button onclick="window.print()">Imprimir / Guardar como PDF</button>
      <span style="margin-left:12px;color:#6b7280;font-size:11px">Generado el ${esc(generado)}</span>
    </div>
    ${cuerpo}
  </body></html>`;

  // Blob URL: se renderiza de forma fiable en navegadores normales y embebidos.
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {                          // bloqueado por el navegador (popup)
    URL.revokeObjectURL(url);
    return false;
  }
  win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
};

export { fmtFecha, fmtFechaHora };
