-- Script SQL pour la base de données Supabase de PyApex

-- Activation de l'extension pour générer les UUID (généralement activée par défaut, mais au cas où)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Thèmes
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    difficulty INT NOT NULL CHECK (difficulty IN (1, 2, 3)),
    title TEXT NOT NULL,
    task_text TEXT NOT NULL, -- L'énoncé
    start_code TEXT NOT NULL,
    test_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Examens
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INT NOT NULL, -- temps en minutes
    access_code TEXT NOT NULL, -- code à 4 chiffres généré (ex: '8439')
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Questions Sélectionnées par Examen (Liaisons n-n)
-- Permet de sauvegarder le tirage aléatoire des 5 questions pour l'examen
CREATE TABLE exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    UNIQUE(exam_id, question_id)
);

-- Table: Étudiants assignés à l'examen (et historique de session)
CREATE TABLE exam_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    unique_exit_code TEXT NOT NULL, -- code à 4 chiffres généré par étudiant
    status TEXT NOT NULL DEFAULT 'pending', -- statuts possibles: 'pending', 'ongoing', 'finished'
    score INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    UNIQUE(exam_id, email)
);

-- Désactiver le "Row Level Security" temporairement sur toutes les tables
-- pour une utilisation simplifiée via l'admin et l'environnement avec 'anon key'
-- (Nous pourrons ajouter RLS plus tard si besoin de sécurité stricte, mais pour
-- le "MDP simple" sans système d'auth fort, c'est la voie la plus simple).
ALTER TABLE themes DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_students DISABLE ROW LEVEL SECURITY;
