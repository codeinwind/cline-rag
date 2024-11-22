const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitRepoRoot() {
    try {
        // Get git root directory
        const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
        return gitRoot;
    } catch (error) {
        console.error('Not a git repository or git not installed');
        process.exit(1);
    }
}

function copyFile(sourcePath, destinationPath) {
    try {
        fs.copyFileSync(sourcePath, destinationPath);
        console.log(`Copied ${path.basename(sourcePath)} to .rag directory`);
    } catch (error) {
        console.error(`Failed to copy ${path.basename(sourcePath)}:`, error);
        process.exit(1);
    }
}

function setupRagEnvironment() {
    const gitRoot = getGitRepoRoot();
    const ragDir = path.join(gitRoot, '.rag');
    const currentDir = path.dirname(__filename);

    // Create .rag directory if it doesn't exist
    if (!fs.existsSync(ragDir)) {
        fs.mkdirSync(ragDir);
        console.log('Created .rag directory');
    }

    // Create Python virtual environment
    try {
        if (!fs.existsSync(path.join(ragDir, 'venv'))) {
            console.log('Creating Python virtual environment...');
            execSync('python3 -m venv venv', { cwd: ragDir });
            
            // Install required packages
            const pip = process.platform === 'win32' ? 'venv\\Scripts\\pip' : 'venv/bin/pip';
            
            // Upgrade pip first
            execSync(`${pip} install --upgrade pip`, { cwd: ragDir });
            console.log('Upgraded pip');

            // Install FAISS CPU version first
            execSync(`${pip} install faiss-cpu`, { cwd: ragDir });
            console.log('Installed FAISS');

            // Install sentence-transformers for text embeddings
            execSync(`${pip} install sentence-transformers`, { cwd: ragDir });
            console.log('Installed sentence-transformers');

            // Install other required packages
            execSync(`${pip} install flask numpy`, { cwd: ragDir });
            console.log('Installed other required Python packages');
        }
    } catch (error) {
        console.error('Failed to create Python environment:', error);
        process.exit(1);
    }

    // Copy all necessary files
    const filesToCopy = [
        'app.py',
        'embedding_manager.py',
        'faiss_manager.py',
        'start.js',
        'README.md'
    ];

    for (const file of filesToCopy) {
        const sourcePath = path.join(currentDir, file);
        const destPath = path.join(ragDir, file);
        if (!fs.existsSync(destPath)) {
            copyFile(sourcePath, destPath);
        }
    }
}

// Run setup
setupRagEnvironment();
