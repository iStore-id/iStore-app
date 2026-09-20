import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

target = '''                    </div>
                  </div>
                </div>

              {/* Schedule and Priority */}'''

replacement = '''                    </div>
                  </div>

              {/* Schedule and Priority */}'''

content = content.replace(target, replacement)
with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
    f.write(content)
