import {
  Validate,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeImprovementLevels } from '../../anti-cheat/game-rules';

@ValidatorConstraint({ name: 'ImprovementLevels', async: false })
export class ImprovementLevelsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return normalizeImprovementLevels(value).ok;
  }

  defaultMessage(args: ValidationArguments): string {
    const result = normalizeImprovementLevels(args.value);

    return result.ok ? 'improvements must be valid.' : result.message;
  }
}

export function IsImprovementLevels(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return Validate(ImprovementLevelsConstraint, validationOptions);
}
