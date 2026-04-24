// js/admin.js

let monacoCodeEditor;
let monacoTestsEditor;
let monacoValEditor;

function initMonacoAdmin() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        monacoCodeEditor = monaco.editor.create(document.getElementById('q_code_editor'), {
            value: "def solution(x):\n    # Votre code ici\n    return x",
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });
        
        monacoTestsEditor = monaco.editor.create(document.getElementById('q_tests_editor'), {
            value: '[\n  {\n    "input": [1],\n    "output": 1\n  }\n]',
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });

        monacoValEditor = monaco.editor.create(document.getElementById('q_val_editor'), {
            value: '[\n  {\n    "input": [1],\n    "output": 1\n  }\n]',
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });
    });
}

function initAdmin() {
    const loginSection = document.getElementById('admin_login_section');
    const dashboardSection = document.getElementById('admin_dashboard');
    const loginForm = document.getElementById('admin_login_form');
    const errorMsg = document.getElementById('admin_login_error');

    let isLoggedIn = sessionStorage.getItem('admin_logged') === 'true';

    function initAuth() {
        if (isLoggedIn) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            dashboardSection.style.display = 'flex';
            adminUI.init();
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('admin_pwd').value;
        if (pwd === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_logged', 'true');
            isLoggedIn = true;
            initAuth();
        } else {
            errorMsg.textContent = "Mot de passe incorrect.";
        }
    });

    document.getElementById('btn_logout').addEventListener('click', () => {
        sessionStorage.removeItem('admin_logged');
        window.location.href = 'index.html';
    });

    initAuth();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}

const adminUI = {
    currentView: 'view_themes',
    
    init() {
        this.setupNavigation();
        this.loadThemes();
        initMonacoAdmin();
    },

    setupNavigation() {
        document.querySelectorAll('.admin-sidebar .nav-item').forEach(item => {
            if (!item.hasAttribute('data-target')) return;
            item.addEventListener('click', (e) => {
                document.querySelectorAll('.admin-sidebar .nav-item').forEach(nav => nav.classList.remove('active'));
                e.target.classList.add('active');
                
                document.querySelectorAll('.admin-view').forEach(view => view.classList.add('hidden'));
                const target = e.target.getAttribute('data-target');
                const targetEl = document.getElementById(target);
                if (targetEl) targetEl.classList.remove('hidden');
                
                if (target === 'view_themes') this.loadThemes();
                if (target === 'view_questions') this.loadQuestions();
                if (target === 'view_exams') this.loadExams();
            });
        });
    },

    // --- THEMES ---
    async loadThemes() {
        const tbody = document.getElementById('themes_table_body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="2">Chargement...</td></tr>';
        
        try {
            const { data, error } = await supabase.from('themes').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2">Aucun thème trouvé.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(t => `
                <tr>
                    <td>${t.name}</td>
                    <td>
                        <button class="btn btn-primary btn-small" onclick="adminUI.editTheme('${t.id}', '${t.name.replace(/'/g, "\\'")}')">Éditer</button>
                        <button class="btn btn-secondary btn-small" onclick="adminUI.deleteTheme('${t.id}')">Supprimer</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="2" style="color:var(--danger)">Erreur de chargement (vérifiez avoir lancé le script SQL)</td></tr>';
        }
    },

    async openThemeModal() {
        const name = prompt("Nom du nouveau thème :");
        if (!name) return;
        const { error } = await supabase.from('themes').insert([{ name }]);
        if (error) alert("Erreur lors de la création : " + error.message);
        else this.loadThemes();
    },

    async editTheme(id, currentName) {
        const name = prompt("Renommer le thème :", currentName);
        if (!name || name === currentName) return;
        const { error } = await supabase.from('themes').update({ name }).eq('id', id);
        if (error) alert("Erreur lors de la modification : " + error.message);
        else this.loadThemes();
    },

    async deleteTheme(id) {
        if (!confirm("Voulez-vous vraiment supprimer ce thème ? Les questions associées seront aussi supprimées.")) return;
        const { error } = await supabase.from('themes').delete().eq('id', id);
        if (error) alert("Erreur de suppression : " + error.message);
        else this.loadThemes();
    },

    // --- QUESTIONS ---
    async loadQuestions() {
        const tbody = document.getElementById('questions_table_body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4">Chargement...</td></tr>';
        
        try {
            const { data, error } = await supabase.from('questions').select('*, themes(name)').order('created_at', { ascending: false });
            if (error) throw error;
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">Aucune question trouvée.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(q => `
                <tr>
                    <td>${q.title}</td>
                    <td>${q.themes?.name || 'Inconnu'}</td>
                    <td>Niveau ${q.difficulty}</td>
                    <td>
                        <button class="btn btn-primary btn-small" onclick="adminUI.editQuestion('${q.id}')">Éditer</button>
                        <button class="btn btn-secondary btn-small" onclick="adminUI.deleteQuestion('${q.id}')">Supprimer</button>
                    </td>
                </tr>
            `).join('');
        } catch(err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger)">Erreur de chargement</td></tr>';
        }
    },

    async openQuestionModal() {
        document.getElementById('modal_question_title').textContent = "Créer une Question";
        document.getElementById('q_id').value = "";
        if(monacoCodeEditor) monacoCodeEditor.setValue("def solution(x):\n    # Votre code ici\n    return x");
        if(monacoTestsEditor) monacoTestsEditor.setValue("[\n  {\n    \"input\": [1],\n    \"output\": 1\n  }\n]");
        if(monacoValEditor) monacoValEditor.setValue("[\n  {\n    \"input\": [1],\n    \"output\": 1\n  }\n]");
        document.getElementById('modal_question').classList.remove('hidden');
        setTimeout(() => { monacoCodeEditor?.layout(); monacoTestsEditor?.layout(); monacoValEditor?.layout(); }, 50);
        this.fillThemeSelect();
    },

    async editQuestion(id) {
        const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
        if(error) return alert("Erreur chargement question : " + error.message);
        
        document.getElementById('modal_question_title').textContent = "Éditer la Question";
        document.getElementById('q_id').value = data.id;
        document.getElementById('q_title_input').value = data.title;
        document.getElementById('q_diff').value = data.difficulty;
        document.getElementById('q_task').value = data.task_text;
        if(monacoCodeEditor) monacoCodeEditor.setValue(data.start_code);
        if(monacoTestsEditor) monacoTestsEditor.setValue(JSON.stringify(data.test_examples, null, 2));
        if(monacoValEditor) monacoValEditor.setValue(JSON.stringify(data.validation_data, null, 2));
        
        document.getElementById('modal_question').classList.remove('hidden');
        setTimeout(() => { monacoCodeEditor?.layout(); monacoTestsEditor?.layout(); monacoValEditor?.layout(); }, 50);
        await this.fillThemeSelect();
        document.getElementById('q_theme').value = data.theme_id;
    },
    
    closeQuestionModal() {
        document.getElementById('modal_question').classList.add('hidden');
        document.getElementById('form_question').reset();
        document.getElementById('q_id').value = "";
    },

    async fillThemeSelect() {
        const select = document.getElementById('q_theme');
        select.innerHTML = '<option value="">Chargement...</option>';
        const { data, error } = await supabase.from('themes').select('id, name');
        if (error || !data) {
            select.innerHTML = '<option value="">Erreur</option>';
            return;
        }
        select.innerHTML = data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    },

    async saveQuestion(e) {
        e.preventDefault();
        const theme_id = document.getElementById('q_theme').value;
        const difficulty = parseInt(document.getElementById('q_diff').value);
        const title = document.getElementById('q_title_input').value;
        const task_text = document.getElementById('q_task').value;
        const start_code = monacoCodeEditor ? monacoCodeEditor.getValue() : "";

        let test_examples, validation_data;
        try {
            test_examples = JSON.parse((monacoTestsEditor ? monacoTestsEditor.getValue() : "[]") || "[]");
            validation_data = JSON.parse((monacoValEditor ? monacoValEditor.getValue() : "[]") || "[]");
        } catch(e) {
            alert("Erreur de format JSON pour les tests/validations.");
            return;
        }

        const q_id = document.getElementById('q_id').value;
        const payload = { theme_id, difficulty, title, task_text, start_code, test_examples, validation_data };
        
        let error;
        if (q_id) {
            const res = await supabase.from('questions').update(payload).eq('id', q_id);
            error = res.error;
        } else {
            const res = await supabase.from('questions').insert([payload]);
            error = res.error;
        }

        if (error) {
            alert("Erreur: " + error.message);
        } else {
            this.closeQuestionModal();
            this.loadQuestions();
        }
    },

    async deleteQuestion(id) {
        if (!confirm("Voulez-vous vraiment supprimer cette question ?")) return;
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) alert("Erreur : " + error.message);
        else this.loadQuestions();
    },

    // --- EXAMS ---
    async loadExams() {
         const tbody = document.getElementById('exams_table_body');
         if (!tbody) return;
         tbody.innerHTML = '<tr><td colspan="6">Chargement...</td></tr>';
         
         const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
         if (error) {
             console.error(error);
             return;
         }
         
         if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Aucun examen de programmé.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(e => `
            <tr>
                <td>${e.title}</td>
                <td>${e.exam_date} ${e.start_time} - ${e.end_time}</td>
                <td>${e.duration} min</td>
                <td class="highlight-text">${e.access_code}</td>
                <td>${e.is_open ? '<span style="color:var(--success)">Ouvert</span>' : '<span style="color:var(--danger)">Fermé</span>'}</td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="adminUI.showExamDetails('${e.id}', '${e.title.replace(/'/g, "\\'")}', '${e.access_code}')">Détails</button>
                    <button class="btn btn-primary btn-small" onclick="adminUI.editExam('${e.id}')">Éditer</button>
                    <button class="btn btn-secondary btn-small" onclick="adminUI.deleteExam('${e.id}')">Supprimer</button>
                    ${e.is_open 
                        ? `<button class="btn btn-secondary btn-small" onclick="adminUI.toggleExam('${e.id}', false)">Fermer</button>` 
                        : `<button class="btn btn-secondary btn-small" onclick="adminUI.toggleExam('${e.id}', true)">Ouvrir</button>`
                    }
                </td>
            </tr>
        `).join('');
    },

    async openExamModal() {
        document.getElementById('modal_exam_title').textContent = "Planifier un Examen";
        document.getElementById('e_id').value = "";
        document.getElementById('e_csv').required = true;
        document.getElementById('e_csv_help').style.display = 'none';
        document.getElementById('e_questions_config_group').style.display = 'block';
        document.getElementById('btn_save_exam').textContent = "Planifier l'Examen";
        document.getElementById('modal_exam').classList.remove('hidden');
        this.fillExamThemeSelects();
    },

    async fillExamThemeSelects() {
        const { data, error } = await supabase.from('themes').select('id, name');
        if (error || !data) return;
        const options = '<option value="">Choisir un thème</option>' + data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        document.querySelectorAll('.q-theme-sel').forEach(sel => sel.innerHTML = options);
    },

    async editExam(id) {
        const { data, error } = await supabase.from('exams').select('*').eq('id', id).single();
        if(error) return alert("Erreur chargement examen : " + error.message);
        
        document.getElementById('modal_exam_title').textContent = "Éditer l'Examen";
        document.getElementById('e_id').value = data.id;
        document.getElementById('e_title').value = data.title;
        document.getElementById('e_date').value = data.exam_date;
        document.getElementById('e_start').value = data.start_time;
        document.getElementById('e_end').value = data.end_time;
        document.getElementById('e_duration').value = data.duration;
        
        document.getElementById('e_csv').required = false;
        document.getElementById('e_csv_help').style.display = 'inline';
        document.getElementById('e_questions_config_group').style.display = 'none';
        document.getElementById('btn_save_exam').textContent = "Enregistrer les modifications";
        
        document.getElementById('modal_exam').classList.remove('hidden');
    },

    async showExamDetails(examId, title, code) {
        document.getElementById('view_exams').classList.add('hidden');
        document.getElementById('view_exam_details').classList.remove('hidden');
        document.getElementById('detail_exam_title').textContent = title;
        document.getElementById('detail_exam_code').textContent = code;

        const tbody = document.getElementById('exam_students_table_body');
        tbody.innerHTML = '<tr><td colspan="4">Chargement des étudiants...</td></tr>';

        const { data, error } = await supabase
            .from('exam_students')
            .select('*')
            .eq('exam_id', examId)
            .order('last_name', { ascending: true });

        if (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger)">Erreur de chargement.</td></tr>';
            return;
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Aucun étudiant inscrit à cet examen.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(s => `
            <tr>
                <td>${s.last_name || '-'}</td>
                <td>${s.first_name || '-'}</td>
                <td>${s.email}</td>
                <td class="highlight-text" style="font-weight:700;">${s.unique_exit_code}</td>
                <td>${s.status === 'finished' ? '<span style="color:var(--success)">Terminé</span>' : s.status === 'ongoing' ? '<span style="color:var(--warning)">En cours</span>' : '<span style="color:var(--text-muted)">En attente</span>'}</td>
                <td>${s.status === 'finished' ? `<strong>${s.score !== null ? s.score : 0} / 20</strong>` : '-'}</td>
                <td style="display:flex; gap:0.5rem; justify-content:center;">
                    ${s.status === 'finished' ? `<button class="btn btn-primary btn-small" onclick="adminUI.viewStudentCopy('${s.id}')" title="Voir la copie">🔍</button>` : ''}
                    <button class="btn btn-secondary btn-small" onclick="adminUI.resetStudentAttempt('${s.id}', '${examId}', '${title.replace(/'/g, "\\'")}', '${code}')" title="Réinitialiser la tentative">🔄</button>
                </td>
            </tr>
        `).join('');
    },

    closeExamDetails() {
        document.getElementById('view_exam_details').classList.add('hidden');
        document.getElementById('view_exams').classList.remove('hidden');
    },

    async viewStudentCopy(studentId) {
        try {
            document.getElementById('copy_title').textContent = "Chargement...";
            document.getElementById('copy_score').textContent = "";
            const container = document.getElementById('copy_answers_container');
            container.innerHTML = '<p>Chargement de la copie...</p>';
            document.getElementById('modal_student_copy').classList.remove('hidden');

            // Récupérer le nom et score de l'étudiant
            const { data: stData } = await supabase.from('exam_students').select('first_name, last_name, score').eq('id', studentId).single();
            if (stData) {
                document.getElementById('copy_title').textContent = `Copie de ${stData.first_name || ''} ${stData.last_name || ''}`;
                document.getElementById('copy_score').textContent = `Score total : ${stData.score !== null ? stData.score : 0} / 20`;
            } else {
                document.getElementById('copy_title').textContent = "Copie Étudiant";
            }

            const { data: answers, error } = await supabase
                .from('student_answers')
                .select(`
                    *,
                    questions (
                        title,
                        task_text
                    )
                `)
                .eq('exam_student_id', studentId);

            if (error) {
                container.innerHTML = `<p class="error-msg">Erreur de chargement : ${error.message}</p>`;
                return;
            }

            if (!answers || answers.length === 0) {
                container.innerHTML = `<p>Aucune réponse historique trouvée.</p>`;
                return;
            }

            container.innerHTML = answers.map((ans) => `
                <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 6px; border-left: 4px solid ${ans.passed_validations === ans.total_validations && ans.total_validations > 0 ? 'var(--success)' : 'var(--warning)'}">
                    <h4 style="margin-bottom: 0.5rem; display:flex; justify-content:space-between;">
                        <span>Question : ${ans.questions?.title || 'Inconnue'}</span>
                        <span>Validations: ${ans.passed_validations} / ${ans.total_validations}</span>
                    </h4>
                    <p style="font-size: 0.9em; color: var(--text-muted); margin-bottom: 0.5rem;">${(ans.questions?.task_text || '').substring(0, 150)}...</p>
                    <div style="background: #1e1e1e; padding: 0.5rem; border-radius: 4px; overflow-x: auto;">
                        <pre style="margin:0;"><code style="color:#d4d4d4; font-family: monospace;">${(ans.submitted_code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            alert("Erreur d'interface Javascript : " + e.message);
        }
    },

    closeStudentCopy() {
        document.getElementById('modal_student_copy').classList.add('hidden');
    },

    async resetStudentAttempt(studentId, examId, title, code) {
        if (!confirm("Voulez-vous vraiment réinitialiser la tentative de cet étudiant ? Il pourra repasser l'examen de zéro.")) return;
        
        // Supprimer les anciennes réponses de la copie
        await supabase.from('student_answers').delete().eq('exam_student_id', studentId);
        
        const { error } = await supabase.from('exam_students').update({
            status: 'pending',
            score: 0,
            started_at: null,
            finished_at: null
        }).eq('id', studentId);
        if (error) {
            alert("Erreur lors de la réinitialisation : " + error.message);
        } else {
            this.showExamDetails(examId, title, code);
        }
    },

    closeExamModal() {
        document.getElementById('modal_exam').classList.add('hidden');
        document.getElementById('form_exam').reset();
        document.getElementById('e_id').value = "";
    },

    async saveExam(e) {
        e.preventDefault();
        const e_id = document.getElementById('e_id').value;
        const title = document.getElementById('e_title').value;
        const exam_date = document.getElementById('e_date').value;
        const start_time = document.getElementById('e_start').value;
        const end_time = document.getElementById('e_end').value;
        const duration = parseInt(document.getElementById('e_duration').value);
        
        const csvFile = document.getElementById('e_csv').files[0];

        try {
            if (e_id) {
                // MODE EDITION
                const { error: updErr } = await supabase.from('exams').update({
                    title, exam_date, start_time, end_time, duration
                }).eq('id', e_id);
                if(updErr) throw updErr;

                // Ajout CSV optionnel
                if (csvFile) {
                    const csvText = await csvFile.text();
                    const students = this.parseCSV(csvText);
                    let studentsToInject = students.filter(s => s.email !== 'test.examen@etu.unilasalle.fr').map(s => ({
                        exam_id: e_id, email: s.email, first_name: s.first_name, last_name: s.last_name, unique_exit_code: Math.floor(1000 + Math.random() * 9000).toString()
                    }));
                    if(studentsToInject.length > 0) {
                        await supabase.from('exam_students').upsert(studentsToInject, { onConflict: 'exam_id, email' });
                    }
                }
                this.closeExamModal();
                this.loadExams();
                return;
            }

            // MODE CREATION
            if (!csvFile) {
                alert("Il faut fournir un fichier CSV pour les étudiants.");
                return;
            }

            // Génération dynamique des 5 questions via bloc strict (Thème + Difficulté)
            const themeSels = document.querySelectorAll('.q-theme-sel');
            const diffSels = document.querySelectorAll('.q-diff-sel');
            let selectedQuestions = [];
            let usedQuestionIds = new Set(); // Pour éviter de tirer la même question 2 fois

            for (let i = 0; i < 5; i++) {
                const t_id = themeSels[i].value;
                const diff = parseInt(diffSels[i].value);
                const { data: qData, error: qErr } = await supabase.from('questions')
                    .select('id')
                    .eq('theme_id', t_id)
                    .eq('difficulty', diff);
                
                if (qErr) throw qErr;
                
                // On exclut les questions déjà piochées dans l'examen
                const availableQs = qData.filter(q => !usedQuestionIds.has(q.id));
                
                if (availableQs.length === 0) {
                    throw new Error(`Stock insuffisant pour Q${i+1} : Vous n'avez pas assez de questions DIFFERENTES dans le thème et la difficulté choisis. (Ajoutez-en ou modifiez la config de l'examen).`);
                }
                
                // Tirage aléatoire d'une question pour ce slot
                const randomQ = availableQs[Math.floor(Math.random() * availableQs.length)];
                selectedQuestions.push({ question_id: randomQ.id, order_index: i + 1 });
                usedQuestionIds.add(randomQ.id); // On la marque comme utilisée
            }

            const access_code = Math.floor(1000 + Math.random() * 9000).toString();
            
            const csvText = await csvFile.text();
            const students = this.parseCSV(csvText);

            const { data: examData, error: examError } = await supabase.from('exams').insert([{
                title, exam_date, start_time, end_time, duration, access_code
            }]).select();

            if (examError) throw examError;
            const examId = examData[0].id;

            selectedQuestions = selectedQuestions.map(sq => ({ ...sq, exam_id: examId }));
            const { error: eqErr } = await supabase.from('exam_questions').insert(selectedQuestions);
            if (eqErr) throw new Error("Erreur insertion questions : " + eqErr.message);

            let studentsToInject = students
                .filter(s => s.email !== 'test.examen@etu.unilasalle.fr')
                .map(s => ({
                    exam_id: examId, email: s.email, first_name: s.first_name, last_name: s.last_name, unique_exit_code: Math.floor(1000 + Math.random() * 9000).toString()
            }));

            studentsToInject.push({
                exam_id: examId, email: 'test.examen@etu.unilasalle.fr', first_name: 'Test', last_name: 'Examen', unique_exit_code: 'apex42'
            });

            if (studentsToInject.length > 0) {
                 const { error: insErr } = await supabase.from('exam_students').insert(studentsToInject);
                 if (insErr) throw new Error("Erreur insertion étudiants: " + insErr.message);
            }

            this.closeExamModal();
            this.loadExams();

        } catch (error) {
            console.error(error);
            alert("Erreur lors de la sauvegarde : " + error.message);
        }
    },

    parseCSV(text) {
        // Assume format: email,first_name,last_name sans headers
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        return lines.map(line => {
            const parts = line.split(',');
            return {
                email: parts[0]?.trim(),
                first_name: parts[1]?.trim() || '',
                last_name: parts[2]?.trim() || ''
            };
        }).filter(s => s.email);
    },

    async deleteExam(id) {
        if (!confirm("Voulez-vous vraiment supprimer cet examen (tout l'historique sera effacé) ?")) return;
        const { error } = await supabase.from('exams').delete().eq('id', id);
        if (error) alert("Erreur : " + error.message);
        else this.loadExams();
    },

    async toggleExam(id, isOpen) {
        await supabase.from('exams').update({ is_open: isOpen }).eq('id', id);
        this.loadExams();
    }
};

function initAdminListeners() {
    const qForm = document.getElementById('form_question');
    const eForm = document.getElementById('form_exam');
    if(qForm) qForm.addEventListener('submit', (e) => adminUI.saveQuestion(e));
    if(eForm) eForm.addEventListener('submit', (e) => adminUI.saveExam(e));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminListeners);
} else {
    initAdminListeners();
}
