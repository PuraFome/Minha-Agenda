import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header.component';
import { FooterComponent } from './layout/footer.component';
import { LevelUpComponent } from './game/level-up.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, LevelUpComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
