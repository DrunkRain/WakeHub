import { IconServer, IconDeviceDesktop, IconBox, IconBrandDocker } from '@tabler/icons-react';
import type { NodeType } from '@wakehub/shared';

const typeIcons: Record<NodeType, React.ComponentType<{ size?: number }>> = {
  physical: IconServer,
  vm: IconDeviceDesktop,
  lxc: IconBox,
  container: IconBrandDocker,
};

interface NodeTypeIconProps {
  type: NodeType;
  size?: number;
}

export function NodeTypeIcon({ type, size = 20 }: NodeTypeIconProps) {
  const Icon = typeIcons[type];
  return <Icon size={size} />;
}
