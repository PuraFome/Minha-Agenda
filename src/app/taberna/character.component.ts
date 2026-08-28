import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CharacterAppearance } from './taberna.types';

@Component({
  selector: 'app-character',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character.component.html',
  styleUrl: './character.component.scss',
})
export class CharacterComponent {
  readonly appearance = input.required<CharacterAppearance>();
  readonly name = input.required<string>();
  readonly isSelected = input(false);
  readonly showName = input(true);
}
