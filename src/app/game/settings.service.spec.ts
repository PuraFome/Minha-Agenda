import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SettingsService } from './settings.service';
import { ApiService } from '../core/api.service';

interface MockObservable {
  subscribe: (handlers: {
    next?: (value: unknown) => void;
    error?: (error: unknown) => void;
  }) => { unsubscribe: () => void };
}

function silentObservable(): MockObservable {
  return { subscribe: () => ({ unsubscribe: () => {} }) };
}

describe('SettingsService', () => {
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;
  let mockApi: { getSettings: ReturnType<typeof vi.fn>; putSettings: ReturnType<typeof vi.fn> };
  let injector: Injector;

  function createService(): SettingsService {
    return runInInjectionContext(injector, () => new SettingsService());
  }

  beforeEach(() => {
    mockLocalStorage = {};

    mockDocument = {
      defaultView: {
        localStorage: {
          getItem: (key: string) => mockLocalStorage[key] ?? null,
          setItem: (key: string, value: string) => {
            mockLocalStorage[key] = value;
          },
          removeItem: (key: string) => {
            delete mockLocalStorage[key];
          },
          clear: () => {
            mockLocalStorage = {};
          },
        },
      },
    } as unknown as Document;

    mockApi = {
      getSettings: vi.fn(() => silentObservable()),
      putSettings: vi.fn(() => silentObservable()),
    };

    injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: HttpClient, useValue: {} },
        { provide: ApiService, useValue: mockApi },
      ],
    });
  });

  it('should default retentionDays to 0 and muralActiveTab to pending', () => {
    const service = createService();

    expect(service.retentionDays()).toBe(0);
    expect(service.muralActiveTab()).toBe('pending');
  });

  it('should set retentionDays and persist both fields as ma.settings.v1', () => {
    const service = createService();
    service.setRetentionDays(7);

    expect(service.retentionDays()).toBe(7);
    expect(JSON.parse(mockLocalStorage['ma.settings.v1']!)).toEqual({
      retentionDays: 7,
      muralActiveTab: 'pending',
    });
    expect(mockApi.putSettings).toHaveBeenCalledWith({ retentionDays: 7 });
  });

  it('should clamp negative values to 0', () => {
    const service = createService();
    service.setRetentionDays(-5);

    expect(service.retentionDays()).toBe(0);
    expect(mockApi.putSettings).toHaveBeenCalledWith({ retentionDays: 0 });
  });

  it('should floor fractional values to an integer', () => {
    const service = createService();
    service.setRetentionDays(7.9);

    expect(service.retentionDays()).toBe(7);
    expect(mockApi.putSettings).toHaveBeenCalledWith({ retentionDays: 7 });
  });

  it('should hydrate retentionDays and muralActiveTab from localStorage', () => {
    mockLocalStorage['ma.settings.v1'] = JSON.stringify({ retentionDays: 30, muralActiveTab: 'completed' });

    const service = createService();
    expect(service.retentionDays()).toBe(30);
    expect(service.muralActiveTab()).toBe('completed');
  });

  it('should handle corrupted localStorage gracefully', () => {
    mockLocalStorage['ma.settings.v1'] = 'not json';

    const service = createService();
    expect(service.retentionDays()).toBe(0);
    expect(service.muralActiveTab()).toBe('pending');
  });

  it('should handle unavailable localStorage gracefully', () => {
    const brokenDocument = {
      defaultView: {
        localStorage: {
          getItem: () => {
            throw new Error('localStorage unavailable');
          },
        },
      },
    } as unknown as Document;

    injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: brokenDocument },
        { provide: HttpClient, useValue: {} },
        { provide: ApiService, useValue: mockApi },
      ],
    });

    const service = createService();
    expect(service.retentionDays()).toBe(0);
    expect(service.muralActiveTab()).toBe('pending');
  });

  it('should hydrate from api.getSettings() and cache both fields', () => {
    mockApi.getSettings.mockReturnValue({
      subscribe: (handlers) => {
        handlers.next?.({ retentionDays: 14, muralActiveTab: 'completed' });
        return { unsubscribe: () => {} };
      },
    });

    const service = createService();
    expect(service.retentionDays()).toBe(14);
    expect(service.muralActiveTab()).toBe('completed');
    expect(JSON.parse(mockLocalStorage['ma.settings.v1']!)).toEqual({
      retentionDays: 14,
      muralActiveTab: 'completed',
    });
  });

  it('should keep local cache when api.getSettings() errors', () => {
    mockLocalStorage['ma.settings.v1'] = JSON.stringify({ retentionDays: 21, muralActiveTab: 'pending' });
    mockApi.getSettings.mockReturnValue({
      subscribe: (handlers) => {
        handlers.error?.(new Error('401'));
        return { unsubscribe: () => {} };
      },
    });

    const service = createService();
    expect(service.retentionDays()).toBe(21);
    expect(service.muralActiveTab()).toBe('pending');
  });

  it('should update muralActiveTab via putSettings and call api.putSettings', () => {
    const service = createService();
    service.putSettings({ muralActiveTab: 'completed' });

    expect(service.muralActiveTab()).toBe('completed');
    expect(service.retentionDays()).toBe(0);
    expect(mockApi.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ muralActiveTab: 'completed', retentionDays: 0 }),
    );
    expect(JSON.parse(mockLocalStorage['ma.settings.v1']!)).toEqual({
      retentionDays: 0,
      muralActiveTab: 'completed',
    });
  });

  it('should merge retentionDays via putSettings and call api.putSettings', () => {
    const service = createService();
    service.putSettings({ retentionDays: 12 });

    expect(service.retentionDays()).toBe(12);
    expect(service.muralActiveTab()).toBe('pending');
    expect(mockApi.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ retentionDays: 12, muralActiveTab: 'pending' }),
    );
  });

  it('getSettings() should return a snapshot of both fields', () => {
    const service = createService();
    service.putSettings({ retentionDays: 9, muralActiveTab: 'completed' });

    expect(service.getSettings()).toEqual({ retentionDays: 9, muralActiveTab: 'completed' });
  });
});
