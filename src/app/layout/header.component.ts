import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../theme/theme.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly isDark = computed(() => this.themeService.theme() === 'dark');
  readonly user = this.auth.user;
  readonly userInitials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = (u.name ?? '').trim() || u.email || '';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });
  readonly themeLabel = computed(() =>
    this.isDark() ? 'Ativar modo claro' : 'Ativar modo escuro',
  );

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
