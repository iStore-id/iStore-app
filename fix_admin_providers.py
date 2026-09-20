import re

with open('src/pages/admin/AdminProvidersPage.tsx', 'r') as f:
    content = f.read()

target = """      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || "Gagal melakukan proses impor.");
      }

      setImportSuccessResult(resData.data);"""

replacement = """      let resData: any = {};
      try {
        const text = await response.text();
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        console.warn("Non-JSON response received", e);
      }
      
      if (!response.ok) {
        throw new Error(resData.message || `Gagal melakukan proses impor (Status: ${response.status}).`);
      }

      setImportSuccessResult(resData.data || { processed: selectedItems.length, success: selectedItems.length, failed: 0 });"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/admin/AdminProvidersPage.tsx', 'w') as f:
        f.write(content)
    print("Fixed JSON parsing error.")
else:
    print("Could not find the target code in AdminProvidersPage.tsx")
