import { NavLink } from 'react-router';
import { Group, UnstyledButton } from '@mantine/core';
import { IconDashboard, IconServer, IconLink, IconSettings, IconFileText } from '@tabler/icons-react';
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
      <NavItem to="/" icon={IconDashboard} label="Dashboard" />
      <NavItem to="/services" icon={IconServer} label="Services" />
      <NavItem to="/dependencies" icon={IconLink} label="Dépendances" />
      <NavItem to="/settings" icon={IconSettings} label="Settings" />
      <NavItem to="/logs" icon={IconFileText} label="Logs" />
    </Group>
  );
}
