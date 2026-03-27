import { InstallAppBadge } from './InstallAppBadge';
import { getVersionInfo } from '../../../../lib/version';

export function LegalFooter(): JSX.Element {
  const versionInfo = getVersionInfo();
  const versionDisplay =
    versionInfo.versionType === 'release'
      ? `v${versionInfo.version}`
      : versionInfo.versionType === 'dev'
        ? versionInfo.version
        : 'unknown';

  return (
    <footer
      id="data-notice"
      className="mx-auto w-full max-w-5xl px-4 pb-6 pt-8 text-sm text-gray-600"
    >
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="font-medium text-gray-800">Data, privacy, and liability</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Training settings and history are stored in your browser. Some anonymized stats may be
            processed to enable features like leaderboards.
          </li>
          <li>
            This is an open-source, personal-use project. The author is not a legal expert and
            assumes no legal responsibility for your use.
          </li>
          <li>If you do not agree with these terms, please leave this site.</li>
        </ul>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://github.com/mashu/cw-trainer"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              View on GitHub
            </a>
            <InstallAppBadge />
          </div>
          <div className="text-xs text-gray-500">
            {versionInfo.versionType === 'release' ? (
              <span>Version {versionDisplay}</span>
            ) : versionInfo.versionType === 'dev' ? (
              <span>
                Dev build: <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">{versionDisplay}</code>
              </span>
            ) : (
              <span>Version unknown</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
