import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockLocalStorage: Record<string, string>;
  let mockDocument: Document;

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

    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: DOCUMENT, useValue: mockDocument }],
    });

    service = TestBed.inject(SettingsService);
  });

  it('should default retentionDays to 0', () => {
    expect(service.retentionDays()).toBe(0);
  });

  it('should set retentionDays and persist as ma.settings.v1', () => {
    service.setRetentionDays(7);

    expect(service.retentionDays()).toBe(7);
    expect(JSON.parse(mockLocalStorage['ma.settings.v1']!)).toEqual({ retentionDays: 7 });
  });

  it('should clamp negative values to 0', () => {
    service.setRetentionDays(-5);

    expect(service.retentionDays()).toBe(0);
  });

  it('should floor fractional values to an integer', () => {
    service.setRetentionDays(7.9);

    expect(service.retentionDays()).toBe(7);
  });

  it('should hydrate retentionDays from localStorage', () => {
    mockLocalStorage['ma.settings.v1'] = JSON.stringify({ retentionDays: 30 });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: DOCUMENT, useValue: mockDocument }],
    });

    const hydrated = TestBed.inject(SettingsService);
    expect(hydrated.retentionDays()).toBe(30);
  });

  it('should handle corrupted localStorage gracefully', () => {
    mockLocalStorage['ma.settings.v1'] = 'not json';

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: DOCUMENT, useValue: mockDocument }],
    });

    const hydrated = TestBed.inject(SettingsService);
    expect(hydrated.retentionDays()).toBe(0);
  });

  it('should handle unavailable localStorage gracefully', () => {
    TestBed.resetTestingModule();
    const brokenDocument = {
      defaultView: {
        localStorage: {
          getItem: () => {
            throw new Error('localStorage unavailable');
          },
        },
      },
    } as unknown as Document;

    TestBed.configureTestingModule({
      providers: [SettingsService, { provide: DOCUMENT, useValue: brokenDocument }],
    });

    const resilient = TestBed.inject(SettingsService);
    expect(resilient.retentionDays()).toBe(0);
  });
});