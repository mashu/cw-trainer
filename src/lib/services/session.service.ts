import type { SessionRepository, SessionRepositoryContext } from '@/lib/db/repositories';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { sessionResultSchema, type SessionResultInput } from '@/lib/validators';
import type { SessionResult } from '@/types';

const sortSessions = (sessions: readonly SessionResult[]): SessionResult[] =>
  [...sessions].sort((a, b) => a.timestamp - b.timestamp);

export class SessionService {
  constructor(private readonly repository: SessionRepository) {}

  async listSessions(context: SessionRepositoryContext): Promise<SessionResult[]> {
    return this.repository.getAll(context);
  }

  async upsertSession(
    context: SessionRepositoryContext,
    input: SessionResultInput,
  ): Promise<SessionResult[]> {
    const result = sessionResultSchema.safeParse(input);
    if (!result.success) {
      throw new ValidationError('Invalid session payload', result.error.flatten());
    }

    const validated = result.data;
    const existing = await this.repository.getAll(context);
    const byTimestamp = new Map(existing.map((session) => [session.timestamp, session] as const));
    byTimestamp.set(validated.timestamp, validated);

    const nextSessions = sortSessions(Array.from(byTimestamp.values()));
    await this.repository.saveAll(context, nextSessions);
    await this.repository.flushPending(context, nextSessions);
    return nextSessions;
  }

  async replaceAll(
    context: SessionRepositoryContext,
    inputs: readonly SessionResultInput[],
  ): Promise<SessionResult[]> {
    const parsed = inputs.map((input) => {
      const result = sessionResultSchema.safeParse(input);
      if (!result.success) {
        throw new ValidationError('Invalid session payload', result.error.flatten());
      }
      return result.data;
    });

    const nextSessions = sortSessions(parsed);
    await this.repository.saveAll(context, nextSessions);
    await this.repository.flushPending(context, nextSessions);
    return nextSessions;
  }

  async deleteSession(
    context: SessionRepositoryContext,
    timestamp: number,
  ): Promise<SessionResult[]> {
    const existing = await this.repository.getAll(context);
    if (!existing.some((session) => session.timestamp === timestamp)) {
      throw new NotFoundError(`Session with timestamp ${timestamp} was not found.`);
    }

    const remaining = await this.repository.deleteByTimestamp(context, timestamp, existing);
    await this.repository.flushPending(context, remaining);
    return sortSessions(remaining);
  }

  async syncPending(context: SessionRepositoryContext): Promise<SessionResult[]> {
    const sessions = await this.repository.getAll(context);
    await this.repository.flushPending(context, sessions);
    return sortSessions(sessions);
  }
}
