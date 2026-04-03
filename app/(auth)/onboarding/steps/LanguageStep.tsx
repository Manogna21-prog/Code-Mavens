'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib/config/constants';

interface LanguageStepProps {
  initialLanguage: string;
  onNext: (language: string) => void;
}

export default function LanguageStep({ initialLanguage, onNext }: LanguageStepProps) {
  const [selected, setSelected] = useState(initialLanguage || 'en');

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Choose Your Language</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Select your preferred language for the app.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setSelected(lang.code)}
            className="flex items-center justify-between p-4 rounded-lg transition-all"
            style={
              selected === lang.code
                ? { border: '2px solid var(--teal)', background: 'var(--teal-bg)' }
                : { border: '1px solid var(--rule)', background: 'transparent' }
            }
          >
            <span className="sans text-base font-medium" style={{ color: 'var(--ink)' }}>{lang.label}</span>
            {selected === lang.code && (
              <span className="text-lg" style={{ color: 'var(--teal)' }}>&#10003;</span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onNext(selected)}
        className="mt-6 w-full py-3 rounded-lg font-medium transition-colors"
        style={{ background: 'var(--teal)', color: '#fff' }}
      >
        Continue
      </button>
    </div>
  );
}
