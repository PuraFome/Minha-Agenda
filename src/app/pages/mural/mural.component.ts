import { Component, inject, signal } from '@angular/core';
import { MissionListComponent } from '../../missions/mission-list.component';
import { SettingsService } from '../../game/settings.service';

@Component({
  selector: 'app-mural',
  imports: [MissionListComponent],
  templateUrl: './mural.component.html',
  styleUrl: './mural.component.scss',
})
export class MuralComponent {
  private readonly settingsService = inject(SettingsService);

  readonly activeTab = signal<'pending' | 'completed'>(
    this.settingsService.getSettings()?.muralActiveTab ?? 'pending',
  );

  selectTab(tab: 'pending' | 'completed'): void {
    this.activeTab.set(tab);
    this.settingsService.putSettings({ muralActiveTab: tab });
  }
}
