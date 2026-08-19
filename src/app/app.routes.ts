import { Routes } from '@angular/router';
import { heroGuard } from './game/hero.guard';
import { MuralComponent } from './pages/mural/mural.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { MissionFormComponent } from './missions/mission-form.component';

export const routes: Routes = [
  { path: '', component: MuralComponent, canActivate: [heroGuard] },
  { path: 'perfil', component: PerfilComponent },
  { path: 'nova-missao', component: MissionFormComponent, canActivate: [heroGuard] },
  { path: '**', redirectTo: '' },
];
