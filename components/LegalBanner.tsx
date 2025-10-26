"use client"

import React from 'react'

const STORAGE_KEY = 'cw_trainer_legal_ack_v1'

export default function LegalBanner() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    try {
      const ack = localStorage.getItem(STORAGE_KEY)
      setVisible(ack !== '1')
    } catch {
      setVisible(true)
    }
  }, [])

  const acknowledge = React.useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-5xl p-3">
        <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 shadow">
          <div className="flex items-start gap-3 p-3 sm:p-4">
            <div className="mt-0.5 hidden sm:block">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm10.5-4.125a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0zM12 9.75a.75.75 0 01.75.75v6a.75.75 0 01-1.5 0v-6A.75.75 0 0112 9.75z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 text-sm leading-6">
              <p className="font-medium">Personal-use project with basic data collection</p>
              <p className="mt-1 text-yellow-950/90">
                This open-source app stores training data locally and may sync anonymized stats for features like leaderboards. It is for personal use only. The author is not a legal expert and assumes no legal responsibility. If you do not agree, please leave this site.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href="#data-notice" className="text-yellow-900 underline underline-offset-2 hover:text-yellow-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600/40">
                  Learn more
                </a>
                <a href="https://github.com/mashu/cw-trainer" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-yellow-900 hover:text-yellow-800">
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  GitHub
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <button onClick={acknowledge} className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600/40">I understand</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


