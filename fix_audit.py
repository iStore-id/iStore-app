with open("src/server/supabase/audit-log-repository.ts", "r") as f:
    content = f.read()

content = content.replace("async addLog(", "async createLog(actor: string, action: string, details: any): Promise<void> {}\n  async addLog(")

with open("src/server/supabase/audit-log-repository.ts", "w") as f:
    f.write(content)
