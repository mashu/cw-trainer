'use client'

import ICRTrainer from '@/components/ICRTrainer'
import React from 'react'

export default function ICRPage() {
  const [icrSettings, setIcrSettings] = React.useState<{ trialsPerSession: number; trialDelayMs: number; vadEnabled: boolean; vadThreshold: number; vadHoldMs: number; micDeviceId?: string; bucketGreenMaxMs: number; bucketYellowMaxMs: number }>({ trialsPerSession: 30, trialDelayMs: 700, vadEnabled: true, vadThreshold: 0.08, vadHoldMs: 60, bucketGreenMaxMs: 900, bucketYellowMaxMs: 1200 });
  const [sharedAudio, setSharedAudio] = React.useState<{ kochLevel: number; wpm: number; sideTone: number; steepness: number; envelopeSmoothing?: number }>({ kochLevel: 2, wpm: 20, sideTone: 600, steepness: 5, envelopeSmoothing: 0 });

  React.useEffect(() => {
    try {
      const rawIcr = localStorage.getItem('morse_icr_settings');
      if (rawIcr) setIcrSettings(prev => ({ ...prev, ...JSON.parse(rawIcr) }));
    } catch {}
    try {
      const rawShared = localStorage.getItem('morse_settings_local');
      if (rawShared) setSharedAudio(prev => ({ ...prev, ...JSON.parse(rawShared) }));
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


