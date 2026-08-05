/** Line icons for the notes toolbar — clearer than emoji and controllable. */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/**
 * The mode switch. Shows BOTH a stylus and a keyboard with a swap arrow, so
 * it reads as "change between these two" rather than "you are here" — the
 * whole point being that tapping a pencil to get a keyboard is backwards.
 * Whichever mode is active is filled in; the other is outlined.
 */
export function SwitchModeIcon({ mode }: { mode: 'pen' | 'text' }) {
  const penOn = mode === 'pen';
  return (
    <svg viewBox="0 0 34 24" width="30" height="22" aria-hidden="true">
      {/* stylus */}
      <g opacity={penOn ? 1 : 0.4}>
        <path d="M4 15.5 12.5 7l2.5 2.5L6.5 18H4z" {...S} fill={penOn ? 'currentColor' : 'none'} />
        <path d="M11.2 8.3 13.7 10.8" {...S} />
      </g>
      {/* swap arrows */}
      <path d="M16.6 8.5h2.2M18.2 7.4l1.1 1.1-1.1 1.1" {...S} strokeWidth={1.3} />
      <path d="M19.4 15.5h-2.2M17.8 16.6l-1.1-1.1 1.1-1.1" {...S} strokeWidth={1.3} />
      {/* keyboard */}
      <g opacity={penOn ? 0.4 : 1}>
        <rect x="21.5" y="7.5" width="11" height="9" rx="1.6" {...S} fill={penOn ? 'none' : 'currentColor'} fillOpacity={penOn ? 0 : 0.15} />
        <path d="M23.6 10.2h.01M25.9 10.2h.01M28.2 10.2h.01M30.4 10.2h.01M23.6 12.4h.01M30.4 12.4h.01M25.6 14.3h3.2" {...S} strokeWidth={1.4} />
      </g>
    </svg>
  );
}

/** A stylus touching a screen — this is drawing on a device, not on paper. */
export function StylusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="2.5" y="3" width="19" height="14" rx="2" {...S} />
      <path d="M2.5 20h19" {...S} strokeWidth={1.3} />
      <path d="M8 14.2 15.2 7l2.1 2.1L10.1 16.3 7.4 17z" {...S} fill="currentColor" fillOpacity={0.12} />
    </svg>
  );
}

/** The pen's own settings: a nib with a coloured stroke coming off the tip. */
export function PenSettingsIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6.5 16.5 15.5 7.5l1.8 1.8-9 9-2.4.6z" {...S} />
      <path d="M14.3 8.7 16.1 10.5" {...S} strokeWidth={1.3} />
      <path d="M4 21c3.6-2.6 7.2-2.6 10.8 0" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function EraserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M9 19H5.8a1.8 1.8 0 0 1-1.3-3.1l9-9a1.8 1.8 0 0 1 2.6 0l3.2 3.2a1.8 1.8 0 0 1 0 2.6L12.5 19z" {...S} />
      <path d="M8.2 11.6 14.6 18" {...S} strokeWidth={1.3} />
      <path d="M9 19h11" {...S} strokeWidth={1.3} />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8" {...S} />
      <path d="M7.5 5.5 4 9l3.5 3.5" {...S} />
    </svg>
  );
}

/** Text colour and size. */
export function TextStyleIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4.5 17 9.8 5.5h1.4L16.5 17" {...S} />
      <path d="M6.8 13h7.4" {...S} strokeWidth={1.3} />
      <path d="M4 21h16" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
    </svg>
  );
}
