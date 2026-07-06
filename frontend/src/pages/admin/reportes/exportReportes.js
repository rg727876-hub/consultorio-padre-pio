// ─────────────────────────────────────────────────────────────────
// Utilidades de exportación para el Dashboard Financiero (INT-HU023).
//   • exportarPDF — PDF formal con logo, filtros, KPIs, tabla de pagos
//                   y resumen de pérdidas proyectadas.
//   • exportarExcel — Archivo .xlsx con 3 hojas: Resumen, Pagos, Pérdidas.
// Ambas funciones reciben los mismos datos que el dashboard tiene en pantalla.
// ─────────────────────────────────────────────────────────────────

import { jsPDF }   from 'jspdf';
import autoTable   from 'jspdf-autotable';
import ExcelJS     from 'exceljs';
import dayjs       from 'dayjs';
import logo        from '../../../assets/images/Logo-Consultorio-Padre-Pio.png';

// Paleta consistente con el dashboard
const XLS_BLUE     = 'FF0059B3';
const XLS_BLUE_LT  = 'FFE0EBF7';
const XLS_GRAY_HD  = 'FF334155';
const XLS_GRAY_LT  = 'FFF1F5F9';
const XLS_GRAY_ROW = 'FFF8FAFC';
const XLS_RED      = 'FFDC2626';
const XLS_RED_LT   = 'FFFEE2E2';
const XLS_GREEN    = 'FF16A34A';
const XLS_AMBER    = 'FFD97706';
const XLS_WHITE    = 'FFFFFFFF';

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
// Excel — 5 hojas con estilos, colores y bordes
//   • Resumen — KPIs, métodos de pago, rankings
//   • Pacientes — registrados en el periodo
//   • Pagos — detalle con total
//   • No concretadas — detalle con total
//   • Rankings — top servicios, doctores y pacientes
// ─────────────────────────────────────────────────────────────────

// Helpers de estilo compartidos
const thinBorder = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

function estilarCabeceraTabla(row, fill = XLS_BLUE) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: XLS_WHITE }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = allBorders;
  });
  row.height = 22;
}

function estilarBloqueTitulo(ws, celda, texto, fill = XLS_BLUE) {
  const c = ws.getCell(celda);
  c.value = texto;
  c.font = { bold: true, size: 16, color: { argb: XLS_WHITE } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  c.alignment = { vertical: 'middle', horizontal: 'center' };
}

function seccionTitulo(ws, rowNum, texto, mergeRange, fill = XLS_GRAY_HD) {
  ws.mergeCells(mergeRange);
  const c = ws.getCell(`A${rowNum}`);
  c.value = texto;
  c.font = { bold: true, size: 10, color: { argb: XLS_WHITE } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(rowNum).height = 18;
}

function pintarFilas(ws, startRow, endRow, ncols) {
  for (let r = startRow; r <= endRow; r++) {
    const par = (r - startRow) % 2 === 1;
    for (let col = 1; col <= ncols; col++) {
      const cell = ws.getCell(r, col);
      if (par) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_GRAY_ROW } };
      }
      cell.border = allBorders;
    }
  }
}

function filaTotal(ws, rowNum, ncols, monto) {
  const row = ws.getRow(rowNum);
  for (let col = 1; col <= ncols; col++) {
    const c = ws.getCell(rowNum, col);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_GRAY_LT } };
    c.font = { bold: true };
    c.border = allBorders;
  }
  ws.getCell(rowNum, 1).value = 'TOTAL';
  ws.getCell(rowNum, ncols).value = monto;
  ws.getCell(rowNum, ncols).numFmt = '"S/ "#,##0.00';
  ws.getCell(rowNum, ncols).alignment = { horizontal: 'right' };
  row.height = 22;
}

export async function exportarExcel({
  filtros, kpis, pagos, perdidas, pacientes = [],
  topDoctores = [], topPacientes = [], metodosDistribucion = [],
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Consultorio Padre Pío';
  wb.created = new Date();

  const totalIngresos = Number(kpis.total_ingresos_brutos);
  const totalPerdidas = perdidas.reduce((a, p) => a + Number(p.monto || 0), 0);
  const totalMetodos  = metodosDistribucion.reduce((a, m) => a + m.total, 0);

  // ══════════════════════════════════════════════════════════════
  // HOJA 1 — RESUMEN
  // ══════════════════════════════════════════════════════════════
  const wsR = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: XLS_BLUE } } });
  wsR.columns = [
    { width: 4 }, { width: 34 }, { width: 22 }, { width: 20 },
  ];

  // Título
  wsR.mergeCells('A1:D2');
  estilarBloqueTitulo(wsR, 'A1', 'CONSULTORIO PADRE PÍO — DASHBOARD FINANCIERO');
  wsR.getRow(1).height = 26;
  wsR.getRow(2).height = 8;

  // Sub info: emisión + rango
  wsR.mergeCells('A3:D3');
  const sub = wsR.getCell('A3');
  sub.value = `Emitido el ${fmtFechaHora(new Date())} · Periodo: ${fmtFecha(filtros.fecha_inicio)} — ${fmtFecha(filtros.fecha_fin)}`;
  sub.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  sub.alignment = { horizontal: 'center' };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_GRAY_LT } };
  wsR.getRow(3).height = 20;

  wsR.getRow(4).height = 8; // spacer

  // ── Sección: KPIs principales ──
  seccionTitulo(wsR, 5, 'INDICADORES PRINCIPALES', 'A5:D5');

  const kpisList = [
    ['Ingresos brutos',        totalIngresos,                                     '"S/ "#,##0.00', XLS_GREEN],
    ['Citas atendidas',        Number(kpis.citas_atendidas),                     '0',              XLS_BLUE],
    ['Citas no concretadas',   perdidas.length,                                   '0',              XLS_RED],
    ['Tasa de retorno',        Number(kpis.tasa_retorno.porcentaje) / 100,        '0.00%',          XLS_BLUE],
    ['Pacientes atendidos',    Number(kpis.tasa_retorno.pacientes_atendidos),     '0',              XLS_GRAY_HD],
    ['Pacientes recurrentes',  Number(kpis.tasa_retorno.pacientes_recurrentes),   '0',              XLS_GRAY_HD],
  ];

  let r = 6;
  kpisList.forEach(([label, val, fmt, colorAccento]) => {
    const cellL = wsR.getCell(`B${r}`);
    const cellV = wsR.getCell(`C${r}`);
    cellL.value = label;
    cellL.font = { size: 10, color: { argb: 'FF334155' } };
    cellL.border = { bottom: thinBorder };
    cellV.value = val;
    cellV.numFmt = fmt;
    cellV.font = { bold: true, size: 12, color: { argb: colorAccento } };
    cellV.alignment = { horizontal: 'right' };
    cellV.border = { bottom: thinBorder };
    wsR.getRow(r).height = 20;
    r++;
  });

  const alertaLabel = wsR.getCell(`B${r}`);
  const alertaVal   = wsR.getCell(`C${r}`);
  alertaLabel.value = 'Alerta de fidelización';
  alertaLabel.font = { size: 10, color: { argb: 'FF334155' } };
  const enAlerta = !!kpis.tasa_retorno.alerta;
  alertaVal.value = enAlerta ? `Sí — bajo el ${kpis.tasa_retorno.umbral}%` : 'No';
  alertaVal.font = { bold: true, color: { argb: enAlerta ? XLS_RED : XLS_GREEN } };
  alertaVal.alignment = { horizontal: 'right' };
  wsR.getRow(r).height = 20;
  r += 2;

  // ── Sección: Métodos de pago ──
  seccionTitulo(wsR, r, 'DISTRIBUCIÓN DE MÉTODOS DE PAGO', `A${r}:D${r}`);
  r++;

  const metodosHeader = wsR.getRow(r);
  metodosHeader.getCell(2).value = 'Método';
  metodosHeader.getCell(3).value = 'Cantidad';
  metodosHeader.getCell(4).value = 'Porcentaje';
  [2, 3, 4].forEach((col) => {
    const c = metodosHeader.getCell(col);
    c.font = { bold: true, color: { argb: XLS_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_BLUE } };
    c.alignment = { vertical: 'middle', horizontal: 'left' };
    c.border = allBorders;
  });
  metodosHeader.height = 20;
  r++;

  const metodosStart = r;
  metodosDistribucion.forEach((m) => {
    wsR.getCell(`B${r}`).value = m.metodo;
    wsR.getCell(`C${r}`).value = m.total;
    wsR.getCell(`C${r}`).numFmt = '0';
    wsR.getCell(`C${r}`).alignment = { horizontal: 'right' };
    wsR.getCell(`D${r}`).value = totalMetodos ? m.total / totalMetodos : 0;
    wsR.getCell(`D${r}`).numFmt = '0.00%';
    wsR.getCell(`D${r}`).alignment = { horizontal: 'right' };
    r++;
  });
  if (metodosDistribucion.length > 0) {
    pintarFilas(wsR, metodosStart, r - 1, 4);
    // borrar el borde de la columna A vacía
    for (let rr = metodosStart; rr < r; rr++) {
      wsR.getCell(`A${rr}`).fill = { type: 'pattern', pattern: 'none' };
      wsR.getCell(`A${rr}`).border = {};
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HOJA 2 — PACIENTES
  // ══════════════════════════════════════════════════════════════
  const wsP = wb.addWorksheet('Pacientes', { properties: { tabColor: { argb: XLS_BLUE } } });
  wsP.mergeCells('A1:G1');
  estilarBloqueTitulo(wsP, 'A1', `PACIENTES REGISTRADOS · ${fmtFecha(filtros.fecha_inicio)} — ${fmtFecha(filtros.fecha_fin)}`);
  wsP.getRow(1).height = 28;

  wsP.getRow(2).values = ['Fecha', 'Paciente', 'Tipo', 'Documento', 'Teléfono', 'Sexo', 'Cuenta'];
  estilarCabeceraTabla(wsP.getRow(2));
  wsP.columns = [
    { width: 12 }, { width: 34 }, { width: 8 }, { width: 16 },
    { width: 14 }, { width: 12 }, { width: 14 },
  ];

  pacientes.forEach((p, i) => {
    const row = wsP.getRow(3 + i);
    row.values = [
      fmtFecha(p.fecha_registro), p.paciente, p.tipo_documento,
      p.numero_documento, p.telefono, p.sexo, p.estado_cuenta,
    ];
  });
  if (pacientes.length > 0) pintarFilas(wsP, 3, 2 + pacientes.length, 7);
  wsP.views = [{ state: 'frozen', ySplit: 2 }];

  // ══════════════════════════════════════════════════════════════
  // HOJA 3 — PAGOS
  // ══════════════════════════════════════════════════════════════
  const wsPg = wb.addWorksheet('Pagos', { properties: { tabColor: { argb: XLS_GREEN } } });
  wsPg.mergeCells('A1:E1');
  estilarBloqueTitulo(wsPg, 'A1', `DETALLE DE PAGOS · ${fmtFecha(filtros.fecha_inicio)} — ${fmtFecha(filtros.fecha_fin)}`, XLS_GREEN);
  wsPg.getRow(1).height = 28;

  wsPg.getRow(2).values = ['Fecha', 'Paciente', 'Servicio', 'Monto', 'Método'];
  estilarCabeceraTabla(wsPg.getRow(2), XLS_GREEN);
  wsPg.columns = [
    { width: 12 }, { width: 34 }, { width: 26 }, { width: 14 }, { width: 20 },
  ];

  pagos.forEach((p, i) => {
    const row = wsPg.getRow(3 + i);
    row.values = [
      fmtFecha(p.fecha_pago), p.paciente, p.servicio,
      Number(p.monto_total), p.metodo_pago,
    ];
    row.getCell(4).numFmt = '"S/ "#,##0.00';
    row.getCell(4).alignment = { horizontal: 'right' };
  });
  if (pagos.length > 0) {
    pintarFilas(wsPg, 3, 2 + pagos.length, 5);
    filaTotal(wsPg, 3 + pagos.length, 5, totalIngresos);
  }
  wsPg.views = [{ state: 'frozen', ySplit: 2 }];

  // ══════════════════════════════════════════════════════════════
  // HOJA 4 — NO CONCRETADAS
  // ══════════════════════════════════════════════════════════════
  const wsNc = wb.addWorksheet('No concretadas', { properties: { tabColor: { argb: XLS_RED } } });
  wsNc.mergeCells('A1:F1');
  estilarBloqueTitulo(wsNc, 'A1', `CITAS NO CONCRETADAS · ${fmtFecha(filtros.fecha_inicio)} — ${fmtFecha(filtros.fecha_fin)}`, XLS_RED);
  wsNc.getRow(1).height = 28;

  wsNc.getRow(2).values = ['Fecha', 'Paciente', 'Servicio', 'Doctor', 'Precio del servicio', 'Motivo'];
  estilarCabeceraTabla(wsNc.getRow(2), XLS_RED);
  wsNc.columns = [
    { width: 12 }, { width: 30 }, { width: 26 }, { width: 30 }, { width: 20 }, { width: 14 },
  ];

  perdidas.forEach((p, i) => {
    const row = wsNc.getRow(3 + i);
    row.values = [
      fmtFecha(p.fecha), p.paciente, p.servicio, p.doctor,
      Number(p.monto), p.motivo,
    ];
    row.getCell(5).numFmt = '"S/ "#,##0.00';
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).font = {
      color: { argb: p.motivo === 'CANCELADA' ? XLS_RED : XLS_AMBER },
      bold: true,
    };
  });
  if (perdidas.length > 0) {
    pintarFilas(wsNc, 3, 2 + perdidas.length, 6);
    filaTotal(wsNc, 3 + perdidas.length, 6, totalPerdidas);
  }
  wsNc.views = [{ state: 'frozen', ySplit: 2 }];

  // ══════════════════════════════════════════════════════════════
  // HOJA 5 — RANKINGS (Top servicios / doctores / pacientes)
  // ══════════════════════════════════════════════════════════════
  const wsRk = wb.addWorksheet('Rankings', { properties: { tabColor: { argb: XLS_GRAY_HD } } });
  wsRk.columns = [
    { width: 6 }, { width: 34 }, { width: 16 },
  ];

  const topServicios = [...(pagos.length ? [] : [])]; // solo estructura, se calcula abajo
  const serviciosMap = {};
  pagos.forEach((p) => { serviciosMap[p.servicio] = (serviciosMap[p.servicio] || 0) + 1; });
  perdidas.forEach((p) => { serviciosMap[p.servicio] = (serviciosMap[p.servicio] || 0) + 1; });
  const rankingServ = Object.entries(serviciosMap)
    .map(([servicio, total]) => ({ servicio, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const bloques = [
    { titulo: 'TOP SERVICIOS MÁS SOLICITADOS',   items: rankingServ,  cols: ['Servicio', 'Citas'],       key: 'servicio', total: 'total', color: XLS_BLUE },
    { titulo: 'TOP DOCTORES POR ATENCIONES',     items: topDoctores,  cols: ['Doctor', 'Atenciones'],    key: 'doctor',   total: 'total', color: XLS_GREEN },
    { titulo: 'TOP PACIENTES RECURRENTES',       items: topPacientes, cols: ['Paciente', 'Atenciones'], key: 'paciente', total: 'total', color: XLS_GRAY_HD },
  ];

  let rr = 1;
  bloques.forEach((b) => {
    wsRk.mergeCells(`A${rr}:C${rr}`);
    estilarBloqueTitulo(wsRk, `A${rr}`, b.titulo, b.color);
    wsRk.getRow(rr).height = 24;
    rr++;

    const header = wsRk.getRow(rr);
    header.getCell(1).value = '#';
    header.getCell(2).value = b.cols[0];
    header.getCell(3).value = b.cols[1];
    [1, 2, 3].forEach((col) => {
      const c = header.getCell(col);
      c.font = { bold: true, color: { argb: XLS_WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: b.color } };
      c.border = allBorders;
      c.alignment = { horizontal: col === 3 ? 'right' : 'left' };
    });
    header.height = 20;
    rr++;

    const startRow = rr;
    if (b.items.length === 0) {
      wsRk.mergeCells(`A${rr}:C${rr}`);
      const c = wsRk.getCell(`A${rr}`);
      c.value = 'Sin datos para el periodo seleccionado';
      c.font = { italic: true, color: { argb: 'FF94A3B8' } };
      c.alignment = { horizontal: 'center' };
      c.border = allBorders;
      rr++;
    } else {
      b.items.slice(0, 5).forEach((item, i) => {
        const row = wsRk.getRow(rr);
        row.getCell(1).value = i + 1;
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(1).font = { bold: true, color: { argb: '#94A3B8' } };
        row.getCell(2).value = item[b.key];
        row.getCell(3).value = item[b.total];
        row.getCell(3).alignment = { horizontal: 'right' };
        row.getCell(3).font = { bold: true };
        rr++;
      });
      pintarFilas(wsRk, startRow, rr - 1, 3);
    }
    rr += 1; // espacio entre bloques
  });

  // ══════════════════════════════════════════════════════════════
  // Descarga
  // ══════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_financiero_${filtros.fecha_inicio}_${filtros.fecha_fin}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
