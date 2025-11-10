import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type { TrainingSettings, AppUser } from '@/types';
import { FirebaseTrainingSettingsRepository } from '@/lib/db/repositories/training-settings.repository';
import type { TrainingSettingsRepositoryContext } from '@/lib/db/repositories/training-settings.repository';

describe('FirebaseTrainingSettingsRepository', () => {
  let repository: FirebaseTrainingSettingsRepository;
  const originalLocalStorage = global.localStorage;
  const originalWindow = global.window;

  beforeEach(() => {
    repository = new FirebaseTrainingSettingsRepository();
    // Mock localStorage
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    } as Storage;
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    global.window = originalWindow;
  });

  const user: AppUser = { id: 'user-123', email: 'user@example.com', provider: 'google' };
  const anonymousContext: TrainingSettingsRepositoryContext = {
    firebase: undefined,
    user: null,
  };
  const userContext: TrainingSettingsRepositoryContext = {
    firebase: undefined,
    user,
  };

  describe('load', () => {
    it('returns fallback when no data exists', async () => {
      const settings = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(settings).toEqual(DEFAULT_TRAINING_SETTINGS);
    });

    it('loads from localStorage for anonymous user', async () => {
      const customSettings: TrainingSettings = {
        ...DEFAULT_TRAINING_SETTINGS,
        charWpm: 25,
      };
      await repository.save(anonymousContext, customSettings);

      const loaded = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded.charWpm).toBe(25);
    });

    it('loads from localStorage for authenticated user with email-based key', async () => {
      const customSettings: TrainingSettings = {
        ...DEFAULT_TRAINING_SETTINGS,
        charWpm: 30,
      };
      await repository.save(userContext, customSettings);

      const loaded = await repository.load(userContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded.charWpm).toBe(30);
      expect(global.localStorage.getItem('morse_settings_local_user@example.com')).toBeTruthy();
    });

    it('handles corrupted localStorage data gracefully', async () => {
      global.localStorage.setItem('morse_settings_local', 'invalid json');
      const settings = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(settings).toEqual(DEFAULT_TRAINING_SETTINGS);
    });

    it('handles localStorage read errors gracefully', async () => {
      const originalGetItem = global.localStorage.getItem;
      global.localStorage.getItem = () => {
        throw new Error('Storage error');
      };

      const settings = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(settings).toEqual(DEFAULT_TRAINING_SETTINGS);
      global.localStorage.getItem = originalGetItem;
    });
  });

  describe('save', () => {
    it('saves settings to localStorage for anonymous user', async () => {
      const customSettings: TrainingSettings = {
        ...DEFAULT_TRAINING_SETTINGS,
        charWpm: 22,
      };

      await repository.save(anonymousContext, customSettings);

      const loaded = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded.charWpm).toBe(22);
    });

    it('saves settings to localStorage for authenticated user', async () => {
      const customSettings: TrainingSettings = {
        ...DEFAULT_TRAINING_SETTINGS,
        effectiveWpm: 20,
      };

      await repository.save(userContext, customSettings);

      const loaded = await repository.load(userContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded.effectiveWpm).toBe(20);
    });

    it('handles localStorage write failures gracefully', async () => {
      const originalSetItem = global.localStorage.setItem;
      global.localStorage.setItem = () => {
        throw new Error('Quota exceeded');
      };

      const customSettings: TrainingSettings = {
        ...DEFAULT_TRAINING_SETTINGS,
        charWpm: 25,
      };

      // Should not throw
      await expect(repository.save(anonymousContext, customSettings)).resolves.not.toThrow();
      global.localStorage.setItem = originalSetItem;
    });
  });

  describe('clear', () => {
    it('removes settings from localStorage for anonymous user', async () => {
      await repository.save(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      await repository.clear(anonymousContext);

      const loaded = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded).toEqual(DEFAULT_TRAINING_SETTINGS);
    });

    it('removes settings from localStorage for authenticated user', async () => {
      await repository.save(userContext, DEFAULT_TRAINING_SETTINGS);
      await repository.clear(userContext);

      const loaded = await repository.load(userContext, DEFAULT_TRAINING_SETTINGS);
      expect(loaded).toEqual(DEFAULT_TRAINING_SETTINGS);
    });

    it('handles localStorage remove errors gracefully', async () => {
      const originalRemoveItem = global.localStorage.removeItem;
      global.localStorage.removeItem = () => {
        throw new Error('Remove error');
      };

      // Should not throw
      await expect(repository.clear(anonymousContext)).resolves.not.toThrow();
      global.localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('SSR compatibility', () => {
    it('handles missing window object gracefully', async () => {
      // @ts-expect-error - intentionally removing window for SSR test
      delete global.window;

      const settings = await repository.load(anonymousContext, DEFAULT_TRAINING_SETTINGS);
      expect(settings).toEqual(DEFAULT_TRAINING_SETTINGS);

      await expect(repository.save(anonymousContext, DEFAULT_TRAINING_SETTINGS)).resolves.not.toThrow();
      await expect(repository.clear(anonymousContext)).resolves.not.toThrow();
    });
  });
});

