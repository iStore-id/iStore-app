import re

with open("src/server/system-health-service.ts", "r") as f:
    content = f.read()

content = content.replace("await adminAuth.listUsers(1);", "")

with open("src/server/system-health-service.ts", "w") as f:
    f.write(content)

