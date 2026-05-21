export function TruckIcon({ status = 'idle', isSelected = false, rotation = 0 }) {
  const baseSize = isSelected ? 40 : 32;

  const getSVGContent = () => (
    <svg viewBox="0 0 100 100" width={baseSize} height={baseSize} className="drop-shadow-lg">
      {/* Truck Body - Premium Design */}
      <defs>
        <filter id="truckGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="truckGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor: '#1e3a8a', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#1e40af', stopOpacity: 1}} />
        </linearGradient>
      </defs>

      {/* Main Truck Body */}
      <g filter="url(#truckGlow)">
        {/* Cargo Container */}
        <rect x="28" y="35" width="52" height="35" rx="3" fill="url(#truckGradient)" stroke="#0f172a" strokeWidth="1.5"/>

        {/* Cabin */}
        <rect x="10" y="40" width="18" height="25" rx="2" fill="#1e40af" stroke="#0f172a" strokeWidth="1.5"/>

        {/* Cabin Window */}
        <rect x="12" y="42" width="14" height="8" rx="1" fill="#e0f2fe" opacity="0.8"/>

        {/* Connection */}
        <rect x="28" y="48" width="2" height="15" fill="#0f172a"/>

        {/* Rear Wheel */}
        <circle cx="75" cy="72" r="6" fill="#0f172a" stroke="#1e40af" strokeWidth="1"/>
        <circle cx="75" cy="72" r="4" fill="none" stroke="#64748b" strokeWidth="1"/>

        {/* Front Wheel */}
        <circle cx="22" cy="72" r="6" fill="#0f172a" stroke="#1e40af" strokeWidth="1"/>
        <circle cx="22" cy="72" r="4" fill="none" stroke="#64748b" strokeWidth="1"/>

        {/* Direction Arrow/Front Indicator */}
        <polygon points="60,32 65,28 70,32" fill="#3b82f6" opacity="0.9"/>
      </g>

      {/* Status Indicators */}
      {status === 'moving' && (
        <>
          {/* Moving Glow */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.3" className="animate-pulse"/>
        </>
      )}

      {status === 'idle' && (
        <>
          {/* Yellow Pulse Underneath */}
          <circle cx="50" cy="85" r="5" fill="#eab308" opacity="0.8" className="animate-pulse"/>
          <circle cx="50" cy="85" r="6" fill="none" stroke="#eab308" strokeWidth="1" opacity="0.4" className="animate-pulse"/>
        </>
      )}

      {status === 'stopped' && (
        <>
          {/* Red Status Dot */}
          <circle cx="82" cy="35" r="4" fill="#ef4444" stroke="#dc2626" strokeWidth="1"/>
          <circle cx="82" cy="35" r="5.5" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4"/>
        </>
      )}

      {status === 'offline' && (
        <>
          {/* Offline Indicator - X mark */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#94a3b8" strokeWidth="1.5" opacity="0.5" strokeDasharray="4,4"/>
          <line x1="30" y1="30" x2="70" y2="70" stroke="#94a3b8" strokeWidth="2" opacity="0.6"/>
          <line x1="70" y1="30" x2="30" y2="70" stroke="#94a3b8" strokeWidth="2" opacity="0.6"/>
        </>
      )}

      {/* Selection Glow */}
      {isSelected && (
        <circle cx="50" cy="50" r="41" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.8" className="animate-pulse"/>
      )}
    </svg>
  );

  return (
    <div
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: status === 'moving' ? 'transform 0.8s ease-out' : 'none',
      }}
      className={status === 'moving' ? '' : ''}
    >
      {getSVGContent()}
    </div>
  );
}
