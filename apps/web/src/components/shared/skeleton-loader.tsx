import { Skeleton, Stack } from '@mantine/core';

interface SkeletonLoaderProps {
  count?: number;
  height?: number;
}

export function SkeletonLoader({ count = 3, height = 80 }: SkeletonLoaderProps) {
  return (
    <Stack gap="md">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={height} radius="md" />
      ))}
    </Stack>
  );
}
