// ─────────────────────────────────────────────────────────────────
// Utilidades de exportación para el Dashboard Financiero (INT-HU023).
//   • exportarPDF — PDF formal con logo, filtros, KPIs, tabla de pagos
//                   y resumen de pérdidas proyectadas.
//   • exportarExcel — Archivo .xlsx con 3 hojas: Resumen, Pagos, Pérdidas.
// Ambas funciones reciben los mismos datos que el dashboard tiene en pantalla.
// ─────────────────────────────────────────────────────────────────

import { jsPDF }   from 'jspdf';
import autoTable   from 'jspdf-autotable';
import * as XLSX   from 'xlsx';
import dayjs       from 'dayjs';
import logo        from '../../../assets/images/Logo-Consultorio-Padre-Pio.png';

const PEN = new Intl.NumberFormat('es-PE', {
  style: 'currency', currency: 'PEN', minimumFractionDigits: 2,
});

const fmtFecha     = (d) => (d ? dayjs(d).format('DD/MM/YYYY')         : '');
const fmtFechaHora = (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm')   : '');

// Carga el logo como dataURL una sola vez para inyectarlo en el PDF.
async function getLogoDataUrl() {
  const res  = await fetch(logo);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────
// PDF formal
// ─────────────────────────────────────────────────────────────────
export async function exportarPDF({ filtros, kpis, pagos, perdidas, pacientes = [] }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ANCHO   = doc.internal.pageSize.getWidth();
  let   y       = 40;

  // Encabezado con logo + título
  try {
    const logoData = await getLogoDataUrl();
    doc.addImage(logoData, 'PNG', 40, y - 5, 40, 40);
  } catch { /* si falla el logo, seguimos sin él */ }

  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text('Consultorio Padre Pío — Dashboard Financiero', 90, y + 10);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100);
  doc.text(`Emitido: ${fmtFechaHora(new Date())}`, 90, y + 26);
  y += 55;

  // Filtros aplicados
  doc.setDrawColor(220).setFillColor(245, 247, 250);
  doc.roundedRect(40, y, ANCHO - 80, 32, 4, 4, 'F');
  doc.setTextColor(60).setFont('helvetica', 'bold').setFontSize(10);
  doc.text('Filtros aplicados', 50, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Rango: ${fmtFecha(filtros.fecha_inicio)}  —  ${fmtFecha(filtros.fecha_fin)}`,
    50, y + 27,
  );
  y += 50;

  // Tarjetas de KPIs
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0);
  doc.text('Indicadores principales', 40, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    theme:  'grid',
    head:   [['Indicador', 'Valor']],
    body: [
      ['Ingresos brutos',        PEN.format(kpis.total_ingresos_brutos)],
      ['Citas atendidas',        String(kpis.citas_atendidas)],
      ['Citas no concretadas',   `${perdidas.length} (no asistidas o canceladas)`],
      ['Tasa de retorno',        `${kpis.tasa_retorno.porcentaje}%`
                                 + (kpis.tasa_retorno.alerta
                                    ? `  (alerta: bajo ${kpis.tasa_retorno.umbral}%)`
                                    : '')],
    ],
    headStyles: { fillColor: [0, 89, 179], textColor: 255 },
    styles:     { fontSize: 9, cellPadding: 5 },
    margin:     { left: 40, right: 40 },
  });
  y = doc.lastAutoTable.finalY + 20;

  // Tabla detallada de pacientes registrados en el periodo
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(`Pacientes registrados (${pacientes.length})`, 40, y);
  y += 8;

  if (pacientes.length === 0) {
    doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(100);
    doc.text('Sin pacientes registrados en el periodo.', 40, y + 14);
    y += 30;
  } else {
    autoTable(doc, {
      startY: y,
      theme:  'striped',
      head:   [['Fecha', 'Paciente', 'Documento', 'Teléfono', 'Sexo', 'Cuenta']],
      body:   pacientes.map((p) => [
        fmtFecha(p.fecha_registro),
        p.paciente,
        `${p.tipo_documento} ${p.numero_documento}`,
        p.telefono,
        p.sexo,
        p.estado_cuenta,
      ]),
      headStyles: { fillColor: [0, 89, 179], textColor: 255 },
      styles:     { fontSize: 8, cellPadding: 4 },
      margin:     { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // Tabla detallada de pagos
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(`Pagos del periodo (${pagos.length})`, 40, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme:  'striped',
    head:   [['Fecha', 'Paciente', 'Servicio', 'Monto', 'Método']],
    body:   pagos.map((p) => [
      fmtFecha(p.fecha_pago),
      p.paciente,
      p.servicio,
      PEN.format(Number(p.monto_total)),
      p.metodo_pago,
    ]),
    headStyles: { fillColor: [0, 89, 179], textColor: 255 },
    styles:     { fontSize: 8, cellPadding: 4 },
    margin:     { left: 40, right: 40 },
  });
  y = doc.lastAutoTable.finalY + 20;

  // Citas no concretadas (no asistidas o canceladas)
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(`Citas no concretadas (${perdidas.length})`, 40, y);
  y += 8;

  if (perdidas.length === 0) {
    doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(100);
    doc.text('Sin citas no concretadas en el periodo.', 40, y + 14);
  } else {
    autoTable(doc, {
      startY: y,
      theme:  'striped',
      head:   [['Fecha', 'Paciente', 'Servicio', 'Doctor', 'Precio del servicio', 'Motivo']],
      body:   perdidas.map((p) => [
        fmtFecha(p.fecha),
        p.paciente,
        p.servicio,
        p.doctor,
        PEN.format(Number(p.monto)),
        p.motivo,
      ]),
      headStyles: { fillColor: [200, 70, 70], textColor: 255 },
      styles:     { fontSize: 8, cellPadding: 4 },
      margin:     { left: 40, right: 40 },
    });
  }

  // Pie con número de páginas
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(140);
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      ANCHO - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  const nombre = `reporte_financiero_${filtros.fecha_inicio}_${filtros.fecha_fin}.pdf`;
  doc.save(nombre);
}

// ─────────────────────────────────────────────────────────────────
// Excel — 3 hojas: Resumen, Pagos, Pérdidas
// ─────────────────────────────────────────────────────────────────
export function exportarExcel({ filtros, kpis, pagos, perdidas, pacientes = [] }) {
  const wb = XLSX.utils.book_new();

  // Hoja Resumen
  const resumenRows = [
    ['Consultorio Padre Pío — Dashboard Financiero'],
    [`Emitido: ${fmtFechaHora(new Date())}`],
    [`Rango: ${fmtFecha(filtros.fecha_inicio)} — ${fmtFecha(filtros.fecha_fin)}`],
    [],
    ['Indicador', 'Valor'],
    ['Ingresos brutos',       Number(kpis.total_ingresos_brutos)],
    ['Citas atendidas',       Number(kpis.citas_atendidas)],
    ['Citas no concretadas',  perdidas.length],
    ['Tasa de retorno (%)',   Number(kpis.tasa_retorno.porcentaje)],
    ['Pacientes atendidos',  Number(kpis.tasa_retorno.pacientes_atendidos)],
    ['Pacientes recurrentes', Number(kpis.tasa_retorno.pacientes_recurrentes)],
    [
      'Alerta de fidelización',
      kpis.tasa_retorno.alerta
        ? `Sí (bajo ${kpis.tasa_retorno.umbral}%)`
        : 'No',
    ],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja Pacientes
  const pacientesRows = pacientes.map((p) => ({
    Fecha:    fmtFecha(p.fecha_registro),
    Paciente: p.paciente,
    Tipo:     p.tipo_documento,
    Documento: p.numero_documento,
    Teléfono: p.telefono,
    Sexo:     p.sexo,
    Cuenta:   p.estado_cuenta,
  }));
  const wsPacientes = XLSX.utils.json_to_sheet(
    pacientesRows.length
      ? pacientesRows
      : [{ Fecha: '', Paciente: '', Tipo: '', Documento: '', Teléfono: '', Sexo: '', Cuenta: '' }],
  );
  wsPacientes['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 6 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPacientes, 'Pacientes');

  // Hoja Pagos
  const pagosRows = pagos.map((p) => ({
    Fecha:    fmtFecha(p.fecha_pago),
    Paciente: p.paciente,
    Servicio: p.servicio,
    Monto:    Number(p.monto_total),
    Método:   p.metodo_pago,
  }));
  const wsPagos = XLSX.utils.json_to_sheet(
    pagosRows.length ? pagosRows : [{ Fecha: '', Paciente: '', Servicio: '', Monto: '', Método: '' }],
  );
  wsPagos['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 26 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos');

  // Hoja Citas no concretadas
  const perdidasRows = perdidas.map((p) => ({
    Fecha:                fmtFecha(p.fecha),
    Paciente:             p.paciente,
    Servicio:             p.servicio,
    Doctor:               p.doctor,
    'Precio del servicio': Number(p.monto),
    Motivo:               p.motivo,
  }));
  const wsPerdidas = XLSX.utils.json_to_sheet(
    perdidasRows.length
      ? perdidasRows
      : [{ Fecha: '', Paciente: '', Servicio: '', Doctor: '', 'Precio del servicio': '', Motivo: '' }],
  );
  wsPerdidas['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 26 }, { wch: 30 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsPerdidas, 'No concretadas');

  const nombre = `reporte_financiero_${filtros.fecha_inicio}_${filtros.fecha_fin}.xlsx`;
  XLSX.writeFile(wb, nombre);
}
