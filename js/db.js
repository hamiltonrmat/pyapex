// js/db.js
// Initialisation du client Supabase

if (!SUPABASE_URL || SUPABASE_URL.includes("TON_PROJET_LIEN")) {
    console.error("Les informations Supabase ne sont pas configurées. Veuillez mettre à jour js/config.js");
}

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
