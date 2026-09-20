import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin";
import { Role, Permission } from "../../types/auth";

export class AuthRepository {
  private static instance: AuthRepository;
  private constructor() {}

  public static getInstance(): AuthRepository {
    if (!AuthRepository.instance) {
      AuthRepository.instance = new AuthRepository();
    }
    return AuthRepository.instance;
  }

  private get client() {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    return supabaseAdmin;
  }

  async getRole(id: string): Promise<Role | null> {
    const { data, error } = await this.client
      .from("roles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
      
    if (error || !data) return null;
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status || "active",
      permissions: data.permissions || [],
      isSystemRole: data.is_system,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by || "system",
      updatedBy: data.updated_by || "system"
    };
  }
  
  async getAllRoles(): Promise<Role[]> {
    const { data, error } = await this.client.from("roles").select("*");
    if (error || !data) return [];
    
    return data.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      status: d.status || "active",
      permissions: d.permissions || [],
      isSystemRole: d.is_system,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      createdBy: d.created_by || "system",
      updatedBy: d.updated_by || "system"
    }));
  }

  async getUserRole(uid: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("role_id")
      .eq("id", uid)
      .maybeSingle();
      
    if (error || !data) return null;
    return data.role_id;
  }
  
  async getUser(uid: string): Promise<any | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
      
    if (error || !data) return null;
    return data;
  }

  async createRole(role: Role): Promise<void> {
    const { error } = await this.client.from("roles").insert({
      id: role.id,
      name: role.name,
      description: role.description,
      status: role.status,
      permissions: role.permissions,
      is_system: role.isSystemRole,
      created_at: role.createdAt,
      updated_at: role.updatedAt,
      created_by: role.createdBy,
      updated_by: role.updatedBy
    });
    if (error) throw new Error(error.message);
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.permissions !== undefined) payload.permissions = updates.permissions;
    if (updates.isSystemRole !== undefined) payload.is_system = updates.isSystemRole;
    if (updates.updatedAt !== undefined) payload.updated_at = updates.updatedAt;
    if (updates.updatedBy !== undefined) payload.updated_by = updates.updatedBy;
    
    const { data, error } = await this.client
      .from("roles")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.getRole(id);
  }

  async deleteRole(id: string): Promise<void> {
    const { error } = await this.client.from("roles").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async assignUserRole(uid: string, roleId: string): Promise<void> {
    const { error } = await this.client
      .from("profiles")
      .update({ role_id: roleId })
      .eq("id", uid);
    if (error) throw new Error(error.message);
  }
  
  async updateUserProfile(uid: string, name: string): Promise<void> {
    const { error } = await this.client
      .from("profiles")
      .update({ display_name: name })
      .eq("id", uid);
    if (error) throw new Error(error.message);
  }
  
  async hasUsersWithRole(roleId: string): Promise<boolean> {
    const { data, error, count } = await this.client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", roleId);
      
    if (error) return false;
    return (count || 0) > 0;
  }
}
