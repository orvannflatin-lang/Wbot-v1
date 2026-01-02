import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kgwrlutwqnfhqizeftgb.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXf8z9qjjPi8YwqTlAHmkA_cQhJqEB7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log('🔍 Testing Supabase Connection...');

    // 1. Test Tables
    console.log('\n--- TABLES ---');
    try {
        const { data, error } = await supabase.from('whatsapp_sessions').select('*').limit(1);
        if (error) console.error('Error selecting whatsapp_sessions:', error.message);
        else {
            console.log('✅ whatsapp_sessions exists. Rows:', data.length);
            if (data.length > 0) console.log('Sample Row Keys:', Object.keys(data[0]));
            else console.log('Table is empty, cannot verify columns directly.');
        }
    } catch (e) { console.error(e); }

    // 2. Test Storage Buckets
    console.log('\n--- STORAGE BUCKETS ---');
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) console.error('Error listing buckets:', error.message);
        else {
            console.log('✅ Buckets found:', data.map(b => b.name));
        }
    } catch (e) { console.error(e); }

    // 3. Try Creating a Bucket if none
    console.log('\n--- ATTEMPT CREATE BUCKET ---');
    try {
        const { data, error } = await supabase.storage.createBucket('wbot_sessions', { public: true });
        if (error) console.log('Bucket creation info:', error.message);
        else console.log('✅ Created bucket: wbot_sessions');
    } catch (e) { console.error(e); }
}

debug();
