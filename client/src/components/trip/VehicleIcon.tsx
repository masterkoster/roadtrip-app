export type VehicleType = 'car' | 'motorcycle' | 'rv' | 'train' | 'plane' | 'bicycle' | 'other';

const VEHICLE_LABELS: Record<VehicleType, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  rv: 'RV',
  train: 'Train',
  plane: 'Plane',
  bicycle: 'Bicycle',
  other: 'Other',
};

interface VehicleIconProps {
  type: VehicleType;
  className?: string;
  size?: number;
}

function CarSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="8" y="24" width="48" height="20" rx="6" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="16" width="12" height="10" rx="3" fill="currentColor" opacity="0.7"/>
      <rect x="38" y="16" width="12" height="10" rx="3" fill="currentColor" opacity="0.7"/>
      <circle cx="20" cy="46" r="6" fill="white" stroke="currentColor" strokeWidth="2"/>
      <circle cx="44" cy="46" r="6" fill="white" stroke="currentColor" strokeWidth="2"/>
      <rect x="24" y="32" width="16" height="4" rx="2" fill="white" opacity="0.3"/>
    </svg>
  );
}

function MotorcycleSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="8" y="34" width="28" height="6" rx="3" fill="currentColor" opacity="0.9" transform="rotate(-15, 22, 37)"/>
      <circle cx="18" cy="46" r="7" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="46" cy="46" r="7" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="18" cy="46" r="3" fill="currentColor"/>
      <circle cx="46" cy="46" r="3" fill="currentColor"/>
      <rect x="34" y="16" width="20" height="4" rx="2" fill="currentColor" opacity="0.7" transform="rotate(10, 44, 18)"/>
      <rect x="44" y="12" width="6" height="10" rx="2" fill="currentColor" opacity="0.5"/>
      <rect x="8" y="28" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

function RVSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="6" y="22" width="52" height="26" rx="4" fill="currentColor" opacity="0.9"/>
      <rect x="12" y="24" width="30" height="12" rx="2" fill="white" opacity="0.2"/>
      <rect x="12" y="16" width="8" height="8" rx="2" fill="currentColor" opacity="0.6"/>
      <rect x="44" y="38" width="10" height="6" rx="2" fill="currentColor" opacity="0.8"/>
      <circle cx="20" cy="50" r="6" fill="white" stroke="currentColor" strokeWidth="2"/>
      <circle cx="44" cy="50" r="6" fill="white" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function TrainSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="4" y="24" width="22" height="18" rx="3" fill="currentColor" opacity="0.9"/>
      <rect x="28" y="24" width="18" height="18" rx="3" fill="currentColor" opacity="0.8"/>
      <rect x="48" y="24" width="12" height="18" rx="3" fill="currentColor" opacity="0.7"/>
      <rect x="8" y="18" width="14" height="8" rx="2" fill="currentColor" opacity="0.5"/>
      <circle cx="14" cy="34" r="3" fill="white" opacity="0.5"/>
      <circle cx="37" cy="34" r="3" fill="white" opacity="0.5"/>
      <circle cx="54" cy="34" r="3" fill="white" opacity="0.5"/>
      <circle cx="10" cy="48" r="5" fill="white" stroke="currentColor" strokeWidth="2"/>
      <circle cx="42" cy="48" r="5" fill="white" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function PlaneSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 4 L36 24 L56 30 L52 34 L36 28 L32 50 L28 28 L12 34 L8 30 L28 24 Z" fill="currentColor" opacity="0.9"/>
      <circle cx="32" cy="8" r="3" fill="currentColor"/>
    </svg>
  );
}

function BicycleSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="18" cy="46" r="7" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="46" cy="46" r="7" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="18" cy="46" r="3" fill="currentColor"/>
      <circle cx="46" cy="46" r="3" fill="currentColor"/>
      <line x1="18" y1="46" x2="46" y2="46" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="32" y1="46" x2="32" y2="18" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="32" y1="26" x2="22" y2="40" stroke="currentColor" strokeWidth="2"/>
      <line x1="32" y1="26" x2="42" y2="40" stroke="currentColor" strokeWidth="2"/>
      <line x1="32" y1="18" x2="24" y2="30" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function OtherSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 8 L40 28 L56 32 L44 42 L48 58 L32 50 L16 58 L20 42 L8 32 L24 28 Z" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

const VEHICLE_ICONS: Record<VehicleType, (size: number) => JSX.Element> = {
  car: (s) => <CarSVG size={s} />,
  motorcycle: (s) => <MotorcycleSVG size={s} />,
  rv: (s) => <RVSVG size={s} />,
  train: (s) => <TrainSVG size={s} />,
  plane: (s) => <PlaneSVG size={s} />,
  bicycle: (s) => <BicycleSVG size={s} />,
  other: (s) => <OtherSVG size={s} />,
};

export default function VehicleIcon({ type, className = '', size = 32 }: VehicleIconProps) {
  const Icon = VEHICLE_ICONS[type] || VEHICLE_ICONS.car;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={VEHICLE_LABELS[type]}>
      {Icon(size)}
    </span>
  );
}

export function VehicleBadge({ type, className = '' }: { type: VehicleType; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 ${className}`}>
      {VEHICLE_ICONS[type]?.(16) || <OtherSVG size={16} />}
      {VEHICLE_LABELS[type] || 'Other'}
    </span>
  );
}

export const vehicleOptions: { value: VehicleType; label: string }[] = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'rv', label: 'RV / Campervan' },
  { value: 'train', label: 'Train' },
  { value: 'plane', label: 'Plane' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'other', label: 'Other' },
];
