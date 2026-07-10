import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, ChevronRight, X, Download, Stethoscope,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { getHistorial, registrarDescargaPDF } from '../services/patientHistorial.service';

// ── Constantes ────────────────────────────────────────────────────────────────
const CAMPOS_ANTECEDENTES = [
  { key: 'antecedentes_sistemicos',      label: 'Antecedentes sistémicos' },
  { key: 'antecedentes_estomatologicos', label: 'Antecedentes estomatológicos' },
  { key: 'antecedentes_farmacologicos',  label: 'Antecedentes farmacológicos' },
  { key: 'antecedentes_familiares',      label: 'Antecedentes familiares' },
  { key: 'antecedentes_otros',           label: 'Antecedentes otros' },
  { key: 'alergias',                     label: 'Alergias' },
];

const CAMPOS_VITALES = [
  { key: 'presion_arterial',        label: 'Presión arterial' },
  { key: 'pulso',                   label: 'Pulso' },
  { key: 'frecuencia_respiratoria', label: 'Frecuencia respiratoria' },
  { key: 'temperatura',             label: 'Temperatura' },
];

const CAMPOS_DETALLE = [
  { key: 'motivo_consulta',           label: 'Motivo de consulta' },
  { key: 'enfermedad_actual',         label: 'Enfermedad actual' },
  { key: 'enfermedad_inicio',         label: 'Inicio de la enfermedad' },
  { key: 'enfermedad_evolucion',      label: 'Evolución' },
  { key: 'enfermedad_estado_actual',  label: 'Estado actual' },
  { key: 'examen_extraoral',          label: 'Examen extraoral' },
  { key: 'examen_intraoral',          label: 'Examen intraoral' },
  { key: 'diagnostico_presuntivo',    label: 'Diagnóstico presuntivo' },
  { key: 'examenes_complementarios',  label: 'Exámenes complementarios solicitados' },
  { key: 'diagnostico_definitivo',    label: 'Diagnóstico definitivo' },
  { key: 'diagnostico_cie10',         label: 'Código CIE-10' },
  { key: 'plan_tratamiento',          label: 'Plan de tratamiento' },
  { key: 'prescripciones',            label: 'Prescripciones / Medicamentos indicados' },
  { key: 'tratamiento_aplicado',      label: 'Tratamiento aplicado en esta sesión' },
  { key: 'pronostico',                label: 'Pronóstico' },
  { key: 'control_evolucion',         label: 'Control y evolución' },
  { key: 'alta_paciente',             label: 'Alta del paciente' },
  { key: 'observaciones',             label: 'Observaciones del doctor' },
];

const tieneContenido = (v) => v !== null && v !== undefined && String(v).trim() !== '';

const fmtFecha = (f) => {
  if (!f) return null;
  return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
};
const fmtFechaHora = (f) => {
  if (!f) return null;
  return new Date(f).toLocaleString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Convierte la imagen del odontograma a data URL para poder incrustarla en el PDF.
// Si falla (CORS, red, etc.) se resuelve con null y el PDF se genera sin la imagen.
const odontogramaADataUrl = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

// Genera el PDF real del detalle de una atención (CA-14) y dispara la descarga.
const generarPdfAtencion = async (paciente, atencion) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 50;

  const salto = (alto = 14) => {
    if (y + alto > pageHeight - 40) { doc.addPage(); y = 50; }
  };

  const escribir = (texto, { size = 10, bold = false, color = '#1e293b', gapAfter = 12 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.splitTextToSize(String(texto), maxWidth).forEach((linea) => {
      salto(size * 1.3);
      doc.text(linea, marginX, y);
      y += size * 1.3;
    });
    y += gapAfter;
  };

  escribir('Consultorio Padre Pío — Historial Clínico', { size: 15, bold: true, gapAfter: 2 });
  escribir(paciente?.nombre_completo ?? 'Paciente', { size: 12, bold: true, gapAfter: paciente?.edad != null ? 0 : 10 });
  if (paciente?.edad != null) escribir(`${paciente.edad} años`, { size: 9, color: '#64748b', gapAfter: 10 });

  escribir('Detalle de la atención', { size: 12, bold: true, gapAfter: 6 });
  escribir(`Fecha: ${fmtFechaHora(atencion.fecha_atencion) ?? 'No registrada'}`, { gapAfter: 2 });
  escribir(`Doctor: ${atencion.doctor_nombre ?? 'No registrado'}`, { gapAfter: 2 });
  escribir(`Servicio: ${atencion.servicio_nombre ?? 'No registrado'}`, { gapAfter: 10 });

  const vitales = CAMPOS_VITALES.filter((c) => tieneContenido(atencion[c.key]));
  if (vitales.length) {
    escribir('Signos vitales', { size: 11, bold: true, gapAfter: 4 });
    vitales.forEach((c) => escribir(`${c.label}: ${atencion[c.key]}`, { size: 9.5, gapAfter: 2 }));
    y += 6;
  }

  CAMPOS_DETALLE.filter((c) => tieneContenido(atencion[c.key])).forEach((c) => {
    escribir(c.label, { size: 9.5, bold: true, gapAfter: 1 });
    escribir(atencion[c.key], { size: 9.5, color: '#334155', gapAfter: 8 });
  });

  if (atencion.odontograma_url) {
    const img = await odontogramaADataUrl(atencion.odontograma_url);
    escribir('Odontograma', { size: 11, bold: true, gapAfter: img ? 6 : 2 });
    if (img) {
      const anchoMax = maxWidth;
      const alto = Math.min(280, (img.height / img.width) * anchoMax);
      salto(alto + 10);
      doc.addImage(img.dataUrl, 'PNG', marginX, y, anchoMax, alto);
      y += alto + 10;
    } else {
      escribir('(La imagen no pudo incluirse en el PDF; disponible en el portal)', { size: 8.5, color: '#94a3b8', gapAfter: 6 });
    }
  }

  doc.setFontSize(8);
  doc.setTextColor('#94a3b8');
  doc.text(
    `Generado el ${new Date().toLocaleString('es-PE')} — Documento de referencia, no reemplaza indicación médica.`,
    marginX, pageHeight - 30
  );

  const nombreArchivo = `historial-${(paciente?.nombre_completo ?? 'paciente').trim().replace(/\s+/g, '_')}-${
    atencion.fecha_atencion ? String(atencion.fecha_atencion).slice(0, 10) : 'atencion'
  }.pdf`;
  doc.save(nombreArchivo);
};

// ── Ventana flotante: detalle de una atención ────────────────────────────────
function AtencionDetalle({ paciente, atencion, pacienteId, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const disponibles = CAMPOS_DETALLE.filter((c) => tieneContenido(atencion[c.key]));
  const vitalesDisponibles = CAMPOS_VITALES.filter((c) => tieneContenido(atencion[c.key]));

  const handleDescargar = async () => {
    setDescargando(true);
    try { await registrarDescargaPDF(pacienteId); } catch { /* no bloquear la descarga */ }
    try { await generarPdfAtencion(paciente, atencion); }
    finally { setDescargando(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/50 backdrop-blur-sm sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl
                      flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Detalle de la atención</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtFechaHora(atencion.fecha_atencion) ?? 'Fecha no registrada'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Doctor</p>
              <p className="text-sm text-slate-800 font-medium">{atencion.doctor_nombre ?? 'No registrado'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Servicio</p>
              <p className="text-sm text-slate-800 font-medium">{atencion.servicio_nombre ?? 'No registrado'}</p>
            </div>
          </div>

          {vitalesDisponibles.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Signos vitales
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {vitalesDisponibles.map((c) => (
                  <div key={c.key} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">{c.label}</p>
                    <p className="text-sm text-slate-800 font-medium">{atencion[c.key]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {disponibles.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">
              No hay información adicional registrada para esta atención.
            </p>
          ) : (
            disponibles.map((c) => (
              <div key={c.key}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{atencion[c.key]}</p>
              </div>
            ))
          )}

          {atencion.odontograma_url && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Odontograma</p>
              <img
                src={atencion.odontograma_url}
                alt="Odontograma"
                className="w-full rounded-xl border border-slate-200"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={handleDescargar}
            disabled={descargando}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white
                       font-bold text-sm py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Download size={15} /> {descargando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal: antecedentes + lista de atenciones ────────────────
export default function HistorialClinico({ pacienteId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getHistorial(pacienteId);
      setData(data);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'No se pudo cargar el historial clínico.');
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { fetchHistorial(); }, [fetchHistorial]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 size={20} className="animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <AlertCircle size={15} /> {error}
    </div>
  );

  const antecedentesDisponibles = data.antecedentes
    ? CAMPOS_ANTECEDENTES.filter((c) => tieneContenido(data.antecedentes[c.key]))
    : [];

  return (
    <>
      <div className="space-y-5 text-left">
        {/* Antecedentes médicos generales */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Antecedentes médicos generales
          </p>
          {antecedentesDisponibles.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              Aún no tienes antecedentes médicos registrados. Se irán agregando conforme tengas atenciones.
            </p>
          ) : (
            <div className="bg-white border border-slate-100 rounded-xl px-4 py-4">
              <div className="space-y-3">
                {antecedentesDisponibles.map((c) => (
                  <div key={c.key}>
                    <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-line">{data.antecedentes[c.key]}</p>
                  </div>
                ))}
              </div>
              {(data.antecedentes.actualizado_por_nombre || data.antecedentes.creado_por_nombre) && (
                <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
                  {data.antecedentes.fecha_actualizacion
                    ? `Última actualización: ${fmtFecha(data.antecedentes.fecha_actualizacion)}`
                    : `Registrado: ${fmtFecha(data.antecedentes.fecha_creacion)}`}
                  {' · Dr(a). '}
                  {data.antecedentes.actualizado_por_nombre ?? data.antecedentes.creado_por_nombre}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mis atenciones */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Mis atenciones
          </p>
          {data.atenciones.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No tienes atenciones registradas todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {data.atenciones.map((a) => (
                <button
                  key={a.consulta_id}
                  onClick={() => setSeleccionada(a)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200
                             hover:border-primary/30 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0
                                  group-hover:bg-primary/20 transition-colors">
                    <Stethoscope size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {a.servicio_nombre ?? 'Servicio no registrado'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtFecha(a.fecha_atencion) ?? 'Sin fecha'}
                      {a.doctor_nombre ? ` · Dr(a). ${a.doctor_nombre}` : ''}
                    </p>
                    {a.diagnostico_definitivo && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Dx: {a.diagnostico_definitivo}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {seleccionada && (
        <AtencionDetalle
          paciente={data.paciente}
          atencion={seleccionada}
          pacienteId={pacienteId}
          onClose={() => setSeleccionada(null)}
        />
      )}
    </>
  );
}
