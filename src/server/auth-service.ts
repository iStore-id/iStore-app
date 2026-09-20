import { AuthRepository } from "./supabase/auth-repository";
import { Role, Permission } from "../types/auth";
import { logCoreAudit } from "./core-service";

export const OWNER_EMAIL = process.env.OWNER_EMAIL || "kabay.cs@gmail.com";

export function isOwnerIdentity(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === "kabay.cs@gmail.com" || lower === "chokerbayu@gmail.com" || lower === OWNER_EMAIL.toLowerCase().trim();
}

export async function getRole(roleId: string): Promise<Role | null> {
  return AuthRepository.getInstance().getRole(roleId);
}

export async function getUserRole(uid: string, email?: string): Promise<string> {
  const role = await AuthRepository.getInstance().getUserRole(uid);
  if (role) {
    return role;
  }
  
  if (email && isOwnerIdentity(email)) {
    return "pemilik";
  }
  
  return "customer";
}

export async function can(uid: string, email: string, resource: string, action: string, scope?: string): Promise<boolean> {
  const roleId = await getUserRole(uid, email);
  if (roleId === "pemilik") return true;
  
  const role = await getRole(roleId);
  if (!role || role.status === "inactive") return false;

  const permissions = role.permissions || [];
  
  try {
    return permissions.some(p => {
      const resourceMatch = p.resource === resource || p.resource === "*";
      const actionMatch = p.action === action || p.action === "full_access" ||
        (action === "view" && (p.action === "view" || p.action === "manage" || p.action === "edit" || p.action === "export")) ||
        (action === "create" && (p.action === "create" || p.action === "manage")) ||
        (action === "edit" && (p.action === "edit" || p.action === "manage")) ||
        (action === "delete" && (p.action === "delete" || p.action === "manage")) ||
        (action === "export" && (p.action === "export" || p.action === "view")) ||
        (action === "manage" && (p.action === "manage" || p.action === "edit" || p.action === "create")) ||
        (action === "refresh" && (p.action === "refresh" || p.action === "view"));
      
      const scopeMatch = p.scope === scope || p.scope === "global" || !p.scope || !scope;
      
      return resourceMatch && actionMatch && scopeMatch;
    });
  } catch (error) {
    console.error(`[Permission Engine Error] can(${uid}, ${resource}, ${action}):`, error);
    throw error;
  }
}

export async function createRole(actor: {uid: string, email: string}, actorRole: string, roleData: Role) {
  const now = new Date().toISOString();
  // We use crypto.randomUUID for IDs normally, but let's use a normalized name or a generated ID
  const id = roleData.id || "role_" + Math.random().toString(36).substring(2, 9);
  
  const newRole: Role = {
    ...roleData,
    id,
    isSystemRole: false,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    updatedBy: actor.uid
  };
  
  await AuthRepository.getInstance().createRole(newRole);
  await logCoreAudit(actor, actorRole, "ROLE_CREATED", `roles/${id}`, null, newRole);
  
  return newRole;
}

export async function updateRole(actor: {uid: string, email: string}, actorRole: string, roleId: string, updates: Partial<Role>) {
  const existingRole = await AuthRepository.getInstance().getRole(roleId);
  
  if (!existingRole) throw new Error("Role not found");
  
  if (existingRole.isSystemRole) {
    if (updates.isSystemRole === false) throw new Error("Cannot change system role status");
    if (existingRole.id === "pemilik" || existingRole.id === "customer") {
      throw new Error(`Cannot modify core system role: ${existingRole.id}`);
    }
  }

  const updatedRoleData = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.uid
  };

  const finalDoc = await AuthRepository.getInstance().updateRole(roleId, updatedRoleData);
  await logCoreAudit(actor, actorRole, "ROLE_UPDATED", `roles/${roleId}`, existingRole, finalDoc);
  return finalDoc;
}

export async function deleteRole(actor: {uid: string, email: string}, actorRole: string, roleId: string) {
  const existingRole = await AuthRepository.getInstance().getRole(roleId);
  if (!existingRole) throw new Error("Role not found");
  
  if (existingRole.isSystemRole) {
    throw new Error("Cannot delete system role");
  }
  
  const hasUsers = await AuthRepository.getInstance().hasUsersWithRole(roleId);
  if (hasUsers) {
    throw new Error("Cannot delete role that is assigned to users");
  }
  
  await AuthRepository.getInstance().deleteRole(roleId);
  await logCoreAudit(actor, actorRole, "ROLE_DELETED", `roles/${roleId}`, existingRole, null);
  return true;
}

export async function assignUserRole(actor: {uid: string, email: string}, actorRole: string, targetUid: string, newRoleId: string) {
  const targetUser = await AuthRepository.getInstance().getUser(targetUid);
  if (!targetUser) throw new Error("User not found");
  
  const currentRole = targetUser.role_id;
  const targetEmail = targetUser.email;
  
  if (targetEmail === "chokerbayu@gmail.com" || currentRole === "pemilik") {
    throw new Error("Cannot change or demote the role of the Owner");
  }
  
  if (newRoleId === "pemilik" && actorRole !== "pemilik") {
    throw new Error("Only the Owner can grant the Owner role");
  }
  
  if (newRoleId !== "customer") {
    const role = await getRole(newRoleId);
    if (!role) throw new Error("Target role does not exist");
    if (role.status === "inactive") throw new Error("Cannot assign an inactive role to users");
  }
  
  await AuthRepository.getInstance().assignUserRole(targetUid, newRoleId);
  await logCoreAudit(actor, actorRole, "USER_ROLE_CHANGED", `profiles/${targetUid}`, { role: currentRole }, { role: newRoleId });
  return true;
}

export async function updateUserProfile(actor: {uid: string, email: string}, actorRole: string, newName: string) {
  const uid = actor.uid;
  const targetUser = await AuthRepository.getInstance().getUser(uid);
  
  if (!targetUser) throw new Error("User document not found");
  
  const oldName = targetUser.display_name || "";
  
  await AuthRepository.getInstance().updateUserProfile(uid, newName);
  await logCoreAudit(actor, actorRole, "PROFILE_NAME_CHANGED", `profiles/${uid}`, { name: oldName }, { name: newName });
  
  return { uid, name: newName };
}

export async function migrateInitialRoles() {
  const repo = AuthRepository.getInstance();
  const now = new Date().toISOString();
  
  const owner = await repo.getRole("pemilik");
  if (!owner) {
    await repo.createRole({
      id: "pemilik",
      name: "Owner",
      description: "Pemilik Sistem dengan Akses Penuh",
      status: "active",
      permissions: [{ resource: "*", action: "full_access", scope: "global" }],
      isSystemRole: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
      updatedBy: "system"
    });
  }
  
  const admin = await repo.getRole("admin");
  if (!admin) {
    await repo.createRole({
      id: "admin",
      name: "Administrator",
      description: "Admin Sistem dengan akses manajemen dasar",
      status: "active",
      permissions: [
        { resource: "dashboard", action: "view" },
        { resource: "games", action: "view" },
        { resource: "games", action: "create" },
        { resource: "games", action: "edit" },
        { resource: "products", action: "view" },
        { resource: "products", action: "create" },
        { resource: "products", action: "edit" },
        { resource: "orders", action: "view" },
        { resource: "orders", action: "edit" },
        { resource: "users", action: "view" },
        { resource: "pricing", action: "view" },
        { resource: "pricing", action: "create" },
        { resource: "pricing", action: "edit" },
        { resource: "providers", action: "view" },
        { resource: "providers", action: "create" },
        { resource: "providers", action: "edit" },
        { resource: "providers", action: "activate" },
        { resource: "marketing", action: "view" },
        { resource: "marketing", action: "create" },
        { resource: "marketing", action: "edit" },
        { resource: "marketing", action: "delete" },
        { resource: "content", action: "view" },
        { resource: "content", action: "create" },
        { resource: "content", action: "edit" },
        { resource: "content", action: "delete" },
        { resource: "seo", action: "view" },
        { resource: "seo", action: "edit" },
        { resource: "settings", action: "view" },
        { resource: "settings", action: "edit" },
        { resource: "communication", action: "view" },
        { resource: "communication", action: "edit" },
        { resource: "notifications", action: "view" },
        { resource: "notifications", action: "edit" },
        { resource: "health", action: "view" },
        { resource: "health", action: "refresh" },
        { resource: "incidents", action: "view" },
        { resource: "incidents", action: "manage" },
        { resource: "finance", action: "view" },
        { resource: "finance", action: "edit" }
      ],
      isSystemRole: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
      updatedBy: "system"
    });
  }
  
  const customer = await repo.getRole("customer");
  if (!customer) {
    await repo.createRole({
      id: "customer",
      name: "Customer",
      description: "Pengguna standar",
      status: "active",
      permissions: [],
      isSystemRole: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
      updatedBy: "system"
    });
  }
}
