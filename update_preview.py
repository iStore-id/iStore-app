import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

start_marker = '{/* LIVE ANNOUNCEMENT PREVIEW */}'
end_marker = '{/* Advanced/Legacy Fields Toggle */}'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_preview = """{/* LIVE ANNOUNCEMENT PREVIEW */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-3">Preview Announcement Homepage</label>
                <div className="w-full bg-blue-50 border border-blue-100 rounded-lg overflow-hidden h-10 flex items-center px-4 shadow-sm relative">
                  <div className="flex items-center justify-center bg-blue-50 z-10 pr-3 py-2">
                    <Megaphone className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-[13px] text-blue-800 ml-2 whitespace-nowrap hidden sm:inline-block">Pengumuman:</span>
                  </div>
                  <div className="flex-1 overflow-hidden relative h-full flex items-center">
                    <div className="whitespace-nowrap animate-marquee flex items-center shrink-0 min-w-full">
                      <span className="text-[13px] text-blue-700 font-medium">
                        {title || 'Teks pengumuman akan tampil di sini...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              """
    new_content = content[:start_idx] + new_preview + content[end_idx:]
    with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
        f.write(new_content)
    print("Preview successfully updated.")
else:
    print("Failed to find bounds.")
