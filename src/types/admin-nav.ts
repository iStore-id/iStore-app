import { LucideIcon } from "lucide-react";

export type ModuleStatus = "ACTIVE" | "IN_DEVELOPMENT" | "MAINTENANCE" | "DISABLED";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  resource?: string;
  action?: string;
  status?: ModuleStatus;
  description?: string;
  dependencies?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}
