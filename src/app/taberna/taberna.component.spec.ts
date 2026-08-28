import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabernaComponent } from './taberna.component';
import { TabernaService } from './taberna.service';
import { NPCS } from './taberna.data';
import { Npc, NpcMissionTemplate } from './taberna.types';
import { vi } from 'vitest';

describe('TabernaComponent', () => {
  let component: TabernaComponent;
  let fixture: ComponentFixture<TabernaComponent>;
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
      imports: [TabernaComponent],
      providers: [{ provide: TabernaService, useValue: tabernaServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(TabernaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render 5 NPC sheets in the grid', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cells = compiled.querySelectorAll('.taberna__cell');
    expect(cells.length).toBe(5);
    cells.forEach((cell) => {
      expect(cell.querySelector('button.sheet')).toBeTruthy();
    });
  });

  it('should open the npc dialog when a sheet is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sheet = compiled.querySelector('button.sheet') as HTMLButtonElement;
    sheet.click();
    fixture.detectChanges();

    expect(component.selectedNpc()).toBe(npc);
    expect(compiled.querySelector('app-npc-dialog')).toBeTruthy();
  });

  it('should call tabernaService.accept with the npc and template on onAccept', () => {
    component.openDialog(npc);
    component.onAccept(template);

    expect(tabernaServiceSpy.accept).toHaveBeenCalledWith(npc, template);
  });
});
