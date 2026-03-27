'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { IcrSettings } from '@/types';

/** Tone start delay (ms) and duration (ms) for calibration — same idea as Better-ICR. */
const CALIB_TONE_DELAY_MS = 500;
const CALIB_TONE_DURATION_MS = 100;
const CALIB_RECORD_MS = 1500;
const CALIB_LATENCY_MIN_MS = 0;
const CALIB_LATENCY_MAX_MS = 2000;

interface ICRSettingsFormProps {
  settings: IcrSettings;
  setSettings: React.Dispatch<React.SetStateAction<IcrSettings>>;
}

function getAnalyserLevel(analyser: AnalyserNode): number {
  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i];
    if (sample === undefined) continue;
    const v = Math.abs(sample - 128) / 128;
    if (v > peak) peak = v;
  }
  return peak;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function ICRSettingsForm({
  settings,
  setSettings,
}: ICRSettingsFormProps): JSX.Element {
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [showBucketsHelp, setShowBucketsHelp] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [previewActive, setPreviewActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const [holdMs, setHoldMs] = useState(0);

  const [bucketGreenInput, setBucketGreenInput] = useState(() => String(settings.bucketGreenMaxMs));
  const [bucketYellowInput, setBucketYellowInput] = useState(() => String(settings.bucketYellowMaxMs));
  const [bucketOrangeInput, setBucketOrangeInput] = useState(() => String(settings.bucketOrangeMaxMs));
  const bucketGreenFocusedRef = useRef(false);
  const bucketYellowFocusedRef = useRef(false);
  const bucketOrangeFocusedRef = useRef(false);

  const stopMicPreview = useCallback((): void => {
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
  }, []);

  const enumerateAudioInputs = useCallback(async (): Promise<void> => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devices.filter((device) => device.kind === 'audioinput'));
    } catch {
      // ignore errors enumerating devices
    }
  }, []);

  const startMicPreview = useCallback(async (): Promise<void> => {
    try {
      stopMicPreview();
      const constraints: MediaStreamConstraints = {
        audio: settings.micDeviceId ? { deviceId: { ideal: settings.micDeviceId } } : true,
        video: false,
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        if (settings.micDeviceId) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setSettings((prev) => {
            const { micDeviceId: _omit, ...rest } = prev;
            return rest as IcrSettings;
          });
        } else {
          throw firstErr;
        }
      }
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      micCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      setPreviewActive(true);
      holdStartRef.current = null;
      await enumerateAudioInputs();

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
  }, [settings.micDeviceId, settings.vadThreshold, setSettings, enumerateAudioInputs, stopMicPreview]);

  const runCalibration = useCallback(async (): Promise<void> => {
    const ctx = micCtxRef.current;
    const analyser = micAnalyserRef.current;
    if (!ctx || !analyser) {
      setCalibrationError('Start mic preview first.');
      return;
    }
    setCalibrationError(null);
    setCalibrating(true);
    try {
      await ctx.resume();
      const baseTime = Date.now();
      const toneStartSec = CALIB_TONE_DELAY_MS / 1000;
      const toneDurSec = CALIB_TONE_DURATION_MS / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + toneStartSec);
      gain.gain.setValueAtTime(0, ctx.currentTime + toneStartSec + toneDurSec);
      osc.start(ctx.currentTime + toneStartSec);
      osc.stop(ctx.currentTime + toneStartSec + toneDurSec + 0.05);

      type Sample = { t: number; level: number };
      const samples: Sample[] = [];

      await new Promise<void>((resolve) => {
        const endAt = baseTime + CALIB_RECORD_MS;
        const tick = (): void => {
          const now = Date.now();
          if (now >= endAt) {
            resolve();
            return;
          }
          samples.push({ t: now - baseTime, level: getAnalyserLevel(analyser) });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      const maxLevel = samples.length > 0 ? Math.max(...samples.map((s) => s.level)) : 0;
      const maxLevelPct = Math.round(maxLevel * 100);
      const quietMedian =
        samples.filter((s) => s.t < CALIB_TONE_DELAY_MS - 50).length > 0
          ? median(samples.filter((s) => s.t < CALIB_TONE_DELAY_MS - 50).map((s) => s.level))
          : 0;
      const threshold = Math.max(0.01, Math.min(0.05, quietMedian + 0.02));
      const toneWindowStart = CALIB_TONE_DELAY_MS - 50;
      const toneWindowEnd = CALIB_TONE_DELAY_MS + 400;
      const firstAbove = samples.find(
        (s) => s.t >= toneWindowStart && s.t <= toneWindowEnd && s.level >= threshold,
      );
      const firstSignalMs = firstAbove?.t ?? -1;
      const latencyMs = firstSignalMs >= 0 ? firstSignalMs - CALIB_TONE_DELAY_MS : -1;

      if (latencyMs < CALIB_LATENCY_MIN_MS || latencyMs > CALIB_LATENCY_MAX_MS) {
        setCalibrationError(
          latencyMs < 0
            ? `No signal detected (max level: ${maxLevelPct}%). Use speaker (not headphones), increase system volume, and ensure the mic can hear the speaker. If the bar above does not move when the tone plays, check output device.`
            : `Latency ${Math.round(latencyMs)} ms out of range. Check speaker/mic setup.`,
        );
        setSettings((prev) => ({ ...prev, calibrationLatencyMs: null }));
        return;
      }
      const rounded = Math.round(latencyMs);
      setSettings((prev) => ({ ...prev, calibrationLatencyMs: rounded }));
      setCalibrationError(null);
    } catch (e) {
      console.error('[ICRSettingsForm] Calibration failed', e);
      setCalibrationError('Calibration failed. Try again.');
      setSettings((prev) => ({ ...prev, calibrationLatencyMs: null }));
    } finally {
      setCalibrating(false);
    }
  }, [setSettings]);

  /** One-click: start preview if needed, estimate threshold & hold from quiet room, then run speaker–mic calibration. */
  const runAutoCalibrate = useCallback(async (): Promise<void> => {
    setCalibrationError(null);
    try {
      if (!previewActive) {
        await startMicPreview();
        await new Promise((r) => setTimeout(r, 800));
      }
      const analyser = micAnalyserRef.current;
      if (!analyser) {
        setCalibrationError('Mic preview failed. Allow microphone access and try again.');
        return;
      }
      setCalibrating(true);
      const quietSamples: number[] = [];
      const quietMs = 600;
      const started = Date.now();
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          if (Date.now() - started >= quietMs) {
            resolve();
            return;
          }
          quietSamples.push(getAnalyserLevel(analyser));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const quietMedian =
        quietSamples.length > 0 ? median(quietSamples) : 0.02;
      const suggestedThreshold = Math.max(0.02, Math.min(0.4, quietMedian + 0.05));
      const suggestedHold = 80;
      setSettings((prev) => ({
        ...prev,
        vadThreshold: Math.round(suggestedThreshold * 100) / 100,
        vadHoldMs: suggestedHold,
      }));
      await runCalibration();
    } catch (e) {
      console.error('[ICRSettingsForm] Auto-calibrate failed', e);
      setCalibrationError('Auto-calibrate failed. Start preview manually and try again.');
    } finally {
      setCalibrating(false);
    }
  }, [previewActive, setSettings, runCalibration, startMicPreview]);

  useEffect(() => {
    void enumerateAudioInputs();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', enumerateAudioInputs);
      return (): void => {
        navigator.mediaDevices.removeEventListener('devicechange', enumerateAudioInputs);
        stopMicPreview();
      };
    }
    return undefined;
  }, [enumerateAudioInputs, stopMicPreview]);

  useEffect(() => {
    return (): void => {
      stopMicPreview();
    };
  }, [stopMicPreview]);

  const syncBucketInputsFromSettings = useCallback(() => {
    if (!bucketGreenFocusedRef.current) setBucketGreenInput(String(settings.bucketGreenMaxMs));
    if (!bucketYellowFocusedRef.current) setBucketYellowInput(String(settings.bucketYellowMaxMs));
    if (!bucketOrangeFocusedRef.current) setBucketOrangeInput(String(settings.bucketOrangeMaxMs));
  }, [settings.bucketGreenMaxMs, settings.bucketYellowMaxMs, settings.bucketOrangeMaxMs]);

  useEffect(() => {
    syncBucketInputsFromSettings();
  }, [syncBucketInputsFromSettings]);

  const commitBucketGreen = useCallback((): void => {
    bucketGreenFocusedRef.current = false;
    const n = parseInt(bucketGreenInput.trim(), 10);
    if (!Number.isNaN(n) && n >= 1) {
      setSettings((prev) => ({ ...prev, bucketGreenMaxMs: n }));
      setBucketGreenInput(String(n));
    } else {
      setBucketGreenInput(String(settings.bucketGreenMaxMs));
    }
  }, [bucketGreenInput, settings.bucketGreenMaxMs, setSettings]);

  const commitBucketYellow = useCallback((): void => {
    bucketYellowFocusedRef.current = false;
    const n = parseInt(bucketYellowInput.trim(), 10);
    if (!Number.isNaN(n) && n >= 1) {
      setSettings((prev) => ({ ...prev, bucketYellowMaxMs: n }));
      setBucketYellowInput(String(n));
    } else {
      setBucketYellowInput(String(settings.bucketYellowMaxMs));
    }
  }, [bucketYellowInput, settings.bucketYellowMaxMs, setSettings]);

  const commitBucketOrange = useCallback((): void => {
    bucketOrangeFocusedRef.current = false;
    const n = parseInt(bucketOrangeInput.trim(), 10);
    if (!Number.isNaN(n) && n >= 1) {
      setSettings((prev) => ({ ...prev, bucketOrangeMaxMs: n }));
      setBucketOrangeInput(String(n));
    } else {
      setBucketOrangeInput(String(settings.bucketOrangeMaxMs));
    }
  }, [bucketOrangeInput, settings.bucketOrangeMaxMs, setSettings]);

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
            className="w-full border rounded px-2 py-1 bg-white"
            value={settings.micDeviceId || ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                ...(event.target.value ? { micDeviceId: event.target.value } : {}),
              })
            }
            aria-label="Select microphone"
          >
            <option value="">System default</option>
            {micDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          {micDevices.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Allow microphone access and start preview to see devices.
            </p>
          )}
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
          While quiet the bar should be low; when saying &quot;TEST&quot; it should spike
          above 60–80% depending on your Threshold.
        </div>

        {/* Speaker–mic calibration (Better-ICR style) */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <h4 className="font-semibold text-slate-800 mb-1 text-sm">Speaker–mic calibration</h4>
          <p className="text-xs text-slate-600 mb-2">
            Use <strong>speaker, not headphones</strong>. <strong>Auto-calibrate</strong> starts the mic, estimates threshold and hold, then measures speaker→mic delay. You can still tune sliders above.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {settings.calibrationLatencyMs != null && settings.calibrationLatencyMs > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-medium">
                <span aria-hidden>✓</span>
                Calibrated: {settings.calibrationLatencyMs} ms
              </span>
            ) : (
              <span className="text-xs text-slate-500">Not calibrated</span>
            )}
            <button
              type="button"
              className="px-3 py-1.5 rounded text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => void runAutoCalibrate()}
              disabled={calibrating}
            >
              {calibrating ? 'Calibrating…' : 'Auto-calibrate'}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded text-sm bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
              onClick={() => void runCalibration()}
              disabled={!previewActive || calibrating}
            >
              Re-calibrate only
            </button>
          </div>
          {calibrationError && (
            <p className="text-xs text-rose-600 mt-2" role="alert">
              {calibrationError}
            </p>
          )}
        </div>
      </div>

      {/* Performance Buckets */}
      <div className="p-3 border rounded bg-white">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-800 text-sm">Performance Buckets</h4>
          <button
            type="button"
            onClick={() => setShowBucketsHelp((v) => !v)}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold border transition-colors ${
              showBucketsHelp
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="What are performance buckets?"
            aria-expanded={showBucketsHelp}
            aria-label="Performance buckets help"
          >
            ?
          </button>
        </div>
        {showBucketsHelp && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
            <div className="font-semibold text-slate-800 mb-1">Reaction time buckets (ms)</div>
            <p className="mb-2">Bars and reaction times are colored by your reaction speed. Each value is the maximum ms for that band (reaction ≤ value).</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><strong>Green</strong>: fastest (e.g. &lt; 400 ms).</li>
              <li><strong>Yellow (ICR)</strong>: instant character recognition level (e.g. 400–600 ms).</li>
              <li><strong>Orange</strong>: acceptable (e.g. 600–800 ms).</li>
              <li><strong>Red</strong>: above the orange threshold (e.g. &gt; 800 ms).</li>
            </ul>
            <p className="mt-2 text-slate-600">Keep Green ≤ Yellow ≤ Orange. Defaults: 400, 600, 800 ms.</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-sm items-end">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-700">Green</span>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              placeholder="400"
              min={1}
              step={50}
              value={bucketGreenInput}
              onFocus={() => { bucketGreenFocusedRef.current = true; }}
              onBlur={commitBucketGreen}
              onChange={(e) => setBucketGreenInput(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-700">Yellow</span>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              placeholder="600"
              min={1}
              step={50}
              value={bucketYellowInput}
              onFocus={() => { bucketYellowFocusedRef.current = true; }}
              onBlur={commitBucketYellow}
              onChange={(e) => setBucketYellowInput(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-700">Orange</span>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              placeholder="800"
              min={1}
              step={50}
              value={bucketOrangeInput}
              onFocus={() => { bucketOrangeFocusedRef.current = true; }}
              onBlur={commitBucketOrange}
              onChange={(e) => setBucketOrangeInput(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500 mt-1">Thresholds in ms (Green ≤ Yellow ≤ Orange).</p>
      </div>
    </div>
  );
}

