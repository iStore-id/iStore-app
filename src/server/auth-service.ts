import { adminDb } from "./firebase-admin";
import { Role, Permission } from "../types/auth";
import { logCoreAudit } from "./core-service";

export const OWNER_EMAIL = process.env.OWNER_EMAIL || "chokerbayu@gmail.com";

export function isOwnerIdentity(email: string): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
}

export async function getRole(roleId: string): Promise<Role | null> {
  const roleDoc = await adminDb.collection("roles").doc(roleId).get();
  if (!roleDoc.exists) {
    return null;
  }
  return roleDoc.data() as Role;
}

export async function getUserRole(uid: string, email?: string): Promise<string> {
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (userDoc.exists) {
    return userDoc.data()?.role || "customer";
  }
  
  // Canonical mapping for Owner if document does not exist yet (First login/Race condition)
  if (email && isOwnerIdentity(email)) {
    return "pemilik";
  }
  
  return "customer";
}

export async function can(uid: string, resource: string, action: string, scope: string = "global", email?: string): Promise<boolean> {
  try {
    // Optimization: Owner has full access to everything without hitting Firestore quota
    if (email && isOwnerIdentity(email)) {
      console.log(`[Permission Engine] Auto-approving Owner: ${email}`);
      return true;
    }

    const userRoleStr = await getUserRole(uid, email);
    
    // Check specific role mapping
    const role = await getRole(userRoleStr);
    if (!role || role.status !== "active") return false;

    // Check if role has full access wildcard (e.g. for Owner role)
    const hasFullAccess = role.permissions.some(
      p => p.action === "full_access" && (p.resource === resource || p.resource === "*")
    );
    if (hasFullAccess) return true;

    // Check specific permission with aliases
    return role.permissions.some(p => {
      const resourceMatch = 
        p.resource === "*" ||
        p.resource === resource ||
        (resource === "campaign" && p.resource === "marketing") ||
        (resource === "marketing" && p.resource === "campaign") ||
        (resource === "landing" && (p.resource === "content" || p.resource === "marketing")) ||
        (resource === "content" && (p.resource === "landing" || p.resource === "faq" || p.resource === "blog" || p.resource === "seo")) ||
        (resource === "faq" && (p.resource === "content" || p.resource === "faq")) ||
        (resource === "blog" && (p.resource === "content" || p.resource === "blog")) ||
        (resource === "seo" && (p.resource === "content" || p.resource === "marketing" || p.resource === "seo")) ||
        (resource === "communication" && (p.resource === "settings" || p.resource === "communication")) ||
        (resource === "privacy" && (p.resource === "settings" || p.resource === "privacy")) ||
        (resource === "regional" && (p.resource === "settings" || p.resource === "regional")) ||
        (resource === "settings" && (p.resource === "settings" || p.resource === "communication" || p.resource === "privacy" || p.resource === "regional")) ||
        (resource === "settlement" && (p.resource === "finance" || p.resource === "settlement" || p.resource === "orders")) ||
        (resource === "refunds" && (p.resource === "finance" || p.resource === "refunds" || p.resource === "orders")) ||
        (resource === "payments" && (p.resource === "finance" || p.resource === "payments" || p.resource === "orders")) ||
        (resource === "commission" && (p.resource === "finance" || p.resource === "commission")) ||
        (resource === "customerSegments" && (p.resource === "users" || p.resource === "customerSegments" || p.resource === "marketing")) ||
        (resource === "finance" && (p.resource === "finance" || p.resource === "commission")) ||
        ((resource === "audit" || resource === "audit_logs" || resource === "system_logs" || resource === "system") && (p.resource === "system" || p.resource === "audit" || p.resource === "audit_logs" || p.resource === "system_logs" || p.resource === "roles"));

      const actionMatch = 
        p.action === "full_access" ||
        p.action === action ||
        (action === "publish" && (p.action === "publish" || p.action === "approve" || p.action === "edit")) ||
        (action === "approve" && (p.action === "approve" || p.action === "publish" || p.action === "edit")) ||
        (action === "activate" && (p.action === "activate" || p.action === "edit")) ||
        (action === "evaluate" && (p.action === "evaluate" || p.action === "edit")) ||
        (action === "archive" && (p.action === "archive" || p.action === "delete" || p.action === "edit")) ||
        (action === "preview" && (p.action === "preview" || p.action === "view")) ||
        (action === "export" && (p.action === "export" || p.action === "view")) ||
        (action === "manage" && (p.action === "manage" || p.action === "edit" || p.action === "create")) ||
        (action === "refresh" && (p.action === "refresh" || p.action === "view"));

      const scopeMatch = p.scope === scope || p.scope === "global" || !p.scope || !scope;
      return resourceMatch && actionMatch && scopeMatch;
    });
  } catch (error) {
    console.error(`[Permission Engine Error] can(${uid}, ${resource}, ${action}):`, error);
    throw error; // Re-throw to be caught by middleware
  }
}

export async function createRole(actor: {uid: string, email: string}, actorRole: string, roleData: Role) {
  const roleRef = adminDb.collection("roles").doc();
  const now = new Date().toISOString();
  const newRole: Role = {
    ...roleData,
    id: roleRef.id,
    isSystemRole: false,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    updatedBy: actor.uid
  };
  
  await roleRef.set(newRole);
  await logCoreAudit(actor, actorRole, "ROLE_CREATED", `roles/${roleRef.id}`, null, newRole);
  return newRole;
}

export async function updateRole(actor: {uid: string, email: string}, actorRole: string, roleId: string, updates: Partial<Role>) {
  const roleRef = adminDb.collection("roles").doc(roleId);
  const doc = await roleRef.get();
  
  if (!doc.exists) throw new Error("Role not found");
  
  const existingRole = doc.data() as Role;
  
  if (existingRole.isSystemRole) {
    // Prevent changing fundamental properties of system roles
    if (updates.isSystemRole === false) throw new Error("Cannot change system role status");
    if (existingRole.id === "pemilik" || existingRole.id === "customer") {
      throw new Error(`Cannot modify core system role: ${existingRole.id}`);
    }
  }

  const updatedRole = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.uid
  };

  await roleRef.set(updatedRole, { merge: true });
  const finalDoc = await roleRef.get();
  
  await logCoreAudit(actor, actorRole, "ROLE_UPDATED", `roles/${roleId}`, existingRole, finalDoc.data());
  return finalDoc.data() as Role;
}

export async function deleteRole(actor: {uid: string, email: string}, actorRole: string, roleId: string) {
  const roleRef = adminDb.collection("roles").doc(roleId);
  const doc = await roleRef.get();
  
  if (!doc.exists) throw new Error("Role not found");
  const existingRole = doc.data() as Role;
  
  if (existingRole.isSystemRole) {
    throw new Error("Cannot delete system role");
  }

  // Check if any users are assigned to this role
  const usersWithRole = await adminDb.collection("users").where("role", "==", roleId).limit(1).get();
  if (!usersWithRole.empty) {
    throw new Error("Cannot delete role that is assigned to users");
  }

  await roleRef.delete();
  await logCoreAudit(actor, actorRole, "ROLE_DELETED", `roles/${roleId}`, existingRole, null);
  return true;
}

export async function assignUserRole(actor: {uid: string, email: string}, actorRole: string, targetUid: string, newRoleId: string) {
  const targetUserRef = adminDb.collection("users").doc(targetUid);
  const targetUserDoc = await targetUserRef.get();
  
  if (!targetUserDoc.exists) throw new Error("User not found");
  
  const targetUserData = targetUserDoc.data();
  const currentRole = targetUserData?.role;
  const targetEmail = targetUserData?.email;

  // Protect Owner: Cannot demote or change the role of the Owner
  if (targetEmail === "chokerbayu@gmail.com" || currentRole === "pemilik") {
    throw new Error("Cannot change or demote the role of the Owner");
  }

  // Only Owner can assign someone to role 'pemilik'
  if (newRoleId === "pemilik" && actorRole !== "pemilik") {
    throw new Error("Only the Owner can grant the Owner role");
  }

  // Validate new role exists and is active
  if (newRoleId !== "customer") {
    const role = await getRole(newRoleId);
    if (!role) throw new Error("Target role does not exist");
    if (role.status === "inactive") throw new Error("Cannot assign an inactive role to users");
  }

  await targetUserRef.update({ role: newRoleId });
  
  await logCoreAudit(actor, actorRole, "USER_ROLE_CHANGED", `users/${targetUid}`, { role: currentRole }, { role: newRoleId });
  return true;
}

export async function updateUserProfile(actor: {uid: string, email: string}, actorRole: string, newName: string) {
  const uid = actor.uid;
  const targetUserRef = adminDb.collection("users").doc(uid);
  const targetUserDoc = await targetUserRef.get();
  
  if (!targetUserDoc.exists) throw new Error("User document not found");
  
  const existingData = targetUserDoc.data();
  const oldName = existingData?.name || existingData?.displayName || "";

  // 1. Update Firestore document (Auth displayName is now handled client-side)
  await targetUserRef.update({
    name: newName,
    displayName: newName, // keep in sync
    updatedAt: new Date().toISOString()
  });

  // 3. Log Audit
  await logCoreAudit(actor, actorRole, "PROFILE_NAME_CHANGED", `users/${uid}`, { name: oldName }, { name: newName });
  
  return { uid, name: newName };
}

export async function migrateInitialRoles() {
  const ownerRef = adminDb.collection("roles").doc("pemilik");
  const adminRef = adminDb.collection("roles").doc("admin");
  const customerRef = adminDb.collection("roles").doc("customer");
  
  const now = new Date().toISOString();
  
  if (!(await ownerRef.get()).exists) {
    await ownerRef.set({
      id: "pemilik",
      name: "Owner",
      description: "Pemilik Sistem dengan Akses Penuh",
      status: "active",
      permissions: [{ resource: "*", action: "full_access", scope: "global" }],
      isSystemRole: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system"
    } as Role);
  }

  if (!(await adminRef.get()).exists) {
    await adminRef.set({
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
      createdBy: "system"
    } as Role);
  }
  
  if (!(await customerRef.get()).exists) {
    await customerRef.set({
      id: "customer",
      name: "Customer",
      description: "Pengguna standar",
      status: "active",
      permissions: [],
      isSystemRole: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system"
    } as Role);
  }
}
