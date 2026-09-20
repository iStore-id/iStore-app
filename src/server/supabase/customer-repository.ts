import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin";
import { CustomerUser, PointTransaction } from "../../types/customer";

export class CustomerRepository {
  private static instance: CustomerRepository;
  private constructor() {}

  public static getInstance(): CustomerRepository {
    if (!CustomerRepository.instance) {
      CustomerRepository.instance = new CustomerRepository();
    }
    return CustomerRepository.instance;
  }

  private get client() {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      throw new Error("Supabase Admin client is not configured.");
    }
    return supabaseAdmin;
  }

  async getCustomer(uid: string): Promise<any | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
      
    if (error || !data) return null;
    return this.mapProfileToCustomer(data);
  }
  
  async getCustomers(queryConfig: any = {}): Promise<any[]> {
    let query = this.client.from("profiles").select("*");
    
    if (queryConfig.status) {
      query = query.eq("status", queryConfig.status);
    }
    if (queryConfig.role) {
      query = query.eq("role_id", queryConfig.role);
    }
    
    // Simple mock of pagination
    if (queryConfig.limit) {
      query = query.limit(queryConfig.limit);
    }
    
    const { data, error } = await query;
    if (error || !data) return [];
    
    return data.map(d => this.mapProfileToCustomer(d));
  }
  
  async getCustomersStats(): Promise<any> {
    const [total, active, suspended, inactive] = await Promise.all([
      this.client.from("profiles").select("id", { count: "exact", head: true }),
      this.client.from("profiles").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
      this.client.from("profiles").select("id", { count: "exact", head: true }).eq("status", "SUSPENDED"),
      this.client.from("profiles").select("id", { count: "exact", head: true }).in("status", ["DISABLED", "INACTIVE"])
    ]);
    
    return {
      totalUsers: total.count || 0,
      activeUsers: active.count || 0,
      suspendedUsers: suspended.count || 0,
      inactiveUsers: inactive.count || 0
    };
  }
  
  async updateCustomer(uid: string, updates: any): Promise<void> {
    const payload: any = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.role !== undefined) payload.role_id = updates.role;
    if (updates.name !== undefined) payload.display_name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.metadata !== undefined) payload.metadata = updates.metadata;
    
    payload.updated_at = new Date().toISOString();
    
    const { error } = await this.client
      .from("profiles")
      .update(payload)
      .eq("id", uid);
      
    if (error) throw new Error(error.message);
  }
  
  async getPointTransactions(customerId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from("point_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
      
    if (error || !data) return [];
    
    return data.map(d => ({
      id: d.id,
      customerId: d.customer_id,
      amount: d.amount,
      type: d.type,
      description: d.description,
      referenceId: d.reference_id,
      metadata: d.metadata,
      createdAt: d.created_at,
      createdBy: d.created_by
    }));
  }
  
  async addPointTransaction(tx: any): Promise<void> {
    const { error } = await this.client
      .from("point_transactions")
      .insert({
        customer_id: tx.customerId,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        reference_id: tx.referenceId,
        metadata: tx.metadata || {},
        created_at: tx.createdAt,
        created_by: tx.createdBy
      });
      
    if (error) throw new Error(error.message);
  }
  
  private mapProfileToCustomer(data: any): any {
    // Extract points and other fields from metadata if they exist
    const metadata = data.metadata || {};
    return {
      uid: data.id,
      email: data.email,
      name: data.display_name,
      displayName: data.display_name,
      phone: data.phone,
      role: data.role_id,
      status: data.status,
      points: metadata.points || 0,
      referralCode: data.referral_code,
      referredBy: data.referred_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      metadata: metadata
    };
  }
}
