const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());

// Sert les fichiers statiques (le fichier index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Connexion stricte à la base demandée
const dbPath = 'C:/Reseau haridex/WEB/historique.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Erreur de connexion SQLite:", err.message);
    } else {
        console.log("✅ Connecté et sécurisé sur SQLite :", dbPath);
        initDB();
    }
});

// Création des tables si elles n'existent pas encore
function initDB() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS projects (name TEXT PRIMARY KEY)`);
        db.run(`CREATE TABLE IF NOT EXISTS activities (name TEXT PRIMARY KEY)`);
        db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, date TEXT, project TEXT, activity TEXT, start_time INTEGER, end_time INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS current_tracking (user TEXT PRIMARY KEY, project TEXT, activity TEXT, start_time INTEGER)`);
        
        // Valeurs par défaut si les tables sont totalement vides
        db.get("SELECT COUNT(*) as count FROM projects", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO projects (name) VALUES ('Projet A'), ('Projet B')`);
            }
        });
        db.get("SELECT COUNT(*) as count FROM activities", (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO activities (name) VALUES ('Production'), ('Pause'), ('Réunion')`);
            }
        });
    });
}

// --- ROUTES DE L'API ---

// 1. Récupérer toutes les données au chargement de la page
app.get('/api/data', (req, res) => {
    let responseData = { projects: [], activities: [], logs: [], current_tracking: [] };
    
    db.all("SELECT name FROM projects", (err, projs) => {
        if(projs) responseData.projects = projs.map(r => r.name);
        
        db.all("SELECT name FROM activities", (err, acts) => {
            if(acts) responseData.activities = acts.map(r => r.name);
            
            db.all("SELECT user, date, project, activity, start_time as start, end_time as end FROM logs", (err, logs) => {
                if(logs) responseData.logs = logs;
                
                db.all("SELECT user, project, activity, start_time as start FROM current_tracking", (err, curr) => {
                    if(curr) responseData.current_tracking = curr;
                    res.json(responseData);
                });
            });
        });
    });
});

// 2. Ajouter un Projet
app.post('/api/project', (req, res) => {
    db.run(`INSERT OR IGNORE INTO projects (name) VALUES (?)`, [req.body.name], (err) => {
        res.json({ success: !err });
    });
});

// 3. Ajouter une Activité
app.post('/api/activity', (req, res) => {
    db.run(`INSERT OR IGNORE INTO activities (name) VALUES (?)`, [req.body.name], (err) => {
        res.json({ success: !err });
    });
});

// 4. Démarrer ou Changer un chrono en direct
app.post('/api/start', (req, res) => {
    const { user, project, activity, start } = req.body;
    db.run(`REPLACE INTO current_tracking (user, project, activity, start_time) VALUES (?, ?, ?, ?)`,
        [user, project, activity, start], (err) => {
            res.json({ success: !err });
        });
});

// 5. Clôturer un chrono et le basculer dans l'historique
app.post('/api/finish', (req, res) => {
    const { user, date, project, activity, start, end } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO logs (user, date, project, activity, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
            [user, date, project, activity, start, end]);
        db.run(`DELETE FROM current_tracking WHERE user = ?`, [user]);
        res.json({ success: true });
    });
});

// Lancement du serveur
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur Web local démarré : Ouvre http://localhost:${PORT} dans ton navigateur`);
});