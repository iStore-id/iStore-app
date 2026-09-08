import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../../store/auth-store";

export default function AdminProviderMappingPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [unmappedSkus, setUnmappedSkus] = useState<any[]>([]);
  const { user } = useAuthStore();

  const fetchMappings = useCallback(async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/providers/mappings?providerId=tokovoucher&status=ALL", {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setMappings(json.data.data);
      }
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Provider Mapping</h1>
      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Existing Mappings</h2>
        <table className="min-w-full divide-y divide-gray-200">
            <thead>
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {mappings.map(m => (
                    <tr key={m.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{m.providerSku}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{m.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
