import { isFirestorePermissionDenied } from '@/lib/errors/firebase-errors';

describe('isFirestorePermissionDenied', () => {
  it('detects permission-denied code', () => {
    const error = Object.assign(new Error('Denied'), { code: 'permission-denied' });
    expect(isFirestorePermissionDenied(error)).toBe(true);
  });

  it('detects missing permissions message', () => {
    expect(
      isFirestorePermissionDenied(new Error('Missing or insufficient permissions.')),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isFirestorePermissionDenied(new Error('Network error'))).toBe(false);
    expect(isFirestorePermissionDenied(null)).toBe(false);
  });
});
