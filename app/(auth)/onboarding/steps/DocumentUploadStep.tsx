'use client';

import { useState } from 'react';
import { documentUploadSchema } from '@/lib/validations/schemas';

interface DocumentUploadStepProps {
  initialDl: string;
  initialRc: string;
  onNext: (data: { dl_number: string; rc_number: string }) => void;
  onBack: () => void;
}

export default function DocumentUploadStep({
  initialDl,
  initialRc,
  onNext,
  onBack,
}: DocumentUploadStepProps) {
  const [dlNumber, setDlNumber] = useState(initialDl || '');
  const [rcNumber, setRcNumber] = useState(initialRc || '');
  const [dlFile, setDlFile] = useState<string | null>(null);
  const [rcFile, setRcFile] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    setErrors({});
    const result = documentUploadSchema.safeParse({
      dl_number: dlNumber,
      rc_number: rcNumber,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field) fieldErrors[String(field)] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    onNext({ dl_number: dlNumber, rc_number: rcNumber });
  };

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Upload Documents</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Enter your driving licence and vehicle registration details.
      </p>

      <div className="space-y-5">
        {/* DL Number */}
        <div>
          <label htmlFor="dl_number" className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            Driving Licence Number
          </label>
          <input
            id="dl_number"
            type="text"
            placeholder="e.g., DL-0420110012345"
            value={dlNumber}
            onChange={(e) => setDlNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-lg outline-none"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
          />
          {errors.dl_number && <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{errors.dl_number}</p>}
        </div>

        {/* DL Image (mock) */}
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            DL Image (optional)
          </label>
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
            style={
              dlFile
                ? { borderColor: '#F07820', background: 'rgba(240,120,32,0.10)' }
                : { borderColor: 'var(--rule)', background: 'transparent' }
            }
            onClick={() => setDlFile(dlFile ? null : 'mock-dl-image.jpg')}
          >
            {dlFile ? (
              <span className="sans text-sm" style={{ color: '#D4611A' }}>DL image uploaded (mock)</span>
            ) : (
              <span className="sans text-sm" style={{ color: 'var(--ink-60)' }}>Click to upload DL image</span>
            )}
          </div>
        </div>

        {/* RC Number */}
        <div>
          <label htmlFor="rc_number" className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            Vehicle RC Number
          </label>
          <input
            id="rc_number"
            type="text"
            placeholder="e.g., MH02AB1234"
            value={rcNumber}
            onChange={(e) => setRcNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-lg outline-none"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
          />
          {errors.rc_number && <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{errors.rc_number}</p>}
        </div>

        {/* RC Image (mock) */}
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            RC Image (optional)
          </label>
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
            style={
              rcFile
                ? { borderColor: '#F07820', background: 'rgba(240,120,32,0.10)' }
                : { borderColor: 'var(--rule)', background: 'transparent' }
            }
            onClick={() => setRcFile(rcFile ? null : 'mock-rc-image.jpg')}
          >
            {rcFile ? (
              <span className="sans text-sm" style={{ color: '#D4611A' }}>RC image uploaded (mock)</span>
            ) : (
              <span className="sans text-sm" style={{ color: 'var(--ink-60)' }}>Click to upload RC image</span>
            )}
          </div>
        </div>
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
          onClick={handleSubmit}
          className="flex-1 py-3 rounded-lg font-medium transition-colors"
          style={{ background: '#F07820', color: '#fff' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
