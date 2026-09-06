// Animaciones de entrada con `motion` (el motor de framer-motion sin React),
// con los mismos parámetros que usa devscor: fade + 16px, 0.6s,
// ease [.16,1,.3,1], stagger de 0.08s y delay inicial de 0.1s.
//
// IMPORTANTE: mientras haya JS, el CSS deja estos elementos en `opacity:0`
// (`.js .reveal`). Si la animación no llega a correr — porque `motion` no
// cargó, porque el navegador no trae IntersectionObserver, o porque el
// elemento nunca entra en viewport — la página se quedaría en blanco.
// Por eso todo va detrás de guardias que revelan el contenido pase lo que
// pase: la animación es un adorno, la legibilidad no es negociable.

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function show(el: HTMLElement) {
  el.style.opacity = '1';
  el.style.transform = 'none';
}

function targetsOf(el: HTMLElement): HTMLElement[] {
  return el.classList.contains('stagger')
    ? (Array.from(el.children) as HTMLElement[])
    : [el];
}

function all(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.reveal, .stagger'));
}

/** Último recurso: mostrar todo y quitar la clase que aplica el opacity:0. */
function revealEverything() {
  all().forEach((el) => targetsOf(el).forEach(show));
  document.documentElement.classList.remove('js');
}

async function init() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = all();
  if (!els.length) return;

  if (reduce || !('IntersectionObserver' in window)) {
    revealEverything();
    return;
  }

  let motion: typeof import('motion');
  try {
    motion = await import('motion');
  } catch {
    // La librería no cargó: mostramos el contenido sin animación.
    revealEverything();
    return;
  }

  const { animate, inView, stagger } = motion;

  els.forEach((el) => {
    const targets = targetsOf(el);
    if (!targets.length) return;

    inView(
      el,
      () => {
        animate(
          targets,
          { opacity: [0, 1], y: [16, 0] },
          { duration: 0.6, ease: EASE, delay: stagger(0.08, { startDelay: 0.1 }) },
        );
        // sin retorno → se dispara una sola vez
      },
      { amount: 0.15 },
    );
  });

  // Red de seguridad: si a los 3s algo sigue invisible (inView que no disparó,
  // elemento fuera de flujo, etc.), se muestra igual.
  window.setTimeout(() => {
    els.forEach((el) =>
      targetsOf(el).forEach((t) => {
        if (parseFloat(getComputedStyle(t).opacity || '1') < 0.05) show(t);
      }),
    );
  }, 3000);
}

init().catch(revealEverything);
