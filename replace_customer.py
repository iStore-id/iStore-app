import re

with open("src/server/customer-service.ts", "r") as f:
    content = f.read()

# Replace import
content = content.replace('import { adminDb } from "./firebase-admin";', 'import { CustomerRepository } from "./supabase/customer-repository";')

# Replace getCustomerById
content = re.sub(
    r'async getCustomerById\(uid: string\): Promise<CustomerUser \| null> \{[\s\S]*?\}',
    r'''async getCustomerById(uid: string): Promise<CustomerUser | null> {
    const doc = await CustomerRepository.getInstance().getCustomer(uid);
    if (!doc) return null;
    return this.normalizeUser(doc.uid, doc);
  }''',
    content
)

# Replace count queries
content = re.sub(
    r'adminDb\.collection\("users"\)\.count\(\)\.get\(\),[\s\S]*?\]\);',
    r'''// Mock counts with getCustomersStats
        CustomerRepository.getInstance().getCustomersStats(),
        CustomerRepository.getInstance().getCustomersStats(),
        CustomerRepository.getInstance().getCustomersStats(),
        CustomerRepository.getInstance().getCustomersStats()
      ]);''',
    content
)

content = content.replace(
    'allUsersCountForMetrics = totalCustSnap.data().count;',
    'allUsersCountForMetrics = totalCustSnap.totalUsers;'
)
content = content.replace(
    'activeCount = activeSnap.data().count;',
    'activeCount = activeSnap.activeUsers;'
)
content = content.replace(
    'suspendedCount = suspendedSnap.data().count;',
    'suspendedCount = suspendedSnap.suspendedUsers;'
)
content = content.replace(
    'disabledCount = disabledSnap.data().count;',
    'disabledCount = disabledSnap.inactiveUsers;'
)

# Replace all isNativeQuery blocks with one block
# We can just replace the whole getCustomerDirectory function, but let's try to just replace `const usersSnap = await adminDb.collection("users").get();`
content = content.replace(
    'const usersSnap = await adminDb.collection("users").get();',
    'const usersSnap = await CustomerRepository.getInstance().getCustomers();'
)

content = content.replace(
    'let allUsers: CustomerUser[] = usersSnap.docs.map(doc => this.normalizeUser(doc.id, doc.data()));',
    'let allUsers: CustomerUser[] = usersSnap.map((doc: any) => this.normalizeUser(doc.uid, doc));'
)

# Replace `const userDoc = await adminDb.collection("users").doc(customerId).get();`
content = content.replace(
    'const userDoc = await adminDb.collection("users").doc(customerId).get();',
    'const userDoc = await CustomerRepository.getInstance().getCustomer(customerId);'
)

content = content.replace(
    'if (!userDoc.exists) throw new Error("Customer tidak ditemukan.");',
    'if (!userDoc) throw new Error("Customer tidak ditemukan.");'
)

content = content.replace(
    'const existingUser = userDoc.data() as CustomerUser;',
    'const existingUser = userDoc as CustomerUser;'
)

content = content.replace(
    'const userRef = adminDb.collection("users").doc(customerId);',
    ''
)

content = content.replace(
    'await userRef.update({',
    'await CustomerRepository.getInstance().updateCustomer(customerId, {'
)

# Fix issue where userRef update is used in try/catch block
content = content.replace(
    'await userRef.update(updates);',
    'await CustomerRepository.getInstance().updateCustomer(customerId, updates);'
)

# Point transactions
content = content.replace(
    'const pointsSnap = await adminDb.collection("pointTransactions")\n        .where("customerId", "==", customerId)\n        .orderBy("createdAt", "desc")\n        .get();\n\n      const pointsHistory = pointsSnap.docs.map(doc => ({\n        id: doc.id,\n        ...doc.data()\n      }));',
    'const pointsHistory = await CustomerRepository.getInstance().getPointTransactions(customerId);'
)

with open("src/server/customer-service.ts", "w") as f:
    f.write(content)
