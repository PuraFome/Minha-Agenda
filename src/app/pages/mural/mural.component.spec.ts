import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MuralComponent } from './mural.component';
import { SettingsService } from '../../game/settings.service';

describe('MuralComponent', () => {
  let mockSettings: {
    getSettings: ReturnType<typeof vi.fn>;
    putSettings: ReturnType<typeof vi.fn>;
  };
  let injector: Injector;

  function createComponent(): MuralComponent {
    return runInInjectionContext(injector, () => new MuralComponent());
  }

  beforeEach(() => {
    mockSettings = {
      getSettings: vi.fn(() => ({ retentionDays: 0, muralActiveTab: 'pending' })),
      putSettings: vi.fn(),
    };

    injector = Injector.create({
      providers: [
        { provide: SettingsService, useValue: mockSettings },
      ],
    });
  });

  it('should create', () => {
    const component = createComponent();
    expect(component).toBeTruthy();
  });

  it('should initialize activeTab from SettingsService.getSettings()', () => {
    const component = createComponent();
    expect(mockSettings.getSettings).toHaveBeenCalled();
    expect(component.activeTab()).toBe('pending');
  });

  it('should initialize activeTab as completed when settings stored that value', () => {
    mockSettings.getSettings.mockReturnValue({ retentionDays: 0, muralActiveTab: 'completed' });

    const component = createComponent();
    expect(component.activeTab()).toBe('completed');
  });

  it('should default to pending when getSettings returns undefined muralActiveTab', () => {
    mockSettings.getSettings.mockReturnValue({ retentionDays: 0 });

    const component = createComponent();
    expect(component.activeTab()).toBe('pending');
  });

  it('should call settingsService.putSettings when selectTab is triggered', () => {
    const component = createComponent();
    component.selectTab('completed');

    expect(mockSettings.putSettings).toHaveBeenCalledWith({ muralActiveTab: 'completed' });
    expect(component.activeTab()).toBe('completed');
  });

  it('should call settingsService.putSettings with pending when switching back', () => {
    const component = createComponent();
    component.selectTab('completed');
    component.selectTab('pending');

    expect(mockSettings.putSettings).toHaveBeenCalledWith({ muralActiveTab: 'pending' });
    expect(component.activeTab()).toBe('pending');
  });

  it('should not reference ApiService or syncTimer', () => {
    const component = createComponent();
    expect((component as any).api).toBeUndefined();
    expect((component as any).syncTimer).toBeUndefined();
  });
});
