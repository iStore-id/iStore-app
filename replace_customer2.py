import re

with open("src/server/customer-service.ts", "r") as f:
    content = f.read()

# Replace pointTransactions
content = re.sub(
    r'const pointsSnap = await adminDb\.collection\("pointTransactions"\)[\s\S]*?\}\)\);',
    r'const pointsHistory = await CustomerRepository.getInstance().getPointTransactions(customerId);',
    content
)

# Remove the isNativeQuery block entirely
content = re.sub(
    r'if \(isNativeQuery\) \{[\s\S]*?\} else \{',
    r'if (false) {\n    } else {',
    content
)

with open("src/server/customer-service.ts", "w") as f:
    f.write(content)

