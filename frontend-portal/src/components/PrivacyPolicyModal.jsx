import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const SECCIONES = [
  {
    titulo: '1. Objetivo y Marco Legal',
    cuerpo: `La presente Política de Privacidad tiene por finalidad establecer y detallar los lineamientos bajo los cuales el Consultorio Padre Pío Odontología (en adelante, "el Consultorio") realiza el tratamiento de los datos personales recopilados a través de su Portal Web.

El Consultorio garantiza que todo tratamiento de información se realiza en estricto cumplimiento de la normativa vigente en la República del Perú, específicamente la Ley N° 29733, Ley de Protección de Datos Personales, y su Reglamento, aprobado mediante Decreto Supremo N° 003-2013-JUS.

Al registrarse en esta plataforma, el Usuario otorga su consentimiento libre, previo, expreso, informado e inequívoco para el tratamiento de sus datos personales. Dicha información será incorporada y resguardada de manera segura en el Banco de Datos Personales denominado "Pacientes", de titularidad exclusiva del Consultorio.`,
  },
  {
    titulo: '2. Datos Personales Recopilados',
    cuerpo: null,
    items: [
      {
        subtitulo: 'Datos de Carácter Identificativo y de Contacto',
        texto: 'Tipo y número de documento de identidad (DNI, Carné de Extranjería o Pasaporte), nombres y apellidos completos, fecha de nacimiento, sexo/género, número telefónico y dirección de correo electrónico.',
      },
      {
        subtitulo: 'Datos Sensibles (Salud)',
        texto: 'Información protegida por el secreto profesional, que incluye el historial clínico integral, odontogramas, diagnósticos, evolución de tratamientos, y antecedentes médicos generales (sistémicos, estomatológicos, farmacológicos, familiares y alergias).',
      },
    ],
  },
  {
    titulo: '3. Finalidad del Tratamiento',
    cuerpo: 'Los datos personales suministrados serán tratados única y exclusivamente para las siguientes finalidades:',
    lista: [
      'Gestionar el registro, validación de identidad y administración de la cuenta de usuario en el portal web.',
      'Facilitar la reserva, reprogramación, consulta y anulación de citas odontológicas.',
      'Almacenar, organizar y custodiar de forma digital la historia clínica médico-legal del paciente.',
      'Procesar las transacciones económicas derivadas de las atenciones y emitir comprobantes de pago electrónicos.',
      'Remitir notificaciones transaccionales (confirmaciones de cita, actualización de credenciales y avisos de seguridad) a través de correo electrónico.',
    ],
  },
  {
    titulo: '4. Gestión de Cuentas Titulares y Vinculación Familiar',
    cuerpo: 'Con el objetivo de salvaguardar la privacidad, autonomía y seguridad de la información, el Consultorio establece las siguientes directrices:',
    items: [
      {
        subtitulo: 'Capacidad Legal del Titular',
        texto: 'Para registrar y administrar una cuenta web asumiendo el rol de "Usuario Titular", la persona debe ser obligatoriamente mayor de edad (18 años o más) y contar con plena capacidad de ejercicio.',
      },
      {
        subtitulo: 'Gestión de Dependientes (Familiares)',
        texto: 'El Usuario Titular se encuentra facultado para vincular a miembros de su entorno familiar (indistintamente de su edad) a su cuenta matriz, asumiendo la representación o autorización pertinente.',
      },
      {
        subtitulo: 'Protocolo de Vinculación Segura',
        texto: 'En caso de que el familiar a vincular posea un historial presencial previo en el Consultorio, el sistema requerirá una validación de identidad. Durante el proceso de vinculación no se exhibirá ningún historial clínico, diagnóstico ni dato sensible preexistente del familiar.',
      },
      {
        subtitulo: 'Restricción de Cuentas Duplicadas',
        texto: 'Queda restringida la vinculación como "Familiar" de cualquier persona que ya cuente con una cuenta web activa operando en calidad de Titular independiente.',
      },
      {
        subtitulo: 'Emancipación y Activación de Cuenta Propia',
        texto: 'Si un paciente registrado bajo la modalidad de "Familiar" decide ejercer la titularidad de sus propios datos (por ejemplo, al alcanzar la mayoría de edad), podrá someterse al proceso de activación de cuenta propia. Tras la validación de su identidad, el sistema le otorgará credenciales exclusivas y desactivará de forma automática e irreversible el vínculo con la cuenta del Titular original, notificando a este último.',
      },
    ],
  },
  {
    titulo: '5. Transferencia y Encargo de Tratamiento Técnico',
    cuerpo: 'El Consultorio mantiene un compromiso de confidencialidad absoluto frente a terceros no autorizados. Para garantizar la operatividad técnica y legal de la plataforma, la información estrictamente necesaria será procesada por los siguientes encargados:',
    items: [
      {
        subtitulo: 'Proveedor de Servicios de Pago',
        texto: 'Entidad encargada de procesar transacciones financieras de forma encriptada y tokenizada. El Consultorio no captura, procesa ni almacena datos críticos de tarjetas bancarias (números PAN, códigos CVV o fechas de caducidad).',
      },
      {
        subtitulo: 'Proveedor de Facturación Electrónica',
        texto: 'Plataforma autorizada para la generación y validación de comprobantes de pago electrónicos frente a la SUNAT.',
      },
      {
        subtitulo: 'Infraestructura en la Nube',
        texto: 'Proveedores de servicios de alojamiento y bases de datos que operan bajo estándares internacionales de seguridad de la información y alta disponibilidad.',
      },
    ],
  },
  {
    titulo: '6. Seguridad de la Información y Control de Accesos Internos',
    cuerpo: 'El Consultorio ha implementado medidas de seguridad técnicas, legales y organizativas. A nivel interno rige una política de acceso basada en el principio del privilegio mínimo:',
    items: [
      {
        subtitulo: 'Personal Médico Especializado',
        texto: 'Posee acceso exclusivo y restringido al historial clínico y antecedentes de salud del paciente, los cuales constituyen registros inmutables por mandato legal.',
      },
      {
        subtitulo: 'Personal de Admisión y Recepción',
        texto: 'Su acceso se limita estrictamente a los datos de contacto y la agenda operativa de turnos, estando bloqueado el acceso a la historia clínica y diagnósticos médicos.',
      },
      {
        subtitulo: 'Personal de Tesorería/Caja',
        texto: 'Únicamente accede a la información transaccional requerida para la liquidación de servicios y emisión de comprobantes.',
      },
    ],
  },
  {
    titulo: '7. Plazo de Conservación',
    cuerpo: `Los datos de registro y navegación vinculados a la operatividad del portal se mantendrán vigentes mientras el Usuario no solicite la cancelación de su cuenta.

Toda la información de carácter médico contenida en el Historial Clínico será custodiada por los plazos de archivo definidos en la Norma Técnica de Salud para la Gestión de la Historia Clínica, dictada por el Ministerio de Salud (MINSA).`,
  },
  {
    titulo: '8. Ejercicio de Derechos ARCO',
    cuerpo: `El Titular de los datos personales puede ejercer en cualquier momento sus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO). Para ello, deberá presentar una solicitud formal de manera presencial en las instalaciones del Consultorio Padre Pío Odontología, o a través de los canales digitales de atención documentaria habilitados.

En caso el Usuario considere que sus derechos no han sido atendidos de forma oportuna o adecuada, le asiste el derecho de presentar una reclamación formal ante la Autoridad Nacional de Protección de Datos Personales (ANPD) del Ministerio de Justicia y Derechos Humanos.`,
  },
  {
    titulo: '9. Modificaciones a la Política de Privacidad',
    cuerpo: 'El Consultorio se reserva el derecho de modificar, actualizar o complementar este documento en cualquier momento, ya sea por directrices estratégicas institucionales, evoluciones técnicas del portal o modificaciones en la legislación aplicable. Toda actualización entrará en vigor de manera inmediata tras su publicación en el Portal Web.',
  },
];

export default function PrivacyPolicyModal({ onClose, onAccept }) {
  const overlayRef = useRef(null);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Cabecera */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">
              Política de Privacidad y Tratamiento de Datos Personales
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Portal Web del Paciente — Consultorio Padre Pío Odontología
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed">
          {SECCIONES.map((sec) => (
            <section key={sec.titulo}>
              <h3 className="font-semibold text-slate-800 mb-2">{sec.titulo}</h3>

              {sec.cuerpo && (
                <div className="space-y-2">
                  {sec.cuerpo.split('\n\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}

              {sec.lista && (
                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                  {sec.lista.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}

              {sec.items && (
                <ul className="mt-2 space-y-2">
                  {sec.items.map((it) => (
                    <li key={it.subtitulo}>
                      <span className="font-medium text-slate-800">{it.subtitulo}: </span>
                      {it.texto}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-slate-300 text-sm text-slate-600
                       hover:bg-slate-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={onAccept}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold
                       hover:bg-blue-700 transition-colors"
          >
            He leído y acepto
          </button>
        </div>
      </div>
    </div>
  );
}
