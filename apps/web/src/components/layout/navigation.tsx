import { NavLink } from 'react-router';
import { Group, UnstyledButton } from '@mantine/core';
import { IconHome, IconServer, IconTopologyRing3 } from '@tabler/icons-react';
import classes from './navigation.module.css';

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? classes.linkActive : classes.link)}>
      {({ isActive }) => (
        <UnstyledButton
          className={classes.linkButton}
          aria-current={isActive ? 'page' : undefined}
          aria-label={label}
        >
          <Icon size={20} />
          <span className={classes.linkLabel}>{label}</span>
        </UnstyledButton>
      )}
    </NavLink>
  );
}

export function Navigation() {
  return (
    <Group gap="xs">
      <NavItem to="/" icon={IconHome} label="Accueil" />
      <NavItem to="/nodes" icon={IconServer} label="Noeuds" />
      <NavItem to="/graph" icon={IconTopologyRing3} label="Graphe" />
    </Group>
  );
}
