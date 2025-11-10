'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { IcrSettings } from '@/types';

interface ICRSettingsFormProps {
  settings: IcrSettings;
  setSettings: React.Dispatch<React.SetStateAction<IcrSettings>>;
}

export function ICRSettingsForm({
  settings,
  setSettings,
}: ICRSettingsFormProps): JSX.Element {
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [previewActive, setPreviewActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const [holdMs, setHoldMs] = useState(0);

  const stopMicPreview = (): void => {
    try {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    } catch {}
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
    } catch {}
    try {
      micAnalyserRef.current?.disconnect();
    } catch {}
    micAnalyserRef.current = null;
    setPreviewActive(false);
    setMicLevel(0);
    setHoldMs(0);
  };

  const enumerateAudioInputs = async (): Promise<void> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devices.filter((device) => device.kind === 'audioinput'));
    } catch {
      // ignore errors enumerating devices
    }
  };

  const startMicPreview = async (): Promise<void> => {
    try {
      stopMicPreview();
      const constraints: MediaStreamConstraints = {
        audio: settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      micCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      setPreviewActive(true);
      holdStartRef.current = null;

      const measure = (): void => {
        // Check micAnalyserRef instead of previewActive state (which may be stale in closure)
        if (!micAnalyserRef.current) {
          return;
        }
        const analyser = micAnalyserRef.current;
        const buffer = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buffer);
        let peak = 0;
        for (let i = 0; i < buffer.length; i++) {
          const sample = buffer[i];
          if (sample === undefined) continue;
          const v = Math.abs(sample - 128) / 128;
          if (v > peak) peak = v;
        }
        setMicLevel(peak);
        const above = peak >= settings.vadThreshold;
        const now = performance.now();
        if (above) {
          if (holdStartRef.current == null) holdStartRef.current = now;
          const held = now - (holdStartRef.current || now);
          setHoldMs(held);
        } else {
          holdStartRef.current = null;
          setHoldMs(0);
        }
        rafRef.current = requestAnimationFrame(measure);
      };
      rafRef.current = requestAnimationFrame(measure);
    } catch (error) {
      console.error('[ICRSettingsForm] Failed to start mic preview', error);
      stopMicPreview();
    }
  };

  useEffect(() => {
    void enumerateAudioInputs();
    navigator.mediaDevices.addEventListener('devicechange', enumerateAudioInputs);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateAudioInputs);
      stopMicPreview();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopMicPreview();
    };
  }, []);

  return (
    <div className="p-3 border rounded-lg bg-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800">ICR Settings</h4>
        <button
          type="button"
          onClick={() => setShowModeHelp((value) => !value)}
          className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
            showModeHelp
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="What is Mic & VAD?"
          aria-expanded={showModeHelp}
        >
          ?
        </button>
      </div>
      
      {showModeHelp && (
        <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-slate-800 mb-1">Mic & VAD</div>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <span className="font-medium">VAD</span>: Voice Activity Detection to capture when you start speaking.
            </li>
            <li>
              <span className="font-medium">Threshold</span>: Adjust sensitivity to avoid false triggers.
            </li>
            <li>
              <span className="font-medium">Hold</span>: Minimum sustained voice duration to trigger recognition.
            </li>
            <li>
              <span className="font-medium">Mic</span>: Pick input device; use preview to calibrate levels.
            </li>
          </ul>
        </div>
      )}

      {/* Session Settings */}
      <div className="p-3 border rounded-lg bg-white">
        <h4 className="font-semibold text-slate-800 mb-2 text-sm">Session Settings</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            Trials per Session
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              className="block w-full border rounded px-2 py-1"
              value={settings.trialsPerSession}
              onChange={(event) => {
                const value = parseInt(event.target.value || '30', 10);
                if (!isNaN(value) && value >= 1 && value <= 500) {
                  setSettings((previous) => ({
                    ...previous,
                    trialsPerSession: value,
                  }));
                }
              }}
            />
          </label>
          <label>
            Trial Delay (ms)
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              className="block w-full border rounded px-2 py-1"
              value={settings.trialDelayMs}
              onChange={(event) => {
                const value = parseInt(event.target.value || '700', 10);
                if (!isNaN(value) && value >= 0 && value <= 10000) {
                  setSettings((previous) => ({
                    ...previous,
                    trialDelayMs: value,
                  }));
                }
              }}
            />
          </label>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Number of trials per session and delay between trials.
        </p>
      </div>

      {/* Mic & VAD Settings */}
      <div className="p-3 border rounded-lg bg-slate-50">
        <h4 className="font-semibold text-slate-800 mb-2 text-sm">Mic & VAD</h4>
        
        <div className="flex items-center gap-2 mb-2 text-sm">
          <label>VAD Enabled</label>
          <input
            type="checkbox"
            checked={settings.vadEnabled}
            onChange={(event) =>
              setSettings({ ...settings, vadEnabled: event.target.checked })
            }
          />
          <span className="text-slate-600">
            When on, voice onset stops the timer. Use keyboard as fallback.
          </span>
        </div>
        
        <div className="mb-2 text-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Threshold: {settings.vadThreshold.toFixed(2)}
          </label>
          <input
            className="w-full"
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={settings.vadThreshold}
            onChange={(event) =>
              setSettings({
                ...settings,
                vadThreshold: Number(event.target.value),
              })
            }
          />
        </div>
        
        <div className="mb-2 text-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hold (ms): {settings.vadHoldMs}
          </label>
          <input
            className="w-full"
            type="range"
            min={20}
            max={200}
            step={5}
            value={settings.vadHoldMs}
            onChange={(event) =>
              setSettings({ ...settings, vadHoldMs: Number(event.target.value) })
            }
          />
        </div>
        
        <div className="mb-2 text-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Microphone
          </label>
          <select
            className="w-full border rounded px-2 py-1"
            value={settings.micDeviceId || ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                ...(event.target.value ? { micDeviceId: event.target.value } : {}),
              })
            }
          >
            <option value="">System default</option>
            {micDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Mic ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Mic Level</span>
            <span>{Math.round(Math.min(1, micLevel) * 100)}%</span>
          </div>
          <div className="relative h-2 w-full bg-slate-200 rounded">
            <div
              className="h-2 bg-emerald-500 rounded"
              style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
            />
            <div
              className="absolute -top-1 -bottom-1 w-px bg-rose-500"
              style={{
                left: `${Math.min(100, Math.max(0, Math.round((settings.vadThreshold || 0) * 100)))}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Threshold</span>
            <span>{Math.round((settings.vadThreshold || 0) * 100)}%</span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Hold to trigger</span>
              <span>
                {Math.min(holdMs, settings.vadHoldMs)} / {settings.vadHoldMs} ms
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded">
              <div
                className="h-1.5 bg-indigo-500 rounded"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (Math.min(holdMs, settings.vadHoldMs) / Math.max(1, settings.vadHoldMs)) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            className={`px-3 py-1 rounded text-sm ${
              previewActive ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'
            }`}
            onClick={() => {
              if (!previewActive) {
                void startMicPreview();
              }
            }}
            disabled={previewActive}
          >
            Start Preview
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded text-sm bg-gray-100"
            onClick={() => stopMicPreview()}
            disabled={!previewActive}
          >
            Stop Preview
          </button>
        </div>
        <div className="text-xs text-slate-600 mt-2">
          Calibrate: while quiet the bar should be low; when saying &quot;TEST&quot; it should spike
          above 60–80% depending on your Threshold.
        </div>
      </div>

      {/* Performance Buckets */}
      <div className="p-3 border rounded bg-white">
        <h4 className="font-semibold text-slate-800 mb-2 text-sm">Performance Buckets</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            Green &lt;= (ms)
            <input
              type="number"
              className="block w-full border rounded px-2 py-1"
              value={settings.bucketGreenMaxMs}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  bucketGreenMaxMs: parseInt(event.target.value || '300', 10),
                }))
              }
            />
          </label>
          <label>
            Yellow &lt;= (ms)
            <input
              type="number"
              className="block w-full border rounded px-2 py-1"
              value={settings.bucketYellowMaxMs}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  bucketYellowMaxMs: parseInt(event.target.value || '800', 10),
                }))
              }
            />
          </label>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Bars: green &lt;= Green; yellow between Green..Yellow; red &gt; Yellow.
        </p>
      </div>
    </div>
  );
}

