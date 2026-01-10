import { createClient } from '@supabase/supabase-js';

// LES MÊMES CLÉS QUE DANS LE PROJET
const SUPABASE_URL = 'https://kgwrlutwqnfhqizeftgb.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXf8z9qjjPi8YwqTlAHmkA_cQhJqEB7';
const TABLE_NAME = 'wbot_sessions';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSupabase() {
    console.log('🔄 Test de connexion Supabase SQL...');
    console.log(`URL: ${SUPABASE_URL}`);

    try {
        const testId = `TEST_CONN_${Date.now()}`;

        // 1. TENTATIVE INSERTION
        console.log('1️⃣ Tentative Insertion...');
        const { data: insertData, error: insertError } = await supabase
            .from(TABLE_NAME)
            .insert([{
                session_id: testId,
                session_data: { test: true },
                owner_phone: 'TestScript'
            }])
            .select();

        if (insertError) {
            console.error('❌ ÉCHEC INSERTION:', insertError.message);
            console.log('\n💡 CAUSE PROBABLE : Vous n\'avez pas exécuté le script SQL dans Supabase.');
            console.log('👉 Allez voir le fichier SUPABASE_SETUP.md');
            return;
        }
        console.log('✅ Insertion réussie !');

        // 2. TENTATIVE LECTURE
        console.log('2️⃣ Tentative Lecture...');
        const { data: selectData, error: selectError } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('session_id', testId)
            .single();

        if (selectError || !selectData) {
            console.error('❌ ÉCHEC LECTURE:', selectError ? selectError.message : 'Pas de données');
            return;
        }
        console.log('✅ Lecture réussie !');
        console.log('🎉 SUPABASE EST PARFAITEMENT CONFIGURÉ.');

        // 3. NETTOYAGE
        console.log('3️⃣ Nettoyage...');
        await supabase.from(TABLE_NAME).delete().eq('session_id', testId);
        console.log('✅ Nettoyage terminé.');

    } catch (e) {
        console.error('❌ ERREUR GLOBALE:', e.message);
    }
}

testSupabase();
