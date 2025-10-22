'use client'

import ICRTrainer from '@/components/ICRTrainer'
import React from 'react'

export default function ICRPage() {
  const [icrSettings, setIcrSettings] = React.useState<{ trialsPerSession: number; trialDelayMs: number; vadEnabled: boolean; vadThreshold: number; vadHoldMs: number; micDeviceId?: string; bucketGreenMaxMs: number; bucketYellowMaxMs: number }>({ trialsPerSession: 30, trialDelayMs: 700, vadEnabled: true, vadThreshold: 0.08, vadHoldMs: 60, bucketGreenMaxMs: 300, bucketYellowMaxMs: 800 });
  const [sharedAudio, setSharedAudio] = React.useState<{ kochLevel: number; charWpm: number; effectiveWpm?: number; sideToneMin: number; sideToneMax: number; steepness: number; envelopeSmoothing?: number }>({ kochLevel: 2, charWpm: 20, effectiveWpm: 20, sideToneMin: 600, sideToneMax: 600, steepness: 5, envelopeSmoothing: 0 });

  React.useEffect(() => {
    try {
      const rawIcr = localStorage.getItem('morse_icr_settings');
      if (rawIcr) setIcrSettings(prev => ({ ...prev, ...JSON.parse(rawIcr) }));
    } catch {}
    try {
      const rawShared = localStorage.getItem('morse_settings_local');
      if (rawShared) {
        const s = JSON.parse(rawShared);
        setSharedAudio(prev => ({
          kochLevel: typeof s?.kochLevel === 'number' ? s.kochLevel : prev.kochLevel,
          charWpm: typeof s?.charWpm === 'number' ? s.charWpm : (typeof s?.wpm === 'number' ? s.wpm : prev.charWpm),
          effectiveWpm: typeof s?.effectiveWpm === 'number' ? s.effectiveWpm : (typeof s?.charWpm === 'number' ? s.charWpm : (typeof s?.wpm === 'number' ? s.wpm : prev.effectiveWpm)),
          sideToneMin: typeof s?.sideToneMin === 'number' ? s.sideToneMin : (typeof s?.sideTone === 'number' ? s.sideTone : prev.sideToneMin),
          sideToneMax: typeof s?.sideToneMax === 'number' ? s.sideToneMax : (typeof s?.sideTone === 'number' ? s.sideTone : prev.sideToneMax),
          steepness: typeof s?.steepness === 'number' ? s.steepness : prev.steepness,
          envelopeSmoothing: typeof s?.envelopeSmoothing === 'number' ? s.envelopeSmoothing : prev.envelopeSmoothing,
        }));
      }
    } catch {}
  }, []);

  return (
    <div className="p-4">
      <div className="mb-3">
        <a href="/" className="text-blue-600 hover:underline">← Back to Group Trainer</a>
      </div>
      <ICRTrainer sharedAudio={sharedAudio} icrSettings={icrSettings} setIcrSettings={setIcrSettings} />
    </div>
  )
}


