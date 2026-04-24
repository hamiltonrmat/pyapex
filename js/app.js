// js/app.js

let pyodideInstance = null;
let monacoEditor = null;
let currentExamData = null;
let currentStudentData = null;
let examQuestions = []; // array of { question, assigned_code }
let currentQuestionIndex = 0;
let logsBuffer = "";

function initApp() {
    initPyodide();
    initMonaco();
    setupLogin();
    setupExamActions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function initPyodide() {
    try {
        consoleOutput("Loading Pyodide environment...");
        pyodideInstance = await loadPyodide({
            stdout: (text) => consoleOutput(text, "stdout"),
            stderr: (text) => consoleOutput(text, "stderr")
        });
        consoleOutput("Pyodide Ready!\n---");
    } catch (e) {
        consoleOutput("Error loading Pyodide: " + e.message, "stderr");
    }
}

function initMonaco() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        monacoEditor = monaco.editor.create(document.getElementById('monaco_editor'), {
            value: "# Votre code ici",
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14
        });
        
        // Save code dynamically when content changes safely
        monacoEditor.onDidChangeModelContent(() => {
            if (examQuestions[currentQuestionIndex]) {
                examQuestions[currentQuestionIndex].assigned_code = monacoEditor.getValue();
            }
        });
    });
}

function consoleOutput(text, type = "info") {
    const consoleDiv = document.getElementById('console_output');
    const div = document.createElement('div');
    div.style.color = type === 'stderr' ? 'var(--danger)' : '#0f0';
    if(type === 'info') div.style.color = 'var(--text-muted)';
    
    div.textContent = text;
    consoleDiv.appendChild(div);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function setupLogin() {
    const form = document.getElementById('login_form');
    const errorDiv = document.getElementById('login_error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('student_email').value.trim();
        const accessCode = document.getElementById('exam_access_code').value.trim();
        
        errorDiv.textContent = "Recherche de l'examen...";

        // 1. Fetch Open Exam matching accessCode
        const { data: exams, error: errExam } = await supabase
            .from('exams')
            .select('*')
            .eq('access_code', accessCode)
            .eq('is_open', true);

        if (errExam || exams.length === 0) {
            errorDiv.textContent = "Code d'accès invalide ou examen fermé.";
            return;
        }

        const exam = exams[0];

        // 2. Fetch Student Registration
        const { data: students, error: errStudent } = await supabase
            .from('exam_students')
            .select('*')
            .eq('exam_id', exam.id)
            .eq('email', email);

        if (errStudent || students.length === 0) {
            errorDiv.textContent = "Email non autorisé pour cet examen.";
            return;
        }

        const student = students[0];
        
        if (student.status === 'finished') {
            errorDiv.textContent = "Vous avez déjà terminé cet examen.";
            return;
        }

        // Cache session context
        currentExamData = exam;
        currentStudentData = student;
        
        // Start Exam context
        await initiateExamContext();
    });
}

async function initiateExamContext() {
    // Hide login, show exam
    document.getElementById('login_section').classList.add('hidden');
    document.getElementById('login_section').style.display = 'none';
    document.getElementById('exam_section').style.display = 'flex';
    document.getElementById('student_info_display').style.display = 'flex';
    document.getElementById('display_email').textContent = currentStudentData.email;

    // Load Questions!
    const { data: exQ, error } = await supabase
        .from('exam_questions')
        .select('question_id, order_index')
        .eq('exam_id', currentExamData.id)
        .order('order_index', { ascending: true });

    if (error || !exQ || exQ.length === 0) {
        alert("Erreur de chargement des questions. " + (error?.message || ""));
        return;
    }

    const qIds = exQ.map(q => q.question_id);
    const { data: questions } = await supabase.from('questions').select('*').in('id', qIds);

    // Sort accordingly to index
    examQuestions = exQ.map(eq => {
        const qData = questions.find(q => q.id === eq.question_id);
        return {
            order: eq.order_index,
            question: qData,
            assigned_code: qData.start_code
        }
    });

    renderQuestionNav();
    loadQuestion(0);
    startTimer();
}

function renderQuestionNav() {
    const nav = document.getElementById('questions_nav_pills');
    nav.innerHTML = examQuestions.map((q, idx) => 
        `<div class="nav-pill ${idx === 0 ? 'active' : ''}" onclick="loadQuestion(${idx})">Question ${idx + 1}</div>`
    ).join('');
}

window.loadQuestion = function(index) {
    if (index >= examQuestions.length || index < 0) return;
    
    // Update pills UI
    document.querySelectorAll('.nav-pill').forEach((el, i) => {
        if (i === index) el.classList.add('active');
        else el.classList.remove('active');
    });

    currentQuestionIndex = index;
    const qData = examQuestions[index].question;

    document.getElementById('q_title').textContent = qData.title;
    document.getElementById('q_diff').textContent = `Difficulté : Niveau ${qData.difficulty}`;
    document.getElementById('q_text').innerHTML = qData.task_text; // (For a true markdown rendering consider Marked.js, here using native mapping)

    if (monacoEditor) {
        monacoEditor.setValue(examQuestions[index].assigned_code);
    }
}

function setupExamActions() {
    document.getElementById('btn_run').addEventListener('click', runCode);
    document.getElementById('btn_test').addEventListener('click', runTests);
    document.getElementById('btn_submit_exam').addEventListener('click', submitExam);
}

async function runCode() {
    if (!pyodideInstance || !monacoEditor) return;
    document.getElementById('console_output').innerHTML = ''; // clear
    consoleOutput(">>> Execution en cours...", "info");
    const code = monacoEditor.getValue();
    try {
        await pyodideInstance.runPythonAsync(code);
        consoleOutput(">>> Execution terminée.", "info");
    } catch (e) {
        consoleOutput(e.toString(), "stderr");
    }
}

async function runTests() {
    if (!pyodideInstance || !monacoEditor) return;
    document.getElementById('console_output').innerHTML = ''; // clear
    
    const code = monacoEditor.getValue();
    const qData = examQuestions[currentQuestionIndex].question;
    const testCases = qData.test_examples || [];

    if (testCases.length === 0) {
        consoleOutput("Aucun test défini pour cette question.");
        return;
    }

    consoleOutput(`--- Lancement de ${testCases.length} tests ---`, "info");

    try {
        // Load the function definition
        await pyodideInstance.runPythonAsync(code);

        let passed = 0;
        for (let i = 0; i < testCases.length; i++) {
            const t = testCases[i];
            // Format input as string representing Python args, assume single dict/list/string mapping
            // Simpler evaluation via a wrapper:
            pyodideInstance.globals.set('__test_input', t.input);
            pyodideInstance.globals.set('__test_output', t.output);
            
            // Assume the function name is 'solution' if not explicit, but Python requires calling it.
            // In a robust system, the function name would be defined. We'll try to find the standard entry.
            // Let's evaluate using regex to find def fname():
            const funcMatch = code.match(/def[ ]+([a-zA-Z0-9_]+)[ ]*\(/);
            if (!funcMatch) {
                consoleOutput("❌ ERREUR: Impossible de trouver la définition d'une fonction.", "stderr");
                return;
            }
            const fName = funcMatch[1];

            // Pyodide dynamic run — input est toujours un tableau d'arguments
            const wrapperCode = `
import copy
res = ${fName}(*__test_input)
res == __test_output
`;
            const isCorrect = await pyodideInstance.runPythonAsync(wrapperCode);
            
            if (isCorrect) {
                consoleOutput(`✅ Test ${i+1} : Succès`);
                passed++;
            } else {
                consoleOutput(`❌ Test ${i+1} : Échoué (Résultat inattendu)`, "stderr");
            }
        }
        
        consoleOutput(`\nBilan : ${passed} / ${testCases.length} tests réussis.`, passed === testCases.length ? "info" : "stderr");
        
    } catch (e) {
        consoleOutput("❌ ERREUR: Lors de l'exécution : " + e.toString(), "stderr");
    }
}

async function submitExam() {
    if (!confirm("Attention, l'action est finale. Êtes-vous sûr de vouloir soumettre ?")) return;

    // Sauvegarder l'éditeur courant
    if(examQuestions[currentQuestionIndex]) {
        examQuestions[currentQuestionIndex].assigned_code = monacoEditor.getValue();
    }

    let globalPassed = 0;
    let globalTotal = 0;
    let answersToInsert = [];
    
    // In a real robust environment, verification goes on backend.
    // For this Serverless Pyodide layout, computing it here.
    try {
        for (const eq of examQuestions) {
            const studentCode = eq.assigned_code;
            const qData = eq.question;
            const vals = qData.validation_data || [];
            
            let qPassed = 0;
            
            if (vals.length > 0) {
                 globalTotal += vals.length;
                 try {
                     await pyodideInstance.runPythonAsync(studentCode);
                     const funcMatch = studentCode.match(/def[ ]+([a-zA-Z0-9_]+)[ ]*\(/);
                     if (funcMatch) {
                         const fName = funcMatch[1];
                         for (const v of vals) {
                             pyodideInstance.globals.set('__val_in', v.input);
                             pyodideInstance.globals.set('__val_out', v.output);
                             const wrapperCode = `
import copy
res = ${fName}(*__val_in)
res == __val_out
`;
                             const isCorrect = await pyodideInstance.runPythonAsync(wrapperCode);
                             if (isCorrect) qPassed++;
                         }
                     }
                 } catch (e) {
                     console.error("Erreur Python dans la copie:", e);
                 }
                 globalPassed += qPassed;
            }

            answersToInsert.push({
                exam_student_id: currentStudentData.id,
                question_id: qData.id,
                submitted_code: studentCode,
                passed_validations: qPassed,
                total_validations: vals.length
            });
        }
    } catch(e) {
        console.error("Scoring errors", e);
    }
    
    // Note sur 20 proportionnelle au pro-rata des validations
    let scoreVingt = 0;
    if (globalTotal > 0) {
        scoreVingt = (globalPassed / globalTotal) * 20;
        // Arrondir au demi point le plus proche
        scoreVingt = Math.round(scoreVingt * 2) / 2;
    }

    // Sauvegarder les lignes de copie étudiante (supprimer d'abord les anciennes si elles existent)
    if(answersToInsert.length > 0) {
        await supabase.from('student_answers').delete().eq('exam_student_id', currentStudentData.id);
        await supabase.from('student_answers').insert(answersToInsert);
    }

    // Mise à jour finale du statut de l'étudiant
    const { error } = await supabase
        .from('exam_students')
        .update({ 
            status: 'finished', 
            score: scoreVingt,
            finished_at: new Date().toISOString()
        })
        .eq('id', currentStudentData.id);

    if (error) {
        alert("Erreur ligne serveur : " + error.message);
        return;
    }

    // Terminate UI
    document.getElementById('exam_section').style.display = 'none';
    document.getElementById('finish_section').style.display = 'flex';
    
    // Configurer le bouton de validation de la sortie
    document.getElementById('btn_validate_exit').onclick = () => {
        const val = document.getElementById('student_exit_code_input').value.trim();
        if(val === currentStudentData.unique_exit_code) {
            document.getElementById('finish_section').style.display = 'none';
            document.getElementById('success_exit_section').style.display = 'flex';
        } else {
            document.getElementById('exit_error').textContent = "Code incorrect. Veuillez demander le code à votre professeur.";
        }
    };
}

let timerInterval;
function startTimer() {
    const timerDisplay = document.getElementById('exam_timer');
    // Simple duration based timer
    let timeRemaining = currentExamData.duration * 60; // in seconds

    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = "00:00:00";
            alert("Temps écoulé! L'examen va se terminer.");
            submitExam();
            return;
        }
        
        timeRemaining--;
        const h = Math.floor(timeRemaining / 3600).toString().padStart(2, '0');
        const m = Math.floor((timeRemaining % 3600) / 60).toString().padStart(2, '0');
        const s = (timeRemaining % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${h}:${m}:${s}`;

        if (timeRemaining < 300) { // less than 5 min
            timerDisplay.style.color = "var(--danger)";
        }
    }, 1000);
}
