/**
 * Pointer-follow spotlight: writes the cursor position (relative to the hovered
 * card) into --mx/--my so CSS can paint a soft glow under the cursor.
 * One delegated listener, no per-component wiring.
 */
export function installMagneticGlow(): void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let frame = 0;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (frame) return;
      const { target, clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = (target as HTMLElement | null)?.closest?.<HTMLElement>('.ant-card, .sad-card, .sms-glow');
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${clientX - rect.left}px`);
        el.style.setProperty('--my', `${clientY - rect.top}px`);
      });
    },
    { passive: true },
  );
}
