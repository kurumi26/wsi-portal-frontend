import {
  Globe,
  Server,
  Cloud,
  HardDrive,
  ShieldCheck,
  Lock,
  DatabaseBackup,
  Puzzle,
  Boxes,
} from 'lucide-react';

const CATEGORY_VISUALS = {
  Domains: Globe,
  Hosting: Server,
  'Shared Hosting': Server,
  Cloud: Cloud,
  Dedicated: HardDrive,
  'Dedicated Server': HardDrive,
  SSL: Lock,
  SiteLock: ShieldCheck,
  CodeGuard: DatabaseBackup,
  'Add-ons': Puzzle,
};

const DEFAULT_VISUAL = Boxes;

/** Returns a lucide icon component for a service category. */
export const getCategoryIcon = (category) => CATEGORY_VISUALS[category] ?? DEFAULT_VISUAL;
