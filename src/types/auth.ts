export interface Permission {
  resource: string;
  action: string;
  scope?: string;
}

export interface Role {
  id?: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  permissions: Permission[];
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
