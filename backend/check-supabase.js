const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('../.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('=== Checking Supabase Tables ===\n');
  
  console.log('1. saved_accounts table:');
  const { data: accounts, error: accError } = await supabase
    .from('saved_accounts')
    .select('*')
    .limit(3);
  
  if (accError) {
    console.log('   Error:', accError.message);
  } else {
    console.log('   Total rows:', accounts.length);
    if (accounts.length > 0) {
      console.log('   Columns:', Object.keys(accounts[0]).join(', '));
      console.log('   Sample data:', JSON.stringify(accounts[0], null, 2));
    } else {
      console.log('   No data found');
    }
  }

  console.log('\n2. upload_history table:');
  const { data: history, error: histError } = await supabase
    .from('upload_history')
    .select('*')
    .limit(3);
  
  if (histError) {
    console.log('   Error:', histError.message);
  } else {
    console.log('   Total rows:', history.length);
    if (history.length > 0) {
      console.log('   Columns:', Object.keys(history[0]).join(', '));
      console.log('   Sample data:', JSON.stringify(history[0], null, 2));
    } else {
      console.log('   No data found');
    }
  }
}

checkTables().then(() => process.exit(0));
