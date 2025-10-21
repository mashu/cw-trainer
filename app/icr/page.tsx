'use client'

import ICRTrainer from '@/components/ICRTrainer'

export default function ICRPage() {
  return (
    <div className="p-4">
      <div className="mb-3">
        <a href="/" className="text-blue-600 hover:underline">← Back to Group Trainer</a>
      </div>
      <ICRTrainer />
    </div>
  )
}


