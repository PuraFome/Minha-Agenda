import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { MuralComponent } from './mural.component';
import { MissionService, PendingMissionRow } from '../../game/mission.service';
import { SettingsService } from '../../game/settings.service';

describe('MuralComponent', () => {
  let component: MuralComponent;
  let fixture: ComponentFixture<MuralComponent>;
  let missionServiceSpy: {
    addMission: ReturnType<typeof vi.fn>;
    editMission: ReturnType<typeof vi.fn>;
    completeMission: ReturnType<typeof vi.fn>;
    undoCompleteMission: ReturnType<typeof vi.fn>;
    deleteMission: ReturnType<typeof vi.fn>;
    pendingTasks: ReturnType<typeof signal>;
    completedTasks: ReturnType<typeof signal>;
  };
  let settingsServiceSpy: {
    retentionDays: ReturnType<typeof signal>;
  };

  const pendingRows: PendingMissionRow[] = [
    {
      task: {
        id: 'p1',
        title: 'Missão ativa',
        difficulty: 'facil',
        dueDate: null,
        completed: false,
        completedAt: null,
      },
      overdue: false,
    },
  ];

  const completedTasks = [
    {
      id: 'c1',
      title: 'Missão concluída',
      difficulty: 'media',
      dueDate: null,
      completed: true,
      completedAt: '2026-08-18T10:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    missionServiceSpy = {
      addMission: vi.fn(),
      editMission: vi.fn(),
      completeMission: vi.fn(),
      undoCompleteMission: vi.fn(),
      deleteMission: vi.fn(),
      pendingTasks: signal(pendingRows),
      completedTasks: signal(completedTasks),
    };
    settingsServiceSpy = {
      retentionDays: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [MuralComponent],
      providers: [
        { provide: MissionService, useValue: missionServiceSpy },
        { provide: SettingsService, useValue: settingsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MuralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render tabs with role=tablist and aria-selected', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tablist = compiled.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();

    const tabs = compiled.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('Missões Ativas');
    expect(tabs[1].textContent).toContain('Arquivo');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('should render pending mission-list in the active tab by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-mission-list[section="pending"]')).toBeTruthy();
    expect(compiled.querySelector('app-mission-list[section="completed"]')).toBeNull();
    expect(compiled.textContent).toContain('Missão ativa');
  });

  it('should switch to the completed section when Arquivo tab is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const archiveTab = compiled.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    archiveTab.click();
    fixture.detectChanges();

    expect(compiled.querySelector('app-mission-list[section="pending"]')).toBeNull();
    expect(compiled.querySelector('app-mission-list[section="completed"]')).toBeTruthy();
    expect(compiled.textContent).toContain('Missão concluída');
    expect(compiled.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('should show empty state when there are no pending missions', () => {
    missionServiceSpy.pendingTasks = signal([]);
    fixture.destroy();
    fixture = TestBed.createComponent(MuralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nenhuma missão pendente');
  });

  it('should show empty state when there are no completed missions', () => {
    missionServiceSpy.completedTasks = signal([]);
    fixture.destroy();
    fixture = TestBed.createComponent(MuralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const archiveTab = fixture.nativeElement.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    archiveTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma missão concluída');
  });
});