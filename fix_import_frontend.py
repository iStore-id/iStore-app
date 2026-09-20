import re

with open('src/pages/admin/AdminProvidersPage.tsx', 'r') as f:
    content = f.read()

target = """  const handleExecuteImport = async () => {
    if (selectedItems.length === 0) return;
    setImporting(true);
    setImportError("");
    
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/admin/providers/catalog-discovery/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId: selectedProvider,
          items: selectedItems,
          mode: importMode
        })
      });

      let resData: any = {};
      try {
        const text = await response.text();
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        console.warn("Non-JSON response received", e);
      }
      
      if (!response.ok) {
        throw new Error(resData.message || `Gagal melakukan proses impor (Status: ${response.status}).`);
      }

      setImportSuccessResult(resData.data || { processed: selectedItems.length, success: selectedItems.length, failed: 0 });
      // Clean selections and refresh existing SKUs
      setSelectedSkus({});
    } catch (err: any) {
      setImportError(err.message || "Terjadi kesalahan saat memproses impor.");
    } finally {
      setImporting(false);
    }
  };"""

replacement = """  const handleExecuteImport = async () => {
    if (selectedItems.length === 0) return;
    setImporting(true);
    setImportError("");
    
    try {
      const token = await user?.getIdToken();
      let successCount = 0;
      let failedCount = 0;

      // Loop and create each SKU individually using the existing endpoint
      for (const item of selectedItems) {
        try {
          const payload = {
            providerId: selectedProvider,
            providerSku: item.providerSku,
            name: item.name,
            category: item.category,
            brand: item.brand,
            type: item.type,
            price: item.price,
            status: item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          };
          
          const response = await fetch('/api/admin/providers/skus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (e) {
          failedCount++;
        }
      }
      
      setImportSuccessResult({ processed: selectedItems.length, success: successCount, failed: failedCount });
      
      if (failedCount > 0 && successCount === 0) {
        setImportError(`Gagal mengimpor ${failedCount} SKU. Kemungkinan SKU sudah ada atau duplikat.`);
      }
      
      // Clean selections and refresh existing SKUs
      setSelectedSkus({});
    } catch (err: any) {
      setImportError(err.message || "Terjadi kesalahan saat memproses impor.");
    } finally {
      setImporting(false);
    }
  };"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/admin/AdminProvidersPage.tsx', 'w') as f:
        f.write(content)
    print("Fixed import endpoint loop.")
else:
    print("Could not find the target code in AdminProvidersPage.tsx")
