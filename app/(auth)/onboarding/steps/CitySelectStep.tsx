'use client';

import { useState } from 'react';
import { CITIES } from '@/lib/config/cities';

interface CitySelectStepProps {
  initialCity: string;
  onNext: (data: { city: string; zone_latitude: number; zone_longitude: number }) => void;
  onBack: () => void;
}

export default function CitySelectStep({ initialCity, onNext, onBack }: CitySelectStepProps) {
  const [selected, setSelected] = useState(initialCity || '');

  const handleContinue = () => {
    const city = CITIES.find((c) => c.slug === selected);
    if (!city) return;
    onNext({
      city: city.slug,
      zone_latitude: city.latitude,
      zone_longitude: city.longitude,
    });
  };

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Select Your City</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Choose the city where you primarily operate.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {CITIES.map((city) => (
          <button
            key={city.slug}
            type="button"
            onClick={() => setSelected(city.slug)}
            className="p-4 rounded-lg text-left transition-all"
            style={
              selected === city.slug
                ? { border: '2px solid var(--teal)', background: 'var(--teal-bg)' }
                : { border: '1px solid var(--rule)', background: 'transparent' }
            }
          >
            <p className="sans font-semibold text-sm" style={{ color: 'var(--ink)' }}>{city.name}</p>
            <p className="sans text-xs" style={{ color: 'var(--ink-60)' }}>{city.state}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {city.flood_prone && (
                <span className="mono text-[10px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>Flood</span>
              )}
              {city.aqi_prone && (
                <span className="mono text-[10px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>AQI</span>
              )}
              {city.cyclone_prone && (
                <span className="mono text-[10px] px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>Cyclone</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-lg font-medium transition-colors"
          style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)', background: 'transparent' }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className="flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
