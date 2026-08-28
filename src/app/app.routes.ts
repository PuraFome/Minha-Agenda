import { Routes } from '@angular/router';
import { heroGuard } from './game/hero.guard';
import { authGuard, noAuthGuard } from './core/auth.guard';
import { RootRedirectComponent } from './pages/root-redirect/root-redirect.component';
import { MuralComponent } from './pages/mural/mural.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { MissionFormComponent } from './missions/mission-form.component';
import { LoginComponent } from './pages/login/login.component';
import { TabernaComponent } from './taberna/taberna.component';

export const routes: Routes = [
  { path: '', component: RootRedirectComponent },
  { path: 'mural', component: MuralComponent, canActivate: [authGuard, heroGuard] },
  { path: 'login', component: LoginComponent, canActivate: [noAuthGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },
  { path: 'nova-missao', component: MissionFormComponent, canActivate: [authGuard, heroGuard] },
  { path: 'taberna', component: TabernaComponent, canActivate: [authGuard, heroGuard] },
  { path: '**', redirectTo: '' },
];
