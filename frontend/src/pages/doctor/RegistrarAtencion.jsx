import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, Stethoscope, ArrowLeft, Lock, AlertTriangle, Save, CheckCircle2, FileClock,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';
import PageLoader from '../../components/PageLoader';
import { fmtFecha } from '../recepcion/citaEstados';

const INITIAL = {
  // Anamnesis
  motivo_consulta: '',
  enfermedad_inicio: '', enfermedad_evolucion: '', enfermedad_estado_actual: '',
  // Antecedentes (HISTORIA_CLINICA)
  antecedentes_sistemicos: '', antecedentes_estomatologicos: '',
  antecedentes_farmacologicos: '', antecedentes_otros: '', antecedentes_familiares: '',
  // Examen clínico
  presion_arterial: '', pulso: '', frecuencia_respiratoria: '', temperatura: '',
  examen_extraoral: '', examen_intraoral: '',
  // Diagnóstico y plan
  diagnostico_presuntivo: '', examenes_complementarios: '',
  diagnostico_definitivo: '', diagnostico_cie10: '',
  plan_tratamiento: '', tratamiento_aplicado: '', prescripciones: '',
  pronostico: '', control_evolucion: '', alta_paciente: '', observaciones: '',
};

// Campos obligatorios (CA5) — labels iguales a los que devuelve el backend
const OBLIGATORIOS = [
  ['motivo_consulta',         'Motivo de consulta'],
  ['presion_arterial',        'Presión arterial (P.A)'],
  ['pulso',                   'Pulso'],
  ['frecuencia_respiratoria', 'Frecuencia respiratoria (F.R)'],
  ['temperatura',             'Temperatura (T)'],
  ['diagnostico_presuntivo',  'Diagnóstico presuntivo'],
  ['diagnostico_definitivo',  'Diagnóstico definitivo (CIE-10)'],
];

const calcEdad = (fnac) => {
  if (!fnac) return '—';
  const d = new Date(fnac);
  if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return `${edad} años`;
};

export default function RegistrarAtencion() {
  const { citaId } = useParams();
  const navigate   = useNavigate();

  const [cita,     setCita]     = useState(null);
  const [consulta, setConsulta] = useState(null);   // si existe → solo lectura (CA7)
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [form, setForm]     = useState(INITIAL);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await api.get(`/consultas/cita/${citaId}`);
      setCita(data.cita);
      setConsulta(data.consulta);

      setForm((prev) => {
        const next = { ...prev };
        const a = data.antecedentes || {};
        next.antecedentes_sistemicos      = a.antecedentes_sistemicos      ?? '';
        next.antecedentes_estomatologicos = a.antecedentes_estomatologicos ?? '';
        next.antecedentes_farmacologicos  = a.antecedentes_farmacologicos  ?? '';
        next.antecedentes_otros           = a.antecedentes_otros           ?? '';
        next.antecedentes_familiares      = a.antecedentes_familiares      ?? '';
        const c = data.consulta;
        if (c) {
          for (const k of Object.keys(INITIAL)) {
            if (k.startsWith('antecedentes_')) continue;
            if (c[k] !== undefined && c[k] !== null) next[k] = String(c[k]);
          }
        }
        return next;
      });
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        toast.error(err.response?.data?.error || 'No se pudo abrir la atención');
        navigate('/doctor/agenda');
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [citaId, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  const bloqueado = !!consulta;

  const handle = (name, val) => {
    setForm((p) => ({ ...p, [name]: val }));
    if (errors.length) setErrors([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const faltantes = OBLIGATORIOS
      .filter(([k]) => !form[k] || !form[k].trim())
      .map(([, label]) => label);
    if (faltantes.length) {
      setErrors(faltantes);
      toast.error('Faltan campos obligatorios por completar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/consultas', { cita_id: Number(citaId), ...form });
      toast.success('Atención registrada. La cita pasó a "Atendida".');
      navigate('/doctor/agenda');
    } catch (err) {
      const data = err.response?.data;
      if (data?.faltantes) { setErrors(data.faltantes); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      toast.error(data?.error || 'No se pudo registrar la atención');
    } finally {
      setSaving(false);
    }
  };

  const props = (name) => ({
    name, value: form[name], onChange: handle, readOnly: bloqueado,
    faltante: errors.includes(OBLIGATORIOS.find(([k]) => k === name)?.[1]),
  });

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/doctor/agenda')}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#0059B3] flex items-center gap-2">
                  <Stethoscope size={20} />
                  Historia Clínica Odontológica
                </h1>
                <p className="text-sm text-slate-500">
                  {bloqueado ? 'Registro clínico (solo lectura)' : 'Documenta la atención de esta cita'}
                </p>
              </div>
            </div>
            {cita && (
              <button onClick={() => navigate(`/doctor/historial/${cita.paciente_id}`)}
                className="inline-flex items-center gap-2 border border-[#0059B3] text-[#0059B3]
                           hover:bg-blue-50 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
                <FileClock size={16} /> Ver historial clínico
              </button>
            )}
          </div>

          <PageLoader loading={loading} error={error} onRetry={cargar}>
            {cita && (
              <>
                {/* Aviso de inmutabilidad (CA7) */}
                {bloqueado && (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200
                                  text-[#0059B3] text-sm rounded-xl px-4 py-3">
                    <Lock size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Registro clínico <b>inmutable</b>: una vez guardado no puede modificarse.
                      Firmado por {consulta.firmado_por} el {fmtFecha(consulta.fecha_atencion)}.
                    </span>
                  </div>
                )}

                {/* Alerta de faltantes (CA5) */}
                {!bloqueado && errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} /> Faltan campos obligatorios:
                    </p>
                    <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                      {errors.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">

                  {/* 1. Datos de filiación */}
                  <Card titulo="1. Datos de filiación">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <Dato label="Nombres y apellidos" valor={`${cita.paciente_nombre} ${cita.paciente_apellido}`} />
                      <Dato label="DNI / CE" valor={`${cita.tipo_documento}: ${cita.numero_documento}`} />
                      <Dato label="Edad" valor={calcEdad(cita.fecha_nacimiento)} />
                      <Dato label="Sexo" valor={cita.sexo} />
                      <Dato label="Fecha de nacimiento" valor={cita.fecha_nacimiento ? fmtFecha(cita.fecha_nacimiento) : '—'} />
                      <Dato label="Ocupación" valor={cita.ocupacion} />
                      <Dato label="Teléfono" valor={cita.paciente_telefono} />
                      <Dato label="Emergencia" valor={cita.contacto_emergencia} />
                      <Dato label="Dirección" valor={cita.direccion} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm border-t border-slate-200 pt-3">
                      <Dato label="N° Cita" valor={cita.codigo_cita} mono />
                      <Dato label="Fecha y hora" valor={`${fmtFecha(cita.fecha)} · ${cita.hora_inicio}`} />
                      <Dato label="Servicio" valor={cita.servicio_nombre} />
                      <Dato label="Doctor" valor={cita.doctor_nombre} />
                      {cita.especialidad && <Dato label="Especialidad" valor={cita.especialidad} />}
                    </div>
                  </Card>

                  {/* I. Anamnesis */}
                  <Card titulo="I. Anamnesis" obligatorio>
                    <Campo label="Motivo de consulta *" area {...props('motivo_consulta')} />
                    <p className="text-xs font-semibold text-slate-600">Enfermedad actual</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Campo label="Inicio" area {...props('enfermedad_inicio')} />
                      <Campo label="Evolución" area {...props('enfermedad_evolucion')} />
                      <Campo label="Estado actual" area {...props('enfermedad_estado_actual')} />
                    </div>
                  </Card>

                  {/* Antecedentes */}
                  <Card titulo="Antecedentes">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Campo label="Sistémicos" area {...props('antecedentes_sistemicos')} />
                      <Campo label="Estomatológicos" area {...props('antecedentes_estomatologicos')} />
                      <Campo label="Farmacológicos" area {...props('antecedentes_farmacologicos')} />
                      <Campo label="Otros" area {...props('antecedentes_otros')} />
                    </div>
                    <Campo label="Familiares" area {...props('antecedentes_familiares')} />
                  </Card>

                  {/* II. Examen clínico */}
                  <Card titulo="II. Examen clínico — Funciones vitales" obligatorio>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Campo label="P.A *" placeholder="120/80" {...props('presion_arterial')} />
                      <Campo label="Pulso *" placeholder="72 x'" {...props('pulso')} />
                      <Campo label="F.R *" placeholder="16 x'" {...props('frecuencia_respiratoria')} />
                      <Campo label="T (°C) *" inputMode="decimal" placeholder="36.5" {...props('temperatura')} />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mt-2">Examen regional</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Campo label="Extra oral" area {...props('examen_extraoral')} />
                      <Campo label="Intra oral" area {...props('examen_intraoral')} />
                    </div>
                  </Card>

                  {/* III–V. Diagnósticos */}
                  <Card titulo="III. Diagnóstico presuntivo" obligatorio>
                    <Campo label="Diagnóstico presuntivo *" area {...props('diagnostico_presuntivo')} />
                  </Card>
                  <Card titulo="IV. Exámenes complementarios">
                    <Campo label="Exámenes complementarios" area {...props('examenes_complementarios')} />
                  </Card>
                  <Card titulo="V. Diagnóstico definitivo (CIE-10)" obligatorio>
                    <Campo label="Diagnóstico definitivo *" area {...props('diagnostico_definitivo')} />
                    <Campo label="Código CIE-10" placeholder="Ej. K02.1" {...props('diagnostico_cie10')} />
                  </Card>

                  {/* VI–X. Plan, tratamiento y cierre */}
                  <Card titulo="VI. Plan de tratamiento">
                    <Campo label="Plan de tratamiento" area {...props('plan_tratamiento')} />
                  </Card>
                  <Card titulo="VII. Tratamiento">
                    <Campo label="Tratamiento realizado" area {...props('tratamiento_aplicado')} />
                    <Campo label="Prescripciones / recetas" area {...props('prescripciones')} />
                  </Card>
                  <Card titulo="VIII–X. Pronóstico, control y alta">
                    <Campo label="Pronóstico" area {...props('pronostico')} />
                    <Campo label="Control y evolución" area {...props('control_evolucion')} />
                    <Campo label="Alta del paciente" area {...props('alta_paciente')} />
                    <Campo label="Observaciones" area {...props('observaciones')} />
                  </Card>

                  {/* Acciones */}
                  {bloqueado ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-2">
                      <CheckCircle2 size={16} className="text-green-500" />
                      Atención registrada y cerrada.
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => navigate('/doctor/agenda')}
                        className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium
                                   text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancelar
                      </button>
                      <button type="submit" disabled={saving}
                        className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                                   disabled:opacity-60 disabled:cursor-not-allowed
                                   text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                        {saving
                          ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                          : <><Save size={16} /> Guardar atención</>}
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}
          </PageLoader>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Helpers de UI ────────────────────────────────────────────────────
function Card({ titulo, obligatorio, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider
                    border-b border-slate-100 pb-1">
        {titulo} {obligatorio && <span className="text-red-500 normal-case">· obligatorio</span>}
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

// Input/textarea editable o texto estático (solo lectura, CA7)
function Campo({ label, name, value, onChange, readOnly, area, placeholder, inputMode, faltante }) {
  if (readOnly) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">{label.replace(' *', '')}</label>
        <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2 min-h-[2.5rem]">
          {value || '—'}
        </p>
      </div>
    );
  }
  const cls = `w-full border rounded-lg px-3 py-2 text-sm
               focus:outline-none focus:ring-2 transition-shadow
               ${faltante ? 'border-red-400 focus:ring-red-300'
                          : 'border-slate-300 focus:ring-[#0059B3]/40'}`;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {area ? (
        <textarea rows={2} value={value} placeholder={placeholder}
          onChange={(e) => onChange(name, e.target.value)} className={cls} />
      ) : (
        <input type="text" value={value} placeholder={placeholder} inputMode={inputMode}
          onChange={(e) => onChange(name, e.target.value)} className={cls} />
      )}
      {faltante && <p className="text-xs text-red-500 mt-1">⚠ Requerido</p>}
    </div>
  );
}
