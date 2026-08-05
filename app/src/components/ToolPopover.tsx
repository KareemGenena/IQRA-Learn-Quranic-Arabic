import { useEffect, useRef, useState } from 'react';

/**
 * An icon button that opens a small panel of options — the pen's colours and
 * widths, the text styles, the diacritics. Keeps the toolbar to a single thin
 * row instead of three rows of permanently visible buttons.
 */
export function ToolPopover({
  icon,
  label,
  children,
  wide,
}: {
  icon: string;
  label: string;
  children: (close: () => void) => React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className={`icon-btn ${open ? 'active' : ''}`}
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </button>
      {open && (
        <div className={`popover ${wide ? 'wide' : ''}`} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
