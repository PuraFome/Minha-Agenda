import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  readonly consent = signal(false);

  onConsentChange(event: Event): void {
    this.consent.set((event.target as HTMLInputElement).checked);
  }

  login(): void {
    if (!this.consent()) {
      return;
    }
    this.auth.login();
  }
}
