import { Component, signal } from '@angular/core';
import { MissionListComponent } from '../../missions/mission-list.component';

@Component({
  selector: 'app-mural',
  imports: [MissionListComponent],
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent {
  readonly activeTab = signal<'pending' | 'completed'>('pending');

  selectTab(tab: 'pending' | 'completed'): void {
    this.activeTab.set(tab);
  }
}