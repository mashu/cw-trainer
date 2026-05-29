export const isFirestorePermissionDenied = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return (
    code === 'permission-denied' ||
    error.message.includes('Missing or insufficient permissions')
  );
};
