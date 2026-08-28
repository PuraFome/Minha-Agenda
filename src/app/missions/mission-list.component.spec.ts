import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MissionListComponent } from './mission-list.component';
import { MissionFormComponent } from './mission-form.component';
import { MissionService, PendingMissionRow } from '../game/mission.service';
import { SettingsService } from '../game/settings.service';
import { Mission } from '../game/game.types';
import { TabernaService } from '../taberna/taberna.service';
import { signal, Signal } from '@angular/core';
import { vi } from 'vitest';

describe('MissionListComponent', () => {
  let component: MissionListComponent;
  let fixture: ComponentFixture<MissionListComponent>;
  let missionServiceSpy: {
    addMission: ReturnType<typeof vi.fn>;
    editMission: ReturnType<typeof vi.fn>;
    completeMission: ReturnType<typeof vi.fn>;
    undoCompleteMission: ReturnType<typeof vi.fn>;
    deleteMission: ReturnType<typeof vi.fn>;
    pendingTasks: ReturnType<typeof signal>;
    completedTasks: ReturnType<typeof signal>;
    tasks: Signal<Mission[]>;
  };
  let tabernaServiceSpy: {
    recordCompletion: ReturnType<typeof vi.fn>;
    repeatMission: ReturnType<typeof vi.fn>;
    levelOf: ReturnType<typeof vi.fn>;
    isUnlocked: ReturnType<typeof vi.fn>;
    isAcceptedPending: ReturnType<typeof vi.fn>;
  };
  let settingsServiceSpy: {
    retentionDays: ReturnType<typeof signal>;
  };

  const pendingRows: PendingMissionRow[] = [
    {
      task: {
        id: 'p1',
        title: 'Overdue task',
        difficulty: 'facil',
        dueDate: '2026-08-01',
        completed: false,
        completedAt: null,
      },
      overdue: true,
    },
    {
      task: {
        id: 'p2',
        title: 'Future task',
        difficulty: 'epica',
        dueDate: '2026-09-01',
        completed: false,
        completedAt: null,
      },
      overdue: false,
    },
    {
      task: {
        id: 'p3',
        title: 'No date task',
        difficulty: 'media',
        dueDate: null,
        completed: false,
        completedAt: null,
      },
      overdue: false,
    },
  ];

  const completedTasks: Mission[] = [
    {
      id: 'c1',
      title: 'Done task',
      difficulty: 'dificil',
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
      tasks: signal<Mission[]>([...pendingRows.map((r) => r.task), ...completedTasks]),
    };
    tabernaServiceSpy = {
      recordCompletion: vi.fn(),
      repeatMission: vi.fn(),
      levelOf: vi.fn(() => 0),
      isUnlocked: vi.fn(() => true),
      isAcceptedPending: vi.fn(() => false),
    };
    settingsServiceSpy = {
      retentionDays: signal(0),
    };

    await TestBed.configureTestingModule({
      imports: [MissionListComponent],
      providers: [
        { provide: MissionService, useValue: missionServiceSpy },
        { provide: TabernaService, useValue: tabernaServiceSpy },
        { provide: SettingsService, useValue: settingsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MissionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render pending and completed sections', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#pending-title')?.textContent).toContain('Pendentes');
    expect(compiled.querySelector('#completed-title')?.textContent).toContain('Concluídas');
    expect(compiled.textContent).toContain('Overdue task');
    expect(compiled.textContent).toContain('Done task');
  });

  it('should render pending rows in the order provided by the service', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const titles = Array.from(compiled.querySelectorAll('.mission-list__item-title')).map(
      (el) => el.textContent,
    );
    expect(titles[0]).toContain('Overdue task');
    expect(titles[1]).toContain('Future task');
    expect(titles[2]).toContain('No date task');
    expect(titles[3]).toContain('Done task');
  });

  it('should render difficulty badges with XP labels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const badges = compiled.querySelectorAll('.mission-list__badge');
    expect(badges[0].textContent).toContain('Fácil');
    expect(badges[0].textContent).toContain('+10 XP');
    expect(badges[1].textContent).toContain('Épica');
    expect(badges[1].textContent).toContain('+100 XP');
    expect(badges[3].textContent).toContain('Difícil');
    expect(badges[3].textContent).toContain('+35 XP');
  });

  it('should apply difficulty badge color class', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const badges = compiled.querySelectorAll('.mission-list__badge');
    expect(badges[0].classList.contains('mission-list__badge--facil')).toBe(true);
    expect(badges[1].classList.contains('mission-list__badge--epica')).toBe(true);
    expect(badges[2].classList.contains('mission-list__badge--media')).toBe(true);
    expect(badges[3].classList.contains('mission-list__badge--dificil')).toBe(true);
  });

  it('should mark overdue task with overdue class and tag', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.mission-list__item');
    expect(items[0].classList.contains('mission-list__item--overdue')).toBe(true);
    expect(items[0].textContent).toContain('Atrasada');
    expect(items[1].classList.contains('mission-list__item--overdue')).toBe(false);
  });

  it('should format due dates as DD/MM/YYYY', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('01/08/2026');
    expect(compiled.textContent).toContain('01/09/2026');
  });

  it('should call completeMission when complete button clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const completeBtn = compiled.querySelector(
      '.mission-list__action-btn--complete',
    ) as HTMLButtonElement;
    completeBtn.click();

    expect(missionServiceSpy.completeMission).toHaveBeenCalledWith('p1');
  });

  it('should call undoCompleteMission when undo button clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const undoBtn = compiled.querySelector('.mission-list__action-btn--undo') as HTMLButtonElement;
    undoBtn.click();

    expect(missionServiceSpy.undoCompleteMission).toHaveBeenCalledWith('c1');
  });

  it('should call deleteMission when delete button clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const deleteBtns = compiled.querySelectorAll('.mission-list__action-btn--danger');
    (deleteBtns[0] as HTMLButtonElement).click();

    expect(missionServiceSpy.deleteMission).toHaveBeenCalledWith('p1');
  });

  it('should show edit button only on pending tasks', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.mission-list__item');
    expect(items[0].querySelectorAll('.mission-list__action-btn--edit').length).toBe(1);
    expect(items[3].querySelectorAll('.mission-list__action-btn--edit').length).toBe(0);
  });

  it('should show empty state when no pending tasks', () => {
    missionServiceSpy.pendingTasks.set([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.mission-list__empty')?.textContent).toContain(
      'Nenhuma missão pendente',
    );
  });

  it('should show empty state when no completed tasks', () => {
    missionServiceSpy.completedTasks.set([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const empties = compiled.querySelectorAll('.mission-list__empty');
    expect(empties.length).toBe(1);
  });

  it('should render only pending section when section input is pending', () => {
    fixture.componentRef.setInput('section', 'pending');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#pending-title')).toBeTruthy();
    expect(compiled.querySelector('#completed-title')).toBeNull();
  });

  it('should render only completed section when section input is completed', () => {
    fixture.componentRef.setInput('section', 'completed');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#pending-title')).toBeNull();
    expect(compiled.querySelector('#completed-title')).toBeTruthy();
  });

  it('should show retention hint when retentionDays > 0 and mission has completedAt', () => {
    settingsServiceSpy.retentionDays = signal(7);
    fixture.destroy();
    fixture = TestBed.createComponent(MissionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.mission-list__retention-hint')?.textContent).toContain(
      'será arquivada em 7 dias',
    );
  });

  it('should not show retention hint when retentionDays is 0', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.mission-list__retention-hint')).toBeNull();
  });

  it('should not show retention hint for completed mission without completedAt', () => {
    missionServiceSpy.completedTasks = signal([
      { ...completedTasks[0], completedAt: null },
    ]);
    settingsServiceSpy.retentionDays = signal(7);
    fixture.destroy();
    fixture = TestBed.createComponent(MissionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.mission-list__retention-hint')).toBeNull();
  });

  it('should open create form on new mission button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const newBtn = compiled.querySelector('.mission-list__new-btn') as HTMLButtonElement;
    newBtn.click();
    fixture.detectChanges();

    expect(component.showForm()).toBe(true);
    expect(component.editingMission()).toBe(null);
    expect(compiled.querySelector('app-mission-form')).toBeTruthy();
  });

  it('should open edit form with the selected mission', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const editBtn = compiled.querySelector('.mission-list__action-btn--edit') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    expect(component.showForm()).toBe(true);
    expect(component.editingMission()?.id).toBe('p1');
  });

  it('should close form when saved event fires', () => {
    component.startCreate();
    fixture.detectChanges();

    const formDebug = fixture.debugElement.query(By.directive(MissionFormComponent));
    expect(formDebug).toBeTruthy();
    formDebug.componentInstance.saved.emit();
    fixture.detectChanges();

    expect(component.showForm()).toBe(false);
    expect(component.editingMission()).toBe(null);
  });

  describe('NPC integration', () => {
    const npcMission: Mission = {
      id: 'pnpc',
      title: 'NPC mission',
      difficulty: 'facil',
      dueDate: null,
      completed: false,
      completedAt: null,
      source: 'npc',
      npcId: 'dona-arruma',
      npcName: 'Dona Arruma',
      npcAvatar: '🧹',
    };

    it('should render npc badge for a pending npc mission', () => {
      missionServiceSpy.pendingTasks.set([{ task: npcMission, overdue: false }]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badge = compiled.querySelector('.mission-list__npc-badge');
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toContain('🧹');
      expect(badge?.textContent).toContain('Dona Arruma');
    });

    it('should not render edit button for an npc mission', () => {
      missionServiceSpy.pendingTasks.set([{ task: npcMission, overdue: false }]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const items = compiled.querySelectorAll('.mission-list__item');
      expect(items[0].querySelectorAll('.mission-list__action-btn--edit').length).toBe(0);
    });

    it('should record npc completion and open congrats dialog on completeMission for npc mission', () => {
      missionServiceSpy.tasks = signal([npcMission]);
      fixture.detectChanges();

      component.completeMission('pnpc');

      expect(missionServiceSpy.completeMission).toHaveBeenCalledWith('pnpc');
      expect(tabernaServiceSpy.recordCompletion).toHaveBeenCalledWith('dona-arruma');
      expect(component.showNpcDialog()?.npc.id).toBe('dona-arruma');
      expect(component.showNpcDialog()?.mission.id).toBe('pnpc');

      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('app-npc-dialog')).toBeTruthy();
    });

    it('should call repeatMission and clear dialog on onNpcRepeat', () => {
      missionServiceSpy.tasks = signal([npcMission]);
      fixture.detectChanges();
      component.completeMission('pnpc');
      expect(component.showNpcDialog()).not.toBeNull();

      component.onNpcRepeat();

      expect(tabernaServiceSpy.repeatMission).toHaveBeenCalledWith(npcMission);
      expect(component.showNpcDialog()).toBeNull();
    });
  });
});