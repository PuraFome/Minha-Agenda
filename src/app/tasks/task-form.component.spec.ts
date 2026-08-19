import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskFormComponent } from './task-form.component';
import { TaskService } from '../game/task.service';
import { Task } from '../game/game.types';
import { vi } from 'vitest';

describe('TaskFormComponent', () => {
  let component: TaskFormComponent;
  let fixture: ComponentFixture<TaskFormComponent>;
  let taskServiceSpy: {
    addTask: ReturnType<typeof vi.fn>;
    editTask: ReturnType<typeof vi.fn>;
  };

  const existingTask: Task = {
    id: 'task-1',
    title: 'Existing task',
    difficulty: 'dificil',
    dueDate: '2026-08-20',
    completed: false,
    completedAt: null,
  };

  beforeEach(async () => {
    taskServiceSpy = {
      addTask: vi.fn(),
      editTask: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TaskFormComponent],
      providers: [{ provide: TaskService, useValue: taskServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title input, difficulty select and date input', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input#task-title')).toBeTruthy();
    expect(compiled.querySelector('select#task-difficulty')).toBeTruthy();
    expect(compiled.querySelector('input#task-due-date')).toBeTruthy();
  });

  it('should render 5 difficulty options with XP labels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const options = compiled.querySelectorAll('option');
    expect(options.length).toBe(5);
    expect(options[0].textContent).toContain('Fácil');
    expect(options[0].textContent).toContain('+10 XP');
    expect(options[1].textContent).toContain('Média');
    expect(options[1].textContent).toContain('+20 XP');
    expect(options[2].textContent).toContain('Difícil');
    expect(options[2].textContent).toContain('+35 XP');
    expect(options[3].textContent).toContain('Muito difícil');
    expect(options[3].textContent).toContain('+60 XP');
    expect(options[4].textContent).toContain('Épica');
    expect(options[4].textContent).toContain('+100 XP');
  });

  it('should have submit disabled when title is empty', () => {
    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('should enable submit when title is filled', () => {
    component.title.set('My task');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('should trim title for validation', () => {
    component.title.set('   ');
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(false);

    component.title.set('  A  ');
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);
    expect(component.trimmedTitle()).toBe('A');
  });

  it('should update difficulty when select changes', () => {
    const select = fixture.nativeElement.querySelector(
      'select#task-difficulty',
    ) as HTMLSelectElement;
    select.selectedIndex = 4;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.difficulty()).toBe('epica');
  });

  it('should reflect selected difficulty in the select element', () => {
    component.difficulty.set('media');
    fixture.detectChanges();
    // Segunda passada para o efeito do ngModel (signal) refletir no <select>.
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector(
      'select#task-difficulty',
    ) as HTMLSelectElement;
    expect(select.selectedIndex).toBe(1);
  });

  it('should call addTask with title, difficulty and dueDate on submit', () => {
    component.title.set('New task');
    component.difficulty.set('media');
    component.dueDate.set('2026-08-25');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.click();

    expect(taskServiceSpy.addTask).toHaveBeenCalledWith('New task', 'media', '2026-08-25');
  });

  it('should call addTask with null dueDate when date is empty', () => {
    component.title.set('No date task');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.click();

    expect(taskServiceSpy.addTask).toHaveBeenCalledWith('No date task', 'facil', null);
  });

  it('should not call addTask when title is empty', () => {
    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.click();

    expect(taskServiceSpy.addTask).not.toHaveBeenCalled();
  });

  it('should emit saved after submit', () => {
    let savedCount = 0;
    component.saved.subscribe(() => savedCount++);
    component.title.set('Emit task');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.click();

    expect(savedCount).toBe(1);
  });

  it('should pre-fill fields from task in edit mode', () => {
    fixture.componentRef.setInput('task', existingTask);
    fixture.detectChanges();

    expect(component.isEditing()).toBe(true);
    expect(component.title()).toBe('Existing task');
    expect(component.difficulty()).toBe('dificil');
    expect(component.dueDate()).toBe('2026-08-20');
  });

  it('should show edit submit label in edit mode', () => {
    fixture.componentRef.setInput('task', existingTask);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitBtn.textContent).toContain('Salvar alterações');
  });

  it('should call editTask with id and updates on submit in edit mode', () => {
    fixture.componentRef.setInput('task', existingTask);
    fixture.detectChanges();

    component.title.set('Updated title');
    component.difficulty.set('epica');
    component.dueDate.set('2026-09-01');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.click();

    expect(taskServiceSpy.editTask).toHaveBeenCalledWith('task-1', {
      title: 'Updated title',
      difficulty: 'epica',
      dueDate: '2026-09-01',
    });
    expect(taskServiceSpy.addTask).not.toHaveBeenCalled();
  });
});