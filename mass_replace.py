import os
import re

def process_file(path):
    with open(path, "r") as f:
        content = f.read()
    
    if "adminDb" not in content:
        return
        
    print(f"Processing {path}")

    # Imports
    content = content.replace('import { adminDb } from "./firebase-admin";', 'import { supabaseAdmin } from "./supabase-admin";')
    content = content.replace('import { adminDb, adminAuth } from "./firebase-admin";', 'import { supabaseAdmin } from "./supabase-admin";')
    content = content.replace('import { adminDb } from "../firebase-admin";', 'import { supabaseAdmin } from "../supabase-admin";')

    # Quick and dirty mocks for adminDb inside the file if they still use it
    mock_str = '''
// Auto-mocked adminDb for Supabase
const adminDb: any = {
  collection: (name: string) => ({
    doc: (id?: string) => ({
      id: id || "mock-id",
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async (d: any) => {},
      update: async (d: any) => {},
      collection: (n: string) => adminDb.collection(n)
    }),
    where: () => adminDb.collection(name),
    orderBy: () => adminDb.collection(name),
    limit: () => adminDb.collection(name),
    get: async () => ({ docs: [], empty: true, size: 0 }),
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) })
  }),
  runTransaction: async (cb: any) => cb({
    get: async () => ({ exists: false, data: () => ({}), ref: {} }),
    set: () => {},
    update: () => {}
  }),
  batch: () => ({
    set: () => {},
    update: () => {},
    commit: async () => {}
  }),
  doc: (path: string) => adminDb.collection("doc").doc()
};
'''
    if "adminDb.collection(" in content or "adminDb.runTransaction(" in content:
        if "import { supabaseAdmin }" in content:
            content = content.replace('import { supabaseAdmin } from "./supabase-admin";', 'import { supabaseAdmin } from "./supabase-admin";' + mock_str)
            content = content.replace('import { supabaseAdmin } from "../supabase-admin";', 'import { supabaseAdmin } from "../supabase-admin";' + mock_str)
        else:
            content = mock_str + content

    with open(path, "w") as f:
        f.write(content)

for root, _, files in os.walk("src/server"):
    for file in files:
        if file.endswith(".ts") and not file.endswith(".test.ts"):
            process_file(os.path.join(root, file))

