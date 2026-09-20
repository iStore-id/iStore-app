import { CustomerRepository } from "./supabase/customer-repository.js";
import * as crypto from "crypto";

export interface CustomerDirectoryQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface CustomerDirectoryResponse {
  customers: any[];
  total: number;
  page: number;
  pageSize: number;
  stats: any;
}

export class CustomerService {
  private static instance: CustomerService;

  private constructor() {}

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }
  
  private repo = CustomerRepository.getInstance();

  private async fetchOrdersForUserIds(uids: string[]): Promise<any[]> {
    return [];
  }

  async getCustomerById(uid: string): Promise<any | null> {
    return this.repo.getCustomer(uid);
  }

  async getCustomerDirectory(query: CustomerDirectoryQuery, maskPii: boolean = true): Promise<CustomerDirectoryResponse> {
    const customers = await this.repo.getCustomers(query);
    const stats = await this.repo.getCustomersStats();
    
    return {
      customers,
      total: stats.totalUsers || 0,
      page: query.page || 1,
      pageSize: query.pageSize || 50,
      stats
    };
  }

  async getCustomer360Profile(
    uid: string, 
    context: any, 
    maskPii: boolean = true
  ): Promise<any> {
    const customer = await this.getCustomerById(uid);
    if (!customer) throw new Error("Customer not found");
    return {
      customer,
      recentOrders: [],
      points: await this.repo.getPointTransactions(uid),
      tickets: [],
      segments: []
    };
  }

  async updateCustomerStatus(
    uid: string, 
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DISABLED",
    reason: string,
    actor: string
  ): Promise<void> {
    await this.repo.updateCustomer(uid, { status });
  }

  async addCustomerNote(
    uid: string, 
    noteText: string, 
    authorId: string, 
    authorName: string
  ): Promise<any> {
    return { id: crypto.randomUUID(), text: noteText, authorId, createdAt: new Date().toISOString() };
  }

  async updateCustomerTags(
    uid: string, 
    tags: string[],
    actor: string
  ): Promise<void> {
    const customer = await this.getCustomerById(uid);
    if (customer) {
      await this.repo.updateCustomer(uid, { metadata: { ...customer.metadata, tags } });
    }
  }

  async unmaskCustomerPii(
    uid: string,
    reason: string,
    context: any
  ): Promise<any> {
    return this.getCustomerById(uid);
  }

  async exportCustomersCsv(
    query: CustomerDirectoryQuery,
    actor: string,
    actorRole: string
  ): Promise<string> {
    return "csv_content";
  }
}

export function maskEmail(email: string): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `*@${domain}`;
  return `${name.substring(0, 2)}${"*".repeat(name.length - 2)}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return `${phone.substring(0, 3)}${"*".repeat(phone.length - 7)}${phone.substring(phone.length - 4)}`;
}
