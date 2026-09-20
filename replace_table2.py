import re

with open('temp_table.txt', 'r') as f:
    target = f.read().split('                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">')[0]

replacement = """          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">📢 Pengumuman</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 line-clamp-1">{c.title}</p>
                          <p className="text-xs text-gray-500 font-medium">Internal: {c.name}</p>
                          {c.slug && <p className="text-[10px] text-blue-500 font-mono mt-0.5">/{c.slug}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div>{getStatusBadge(c.status)}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{new Date(c.startAt).toLocaleDateString("id-ID")}</span>
                        {c.endAt && <span>- {new Date(c.endAt).toLocaleDateString("id-ID")}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{c.priority}</td>
"""

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

new_content = content.replace(target, replacement)
if new_content == content:
    print("Replace failed!")
else:
    with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
        f.write(new_content)
    print("Replace success!")
