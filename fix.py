import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if '                        </div>' in line and i < len(lines) -1 and '              )}' in lines[i+1] and 'Archive' in lines[i-3]:
        # This is where sed incorrectly inserted </div>
        pass
    elif line.strip() == ')}' and i > 0 and '</div>' in lines[i-1] and 'Archive' in lines[i-4]:
        # Wait, let's just fix the block exactly.
        pass

