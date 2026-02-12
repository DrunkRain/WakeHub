import { Progress, Text } from '@mantine/core';
import { IconLoader2, IconCheck, IconX } from '@tabler/icons-react';
import classes from './cascade-progress.module.css';

export interface CascadeProgressProps {
  currentStep: number;
  totalSteps: number;
  currentDependencyName?: string;
  status: 'in_progress' | 'completed' | 'failed';
}

export function CascadeProgress({
  currentStep,
  totalSteps,
  currentDependencyName,
  status,
}: CascadeProgressProps) {
  const percent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  const displayPercent = status === 'completed' ? 100 : percent;
  const color = status === 'completed' ? 'green' : status === 'failed' ? 'red' : 'blue';

  const ariaLabel = currentDependencyName
    ? `Démarrage en cours — étape ${currentStep} sur ${totalSteps} : ${currentDependencyName}`
    : `Démarrage en cours — étape ${currentStep} sur ${totalSteps}`;

  return (
    <>
      <div aria-live="polite">
        {status === 'in_progress' && currentDependencyName && (
          <Text key={currentDependencyName} size="xs" c="dimmed" className={classes.dependencyName}>
            <IconLoader2 size={12} className={classes.spinIcon} />
            {currentDependencyName}
          </Text>
        )}
        {status === 'completed' && (
          <Text size="xs" c="green" className={classes.dependencyName}>
            <IconCheck size={12} />
            Terminé
          </Text>
        )}
        {status === 'failed' && currentDependencyName && (
          <Text size="xs" c="red" className={classes.dependencyName}>
            <IconX size={12} />
            {currentDependencyName}
          </Text>
        )}
      </div>
      <div className={classes.progressWrapper}>
        <Progress.Root size={3}>
          <Progress.Section
            value={displayPercent}
            color={color}
            aria-valuenow={displayPercent}
            aria-label={ariaLabel}
          />
        </Progress.Root>
      </div>
    </>
  );
}
