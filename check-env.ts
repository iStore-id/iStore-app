
function checkEnv(name: string) {
  const val = process.env[name];
  if (!val) {
    console.log(`${name}: NOT SET`);
  } else {
    console.log(`${name}: SET (length: ${val.length}, starts with: ${val.substring(0, 8)}...)`);
    if (val.includes(' ')) {
      console.log(`  WARNING: ${name} contains spaces!`);
    }
  }
}

checkEnv('SUPABASE_URL');
checkEnv('SUPABASE_SERVICE_ROLE_KEY');
checkEnv('VITE_SUPABASE_URL');
