import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

content = content.replace('''                  </div>
                  </div>
              )}
              </div>''', '''                  </div>
                )}
              </div>''')

with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
    f.write(content)
