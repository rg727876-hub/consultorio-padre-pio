import { useRef, useCallback, useEffect } from 'react';

/**
 * Hace que una "nube" siga al cursor dentro del contenedor, con un ligero
 * retraso (interpolación) para dar sensación de estela / deslizamiento.
 * Expone la posición suavizada como variables CSS (--cx, --cy) y alterna
 * la clase `.cloud-on` al entrar/salir.
 *
 *   const dots = useDotCursor();
 *   <div ref={dots.ref} {...dots.handlers} className="dot-host ...">
 *     <div className="absolute inset-0 dot-pattern" />
 *     <div className="absolute inset-0 dot-cloud" />
 *   </div>
 */
export function useDotCursor() {
  const ref    = useRef(null);
  const target = useRef({ x: -400, y: -400 });
  const pos    = useRef({ x: -400, y: -400 });
  const raf    = useRef(0);
  const active = useRef(false);

  const loop = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Interpolación suave hacia el cursor (estela)
    pos.current.x += (target.current.x - pos.current.x) * 0.14;
    pos.current.y += (target.current.y - pos.current.y) * 0.14;
    el.style.setProperty('--cx', `${pos.current.x}px`);
    el.style.setProperty('--cy', `${pos.current.y}px`);
    if (active.current) raf.current = requestAnimationFrame(loop);
  }, []);

  const onMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    target.current.x = e.clientX - r.left;
    target.current.y = e.clientY - r.top;
  }, []);

  const onMouseEnter = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // Aparece donde entra el cursor (sin "volar" desde fuera)
    target.current = { x, y };
    pos.current    = { x, y };
    active.current = true;
    el.classList.add('cloud-on');
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  }, [loop]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    active.current = false;
    cancelAnimationFrame(raf.current);
    if (el) el.classList.remove('cloud-on');
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return { ref, handlers: { onMouseMove, onMouseEnter, onMouseLeave } };
}
