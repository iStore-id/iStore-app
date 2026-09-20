import { Response } from "express";
import { AuthenticatedRequest } from "./middleware.js";
import { createRole, updateRole, deleteRole, assignUserRole, getRole, updateUserProfile, getUserRole } from "./auth-service.js";
import { AuthRepository } from "./supabase/auth-repository.js";
import { supabaseAdmin } from "./supabase-admin.js";

export async function updateProfileApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Nama tidak boleh kosong" });
    }
    const sanitizedName = name.trim().slice(0, 100);

    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getUserRole(actor.uid, actor.email);

    const result = await updateUserProfile(actor, actorRole, sanitizedName);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("[Auth API Error] updateProfileApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function getRoles(req: AuthenticatedRequest, res: Response) {
  try {
    const roles = await AuthRepository.getInstance().getAllRoles();
    return res.status(200).json({ success: true, data: roles });
  } catch (error: any) {
    console.error("[Auth API Error] getRoles:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function createRoleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const roleData = req.body;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getUserRole(actor.uid, actor.email);
    
    const newRole = await createRole(actor, actorRole, roleData);
    return res.status(201).json({ success: true, data: newRole });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateRoleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getUserRole(actor.uid, actor.email);
    
    const updatedRole = await updateRole(actor, actorRole, id, updates);
    return res.status(200).json({ success: true, data: updatedRole });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteRoleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getUserRole(actor.uid, actor.email);
    
    await deleteRole(actor, actorRole, id);
    return res.status(200).json({ success: true, message: "Role deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function assignRoleApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { uid } = req.params;
    const { roleId } = req.body;
    const actor = { uid: req.user.uid, email: req.user.email };
    const actorRole = await getUserRole(actor.uid, actor.email);
    
    await assignUserRole(actor, actorRole, uid, roleId);
    return res.status(200).json({ success: true, message: "Role assigned" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getUserPermissionsApi(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const role = await getUserRole(uid, email);
    
    if (role === "customer") {
      return res.status(200).json({ success: true, data: [] });
    }
    
    const roleData = await getRole(role);
    if (!roleData && role !== "pemilik") { 
      return res.status(200).json({ success: true, data: [] });
    }
    
    const permissions = role === "pemilik" 
      ? [{ resource: "*", action: "full_access", scope: "global" }] 
      : roleData?.permissions || [];
      
    return res.status(200).json({ success: true, data: permissions });
  } catch (error: any) {
    console.error("[Auth API Error] getUserPermissionsApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function getAdminUsersApi(req: AuthenticatedRequest, res: Response) {
  try {
    const { data, error } = await supabaseAdmin!.from("profiles").select("*");
    if (error) throw error;
    
    const users = (data || []).map(doc => {
      return {
        uid: doc.id,
        name: doc.display_name || doc.email?.split("@")[0] || "Pengguna",
        email: doc.email || "-",
        role: doc.role_id || "customer",
        status: doc.status || "active",
        createdAt: doc.created_at || null
      };
    });
    return res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    console.error("[Auth API Error] getAdminUsersApi:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}

export async function checkPermissionApi(req: AuthenticatedRequest, res: Response) {
  try {
    // handled by requirePermission middleware
    return res.status(200).json({ success: true, allowed: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
