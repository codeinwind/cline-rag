const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function setupRagEnvironment(workspaceRoot) {
    if (!workspaceRoot) {
        console.error('Workspace root path is required');
        process.exit(1);
    }

    const ragDir = path.join(workspaceRoot, '.rag');
    const currentDir = path.dirname(__filename);

    console.log('Setting up RAG environment...');
    console.log(`Current directory: ${currentDir}`);
    console.log(`Workspace root: ${workspaceRoot}`);
    console.log(`RAG directory: ${ragDir}`);

    // Create .rag directory if it doesn't exist
    if (!fs.existsSync(ragDir)) {
        fs.mkdirSync(ragDir);
        console.log('Created .rag directory');
    }

    // Create Python virtual environment
    try {
        if (!fs.existsSync(path.join(ragDir, 'venv'))) {
            console.log('Creating Python virtual environment...');
            
            // Check Python version and availability
            try {
                const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' });
                console.log(`Using ${pythonVersion.trim()}`);
            } catch (error) {
                try {
                    const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
                    console.log(`Using ${pythonVersion.trim()}`);
                } catch (error) {
                    console.error('Python is not installed or not in PATH');
                    process.exit(1);
                }
            }

            // Create virtual environment using available Python command
            try {
                execSync('python3 -m venv venv', { cwd: ragDir });
            } catch (error) {
                execSync('python -m venv venv', { cwd: ragDir });
            }
            
            // Install required packages
            const pip = process.platform === 'win32' ? 'venv\\Scripts\\pip' : 'venv/bin/pip';
            
            // Upgrade pip first
            console.log('Upgrading pip...');
            execSync(`"${path.join(ragDir, pip)}" install --upgrade pip`, { cwd: ragDir });

            // Install FAISS CPU version first
            console.log('Installing FAISS...');
            execSync(`"${path.join(ragDir, pip)}" install faiss-cpu`, { cwd: ragDir });

            // Install sentence-transformers for text embeddings
            console.log('Installing sentence-transformers...');
            execSync(`"${path.join(ragDir, pip)}" install sentence-transformers`, { cwd: ragDir });

            // Install other required packages
            console.log('Installing other required packages...');
            execSync(`"${path.join(ragDir, pip)}" install flask numpy`, { cwd: ragDir });
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

    console.log('Copying necessary files...');
    for (const file of filesToCopy) {
        const sourcePath = path.join(currentDir, file);
        const destPath = path.join(ragDir, file);
        if (!fs.existsSync(sourcePath)) {
            console.error(`Source file not found: ${sourcePath}`);
            process.exit(1);
        }
        if (!fs.existsSync(destPath)) {
            copyFile(sourcePath, destPath);
        }
    }

    console.log('RAG environment setup completed successfully!');
}

function copyFile(sourcePath, destinationPath) {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(destinationPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.copyFileSync(sourcePath, destinationPath);
        console.log(`Copied ${path.basename(sourcePath)} to .rag directory`);
    } catch (error) {
        console.error(`Failed to copy ${path.basename(sourcePath)}:`, error);
        process.exit(1);
    }
}

// Check if workspace root is provided as command line argument
const workspaceRoot = process.argv[2];
if (workspaceRoot) {
    setupRagEnvironment(workspaceRoot);
} else {
    console.error('Please provide workspace root path as argument');
    process.exit(1);
}
