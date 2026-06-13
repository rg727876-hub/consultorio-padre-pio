import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileClock, Download, Lock, ChevronDown, Stethoscope,
  CalendarX2, ClipboardList, UserRound, Loader2, AlertTriangle,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';
import logoUrl from '../../assets/images/Logo-Consultorio-Padre-Pio.png';
import {
  ANTECEDENTES_FIELDS, SIN_INFO, valorODefecto, resumenAtencion, filasAtencion,
  generarHistorialPDF, fmtFechaHora,
} from './historialClinico.utils';

export default function HistorialPaciente() {
  const { pacienteId } = useParams();
  const navigate       = useNavigate();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [abierta,     setAbierta]     = useState(null);   // consulta_id expandido
  const [descargando, setDescargando] = useState(false);
  const [logoB64,     setLogoB64]     = useState('');     // logo embebido para el PDF

  // Precarga el logo como data URI para incrustarlo en la ventana del PDF
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

  const cargar = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await api.get(`/historial/paciente/${pacienteId}`);
      setData(data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        toast.error(err.response?.data?.error || 'No se pudo abrir el historial');
        navigate('/doctor/historial');
        return;
      }
      setError(true);   // PageLoader mostrará "Error de conexión. Intente más tarde."
    } finally {
      setLoading(false);
    }
  }, [pacienteId, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  const descargarPDF = async () => {
    if (!data) return;
    setDescargando(true);
    try {
      const ok = generarHistorialPDF(data, logoB64);
      if (!ok) {
        toast.error('Permite las ventanas emergentes para descargar el PDF.');
        return;
      }
      // Auditoría de la descarga (no bloquea la generación del PDF)
      api.post(`/historial/paciente/${pacienteId}/descarga`).catch(() => {});
    } finally {
      setDescargando(false);
    }
  };

  const paciente = data?.paciente;

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#0059B3] flex items-center gap-2">
                  <FileClock size={20} /> Historial clínico
                </h1>
                <p className="text-sm text-slate-500">Consulta de solo lectura</p>
              </div>
            </div>
            {data && (
              <button onClick={descargarPDF} disabled={descargando}
                className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99] disabled:opacity-60
                           text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
                <Download size={16} /> Descargar PDF
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 size={32} className="animate-spin text-[#0059B3] mb-3" />
              <p className="text-sm">Cargando…</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl shadow-sm text-center py-16 px-4">
              <AlertTriangle size={36} className="mx-auto mb-2 text-amber-400" />
              <p className="text-sm text-slate-600">Error de conexión. Intente más tarde.</p>
              <button onClick={cargar}
                className="mt-3 text-[#0059B3] text-sm font-medium hover:underline">Reintentar</button>
            </div>
          ) : data ? (
              <>
                {/* Aviso de solo lectura (inmutabilidad médico-legal) */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200
                                text-[#0059B3] text-sm rounded-xl px-4 py-3">
                  <Lock size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Vista de <b>solo lectura</b>. La información de atenciones pasadas no puede editarse
                    (inmutabilidad médico-legal).
                  </span>
                </div>

                {/* Datos del paciente */}
                <Card titulo="Datos del paciente" icon={UserRound}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <Dato label="Nombre completo" valor={paciente.nombre_completo} />
                    <Dato label="Edad" valor={paciente.edad != null ? `${paciente.edad} años` : '—'} />
                    <Dato label="Documento" valor={`${paciente.tipo_documento}: ${paciente.numero_documento}`} />
                    <Dato label="Teléfono" valor={paciente.telefono} />
                    <Dato label="Sexo" valor={paciente.sexo} />
                  </div>
                </Card>

                {/* Sin historia clínica creada */}
                {!data.tiene_historia ? (
                  <div className="bg-white rounded-2xl shadow-sm text-center py-14 px-4">
                    <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-600 font-medium">
                      Este paciente no tiene historial clínico registrado todavía.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Antecedentes médicos generales */}
                    <Card titulo="Antecedentes médicos generales" icon={ClipboardList}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ANTECEDENTES_FIELDS.map(([k, label]) => (
                          <Campo key={k} label={label} valor={valorODefecto(data.antecedentes?.[k])} />
                        ))}
                      </div>
                    </Card>

                    {/* Atenciones previas */}
                    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                      <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider
                                    border-b border-slate-100 pb-1 flex items-center gap-2">
                        <Stethoscope size={14} /> Atenciones previas ({data.atenciones.length})
                      </p>

                      {data.atenciones.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <CalendarX2 size={34} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No hay atenciones registradas.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {data.atenciones.map((a) => (
                            <AtencionItem key={a.consulta_id}
                              atencion={a}
                              abierta={abierta === a.consulta_id}
                              onToggle={() => setAbierta(abierta === a.consulta_id ? null : a.consulta_id)} />
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Item de atención (resumen colapsable + detalle completo) ──────────
function AtencionItem({ atencion, abierta, onToggle }) {
  const r = resumenAtencion(atencion);
  return (
    <div className="py-1">
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-lg px-2 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{r.fecha}</p>
          <p className="text-xs text-slate-500 truncate">
            {r.servicio} · {r.doctor}
            {r.diagnostico && <> · <span className="text-slate-600">Dx: {r.diagnostico}</span></>}
          </p>
        </div>
        <ChevronDown size={18}
          className={`text-slate-400 flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>

      {abierta && (
        <div className="pb-4 px-2 space-y-3 animate-fade-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 text-sm">
            <Dato label="Fecha y hora" valor={fmtFechaHora(atencion.fecha_atencion)} />
            <Dato label="Servicio" valor={atencion.servicio_nombre} />
            <Dato label="Doctor que firmó" valor={atencion.firmado_por} />
            <Dato label="N° de cita" valor={atencion.codigo_cita} mono />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filasAtencion(atencion).map((f) => (
              <Campo key={f.label} label={f.label} valor={f.value ?? SIN_INFO} />
            ))}
          </div>

          {/* Odontograma (imagen si existe) */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Odontograma</p>
            {atencion.odontograma_url ? (
              <img src={atencion.odontograma_url} alt="Odontograma"
                className="max-w-full rounded-lg border border-slate-200" />
            ) : (
              <p className="text-sm text-slate-400 italic bg-slate-50 rounded-lg px-3 py-2">{SIN_INFO}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────
function Card({ titulo, icon: Icon, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider
                    border-b border-slate-100 pb-1 flex items-center gap-2">
        {Icon && <Icon size={14} />} {titulo}
      </p>
      {children}
    </section>
  );
}

function Dato({ label, valor, mono }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-slate-800 font-medium ${mono ? 'font-mono text-xs' : ''}`}>{valor || '—'}</p>
    </div>
  );
}

function Campo({ label, valor }) {
  const vacio = valor === SIN_INFO;
  return (
    <div>
      <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
      <p className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 min-h-[2.5rem]
                     ${vacio ? 'text-slate-400 italic bg-slate-50' : 'text-slate-800 bg-slate-50'}`}>
        {valor}
      </p>
    </div>
  );
}
