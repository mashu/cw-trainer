import { describe, expect, it } from '@jest/globals';

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ensureAppError,
} from '@/lib/errors';

describe('AppError', () => {
  it('creates error with all properties', () => {
    const error = new AppError('Test message', 400, 'TEST_ERROR', { expose: true });

    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.expose).toBe(true);
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('defaults expose to true for status codes < 500', () => {
    const error = new AppError('Test', 400, 'TEST_ERROR');
    expect(error.expose).toBe(true);
  });

  it('defaults expose to false for status codes >= 500', () => {
    const error = new AppError('Test', 500, 'TEST_ERROR');
    expect(error.expose).toBe(false);
  });

  it('accepts cause option', () => {
    const cause = new Error('Original error');
    const error = new AppError('Test', 500, 'TEST_ERROR', { cause });

    expect(error.cause).toBe(cause);
  });

  it('maintains prototype chain', () => {
    const error = new AppError('Test', 400, 'TEST_ERROR');
    expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
  });
});

describe('ValidationError', () => {
  it('creates validation error with correct defaults', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.expose).toBe(true);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(AppError);
  });

  it('accepts optional details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new ValidationError('Invalid input', details);

    expect(error.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('creates not found error with correct defaults', () => {
    const error = new NotFoundError('Resource not found');

    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.expose).toBe(true);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('UnauthorizedError', () => {
  it('creates unauthorized error with correct defaults', () => {
    const error = new UnauthorizedError('Not authorized');

    expect(error.message).toBe('Not authorized');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.expose).toBe(true);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('creates forbidden error with correct defaults', () => {
    const error = new ForbiddenError('Access forbidden');

    expect(error.message).toBe('Access forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.expose).toBe(true);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ConflictError', () => {
  it('creates conflict error with correct defaults', () => {
    const error = new ConflictError('Resource conflict');

    expect(error.message).toBe('Resource conflict');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.expose).toBe(true);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ensureAppError', () => {
  it('returns AppError instance unchanged', () => {
    const appError = new AppError('Test', 400, 'TEST_ERROR');
    const result = ensureAppError(appError);

    expect(result).toBe(appError);
    expect(result).toBeInstanceOf(AppError);
  });

  it('wraps Error instance in AppError', () => {
    const error = new Error('Original error');
    const result = ensureAppError(error);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Original error');
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.expose).toBe(false);
    expect(result.cause).toBe(error);
  });

  it('handles unknown error types', () => {
    const unknownError = { some: 'object' };
    const result = ensureAppError(unknownError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Unknown error');
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.expose).toBe(false);
  });

  it('handles null/undefined', () => {
    const result1 = ensureAppError(null);
    const result2 = ensureAppError(undefined);

    expect(result1).toBeInstanceOf(AppError);
    expect(result1.message).toBe('Unknown error');
    expect(result2).toBeInstanceOf(AppError);
    expect(result2.message).toBe('Unknown error');
  });

  it('handles string errors', () => {
    const result = ensureAppError('String error');

    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe('Unknown error');
    expect(result.statusCode).toBe(500);
  });
});

