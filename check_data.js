const { supabaseAdmin } = require('./dist/server.cjs'); // Assuming it can be loaded
async function check() {
  const { data: customers } = await supabaseAdmin.from('customers').select('*').eq('role', 'reseller');
  console.log('Customers with role=reseller:', customers ? customers.length : 0);
  
  const { data: configs } = await supabaseAdmin.from('system_configs').select('*').ilike('key', 'reseller_key_%');
  console.log('Configs with reseller_key_ prefix:', configs ? configs.length : 0);
}
check().catch(console.error);
