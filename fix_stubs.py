import re

def append_to_class(filepath, class_name, methods):
    with open(filepath, "r") as f:
        content = f.read()
    
    # insert before the last closing brace
    idx = content.rfind("}")
    if idx != -1:
        content = content[:idx] + methods + content[idx:]
    
    with open(filepath, "w") as f:
        f.write(content)

# JobService
job_methods = """
  async enqueue(type: string, payload: any): Promise<void> {}
  async startWorkerLoop(): Promise<void> {}
  async getLastHeartbeat(): Promise<any> { return null; }
  async getQueueStats(): Promise<any> { return {}; }
"""
append_to_class("src/server/job-service.ts", "JobService", job_methods)

# NotificationService
notif_methods = """
  async notifyCustomer(uid: string, title: string, body: string, data?: any): Promise<void> {}
  async notifyAdmin(title: string, body: string, data?: any): Promise<void> {}
  async getGlobalSettings(): Promise<any> { return {}; }
"""
append_to_class("src/server/notification-service.ts", "NotificationService", notif_methods)

# IncidentService
inc_methods = """
  async getIncidentSummary(): Promise<any> { return {}; }
  async acknowledgeIncident(id: string, actor: string): Promise<void> {}
  async assignIncident(id: string, assignee: string, actor: string): Promise<void> {}
  async closeIncident(id: string, resolution: string, actor: string): Promise<void> {}
"""
append_to_class("src/server/incident-service.ts", "IncidentService", inc_methods)

# MembershipService
mem_methods = """
  async getPlans(): Promise<any[]> { return []; }
  async createPlan(data: any): Promise<any> { return {}; }
  async updatePlan(id: string, data: any): Promise<any> { return {}; }
  async activateMembership(uid: string, planId: string): Promise<void> {}
"""
append_to_class("src/server/membership-service.ts", "MembershipService", mem_methods)

