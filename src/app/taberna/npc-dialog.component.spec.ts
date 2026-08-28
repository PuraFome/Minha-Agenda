import '@angular/compiler';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NpcDialogComponent } from './npc-dialog.component';
import { TabernaService } from './taberna.service';
import { NPCS } from './taberna.data';
import { Npc, NpcMissionTemplate } from './taberna.types';
import { Mission } from '../game/game.types';
import { vi } from 'vitest';

describe('NpcDialogComponent', () => {
  let component: NpcDialogComponent;
  let fixture: ComponentFixture<NpcDialogComponent>;
  let tabernaServiceSpy: {
    levelOf: ReturnType<typeof vi.fn>;
    isUnlocked: ReturnType<typeof vi.fn>;
    isAcceptedPending: ReturnType<typeof vi.fn>;
    accept: ReturnType<typeof vi.fn>;
    recordCompletion: ReturnType<typeof vi.fn>;
    repeatMission: ReturnType<typeof vi.fn>;
  };

  const npc = NPCS[0];
  const template: NpcMissionTemplate = npc.missions[0];

  function createNpcMission(): Mission {
    return {
      id: 'm-1',
      title: 'Completed NPC mission',
      difficulty: 'facil',
      completed: true,
      completedAt: '2026-08-18T10:00:00.000Z',
      source: 'npc',
      npcId: npc.id,
      npcName: npc.name,
      npcAvatar: npc.avatar,
      templateId: template.templateId,
    };
  }

  beforeEach(async () => {
    tabernaServiceSpy = {
      levelOf: vi.fn(() => 0),
      isUnlocked: vi.fn(() => true),
      isAcceptedPending: vi.fn(() => false),
      accept: vi.fn(),
      recordCompletion: vi.fn(),
      repeatMission: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NpcDialogComponent],
      providers: [{ provide: TabernaService, useValue: tabernaServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(NpcDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('npc', npc);
    fixture.componentRef.setInput('mode', 'suggest');
    fixture.detectChanges();
  });

  /** Avança a datilografia do diálogo e renderiza. */
  function flushTyping(): void {
    tick(6000);
    fixture.detectChanges();
  }

  /** Clica na primeira resposta do enredo até chegar à sugestão de missão. */
  function reachSuggestion(): void {
    flushTyping();
    let guard = 0;
    while (guard++ < 12) {
      const choice = fixture.nativeElement.querySelector(
        '.choice:not(.choice--more)',
      ) as HTMLButtonElement | null;
      if (!choice) {
        break;
      }
      choice.click();
      fixture.detectChanges();
      flushTyping();
    }
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reach the mission suggestion and emit accept with an npc mission', fakeAsync(() => {
    const acceptSpy = vi.fn();
    component.accept.subscribe(acceptSpy);

    reachSuggestion();

    const acceptBtn = fixture.nativeElement.querySelector(
      'button.btn--accept',
    ) as HTMLButtonElement | null;
    expect(acceptBtn).toBeTruthy();
    acceptBtn!.click();
    fixture.detectChanges();

    expect(acceptSpy).toHaveBeenCalledTimes(1);
    const accepted = acceptSpy.mock.calls[0][0] as NpcMissionTemplate;
    expect(npc.missions).toContain(accepted);
  }));

  it('should render .btn--locked for a locked mission in the full list and not emit accept', fakeAsync(() => {
    tabernaServiceSpy.isUnlocked.mockImplementation(
      (_npcId: string, t: NpcMissionTemplate) => t.templateId !== template.templateId,
    );
    fixture.componentRef.setInput('npc', { ...npc, missions: [...npc.missions] });
    fixture.detectChanges();

    reachSuggestion();

    const moreBtn = fixture.nativeElement.querySelector(
      'button.choice--more',
    ) as HTMLButtonElement | null;
    expect(moreBtn).toBeTruthy();
    moreBtn!.click();
    fixture.detectChanges();

    const acceptSpy = vi.fn();
    component.accept.subscribe(acceptSpy);

    const lockedBtn = fixture.nativeElement.querySelector(
      'button.btn--locked',
    ) as HTMLButtonElement | null;
    expect(lockedBtn).toBeTruthy();
    expect(lockedBtn!.disabled).toBe(true);
    expect(lockedBtn!.textContent).toContain('Bloqueado');
    lockedBtn!.click();
    fixture.detectChanges();

    expect(acceptSpy).not.toHaveBeenCalled();
  }));

  it('should emit repeat with the mission when "Repetir amanhã" is clicked (congrats mode)', () => {
    const mission = createNpcMission();
    fixture.componentRef.setInput('mode', 'congrats');
    fixture.componentRef.setInput('mission', mission);
    fixture.detectChanges();

    const repeatSpy = vi.fn();
    component.repeat.subscribe(repeatSpy);

    const repeatBtn = fixture.nativeElement.querySelector(
      'button.btn--accept',
    ) as HTMLButtonElement;
    expect(repeatBtn).toBeTruthy();
    expect(repeatBtn.textContent).toContain('Repetir amanhã');
    repeatBtn.click();

    expect(repeatSpy).toHaveBeenCalledWith(mission);
  });

  it('should emit close when "Agora não" is clicked (congrats mode)', () => {
    const mission = createNpcMission();
    fixture.componentRef.setInput('mode', 'congrats');
    fixture.componentRef.setInput('mission', mission);
    fixture.detectChanges();

    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    const ghostBtn = fixture.nativeElement.querySelector(
      'button.btn--ghost',
    ) as HTMLButtonElement;
    expect(ghostBtn).toBeTruthy();
    expect(ghostBtn.textContent).toContain('Agora não');
    ghostBtn.click();

    expect(closeSpy).toHaveBeenCalled();
  });
});
