describe('error reporter', () => {
  beforeEach(() => {
    // Fresh module instance per test so the in-memory ring buffer / sink reset.
    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes an Error and records source/code/timestamp', async () => {
    const { reportError } = await import('@/lib/errors/reporter');
    const report = reportError(new Error('boom'), { source: 'window' });

    expect(report.message).toBe('boom');
    expect(report.source).toBe('window');
    expect(report.code).toBe('INTERNAL_ERROR');
    expect(typeof report.timestamp).toBe('number');
  });

  it('defaults source to manual when not provided', async () => {
    const { reportError } = await import('@/lib/errors/reporter');
    expect(reportError(new Error('x')).source).toBe('manual');
  });

  it('caps the ring buffer at 50 entries (most recent kept)', async () => {
    const { reportError, getRecentErrors } = await import('@/lib/errors/reporter');
    for (let i = 0; i < 60; i++) {
      reportError(new Error(`err-${i}`));
    }
    const recent = getRecentErrors();
    expect(recent).toHaveLength(50);
    expect(recent[recent.length - 1]?.message).toBe('err-59');
    expect(recent[0]?.message).toBe('err-10');
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { reportError, subscribeToErrors } = await import('@/lib/errors/reporter');
    const subscriber = jest.fn();
    const unsubscribe = subscribeToErrors(subscriber);

    reportError(new Error('first'));
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
    reportError(new Error('second'));
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('invokes the remote sink when set, and not after cleared', async () => {
    const { reportError, setRemoteErrorSink } = await import('@/lib/errors/reporter');
    const sink = jest.fn();
    setRemoteErrorSink(sink);

    reportError(new Error('remote'));
    expect(sink).toHaveBeenCalledTimes(1);

    setRemoteErrorSink(null);
    reportError(new Error('local-only'));
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('never throws when a subscriber or sink throws', async () => {
    const { reportError, subscribeToErrors, setRemoteErrorSink } = await import(
      '@/lib/errors/reporter'
    );
    subscribeToErrors(() => {
      throw new Error('subscriber boom');
    });
    setRemoteErrorSink(() => {
      throw new Error('sink boom');
    });

    expect(() => reportError(new Error('safe'))).not.toThrow();
  });

  it('drains the pre-hydration window error queue', async () => {
    (window as unknown as { __cwErrorQueue?: unknown[] }).__cwErrorQueue = [
      { message: 'queued-1', source: 'window' },
      { message: 'queued-2', source: 'unhandledrejection' },
    ];

    const { drainPendingWindowErrors, getRecentErrors } = await import('@/lib/errors/reporter');
    drainPendingWindowErrors();

    const recent = getRecentErrors();
    expect(recent.map((r) => r.message)).toEqual(['queued-1', 'queued-2']);
    expect(recent[1]?.source).toBe('unhandledrejection');
    expect((window as unknown as { __cwErrorQueue?: unknown[] }).__cwErrorQueue).toHaveLength(0);
  });
});
