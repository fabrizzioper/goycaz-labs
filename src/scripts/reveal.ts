// Animaciones de entrada con `motion` (el motor de framer-motion sin React),
// con los mismos parámetros que usa devscor: fade + 16px, 0.6s,
// ease [.16,1,.3,1], stagger de 0.08s y delay inicial de 0.1s.
import { animate, inView, stagger } from 'motion';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function show(el: HTMLElement) {
  el.style.opacity = '1';
  el.style.transform = 'none';
}

document.querySelectorAll<HTMLElement>('.reveal, .stagger').forEach((el) => {
  const targets = el.classList.contains('stagger')
    ? (Array.from(el.children) as HTMLElement[])
    : [el];
  if (!targets.length) return;
  if (reduce) { targets.forEach(show); return; }

  inView(el, () => {
    animate(
      targets,
      { opacity: [0, 1], y: [16, 0] },
      { duration: 0.6, ease: EASE, delay: stagger(0.08, { startDelay: 0.1 }) },
    );
    // sin retorno → se dispara una sola vez
  }, { amount: 0.15 });
});
