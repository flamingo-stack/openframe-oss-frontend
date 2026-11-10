import {
  BellIcon,
  ComputerMouseIcon,
  DatabaseIcon,
  Download02Icon,
  FileLockIcon,
  FolderCheckIcon,
  ListBulletIcon,
  LockAltIcon,
  MonitorChartIcon,
  NetworkIcon,
  PackageMinusIcon,
  PackagePlusIcon,
  PowerIcon,
  Refresh01RightIcon,
  Settings01Icon,
  ShareIcon,
  ShieldCheckIcon,
  SirenOnIcon,
  TerminalIcon,
  Upload02Icon,
  UserLockIcon,
  UserSettingsIcon,
  WebDesignIcon,
  WifiIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ComponentType, ReactNode } from 'react';

type Icon = ComponentType<{ size?: number }>;

/**
 * The icon of a guardrail category, by the name the policy templates give it (saas-shared
 * `base-security-policy.json`). The first eleven are Figma's (openframe---settings, 4365-22650); a category not listed
 * keeps the panel's shield.
 */
const CATEGORY_ICONS: Record<string, Icon> = {
  'File Downloads': Download02Icon,
  'File Uploads': Upload02Icon,
  'File Management': FolderCheckIcon,
  'Remote Access': ComputerMouseIcon,
  'Power Management': PowerIcon,
  'Process Management': WebDesignIcon,
  'Device Security': LockAltIcon,
  'Access Control': UserLockIcon,
  'Compliance & Auditing': FileLockIcon,
  'User Notifications': BellIcon,
  'System Alerts': SirenOnIcon,
  'Backup Operations': DatabaseIcon,
  'Configuration Management': Settings01Icon,
  'Data Export': ShareIcon,
  'Network Configuration': NetworkIcon,
  'Security Configuration': ShieldCheckIcon,
  'User Management': UserSettingsIcon,
  'Log Management': ListBulletIcon,
  'Network Diagnostics': WifiIcon,
  'System Monitoring': MonitorChartIcon,
  'Command Execution': TerminalIcon,
  'Software Installation': PackagePlusIcon,
  'Software Removal': PackageMinusIcon,
  'Software Updates': Refresh01RightIcon,
};

export function categoryIcon(category: string): ReactNode | undefined {
  const Icon = CATEGORY_ICONS[category];
  return Icon ? <Icon size={16} /> : undefined;
}
