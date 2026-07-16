import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, ChevronRight, X, Download, Stethoscope,
} from 'lucide-react';
import { getHistorial, registrarDescargaPDF } from '../services/patientHistorial.service';
import { generarFichaAtencionPDF, fmtFecha, fmtFechaHora } from './historialClinico.pdf';
import logoUrl from '../assets/images/Logo-Consultorio-Padre-Pio.png';

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

// ── Ventana flotante: detalle de una atención ────────────────────────────────
function AtencionDetalle({ paciente, antecedentes, atencion, pacienteId, historiaId, logoB64, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const disponibles = CAMPOS_DETALLE.filter((c) => tieneContenido(atencion[c.key]));
  const vitalesDisponibles = CAMPOS_VITALES.filter((c) => tieneContenido(atencion[c.key]));

  const handleDescargar = () => {
    setDescargando(true);
    try {
      // Debe llamarse de forma síncrona (sin await antes) para que el navegador
      // lo reconozca como respuesta directa al clic y no bloquee el pop-up.
      const ok = generarFichaAtencionPDF({ paciente, antecedentes, atencion, historiaId }, logoB64);
      if (!ok) alert('Permite las ventanas emergentes para descargar el PDF.');
      registrarDescargaPDF(pacienteId).catch(() => {}); // auditoría, no bloquea la descarga
    } finally {
      setDescargando(false);
    }
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
  const [logoB64, setLogoB64] = useState(''); // logo embebido para el PDF

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

  // Precarga el logo como data URI para incrustarlo en la ventana del PDF.
  useEffect(() => {
    let activo = true;
    fetch(logoUrl)
      .then((r) => r.blob())
      .then((b) => new Promise((res) => {
        const fr = new FileReader();
        fr.onloadend = () => res(fr.result);
        fr.readAsDataURL(b);
      }))
      .then((dataUri) => { if (activo) setLogoB64(dataUri); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

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
          antecedentes={data.antecedentes}
          atencion={seleccionada}
          pacienteId={pacienteId}
          historiaId={data.historia_id}
          logoB64={logoB64}
          onClose={() => setSeleccionada(null)}
        />
      )}
    </>
  );
}
