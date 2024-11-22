const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function startServer(ragPath) {
    if (!fs.existsSync(ragPath)) {
        console.error('RAG directory not found. Please run setup first.');
        process.exit(1);
    }

    console.log('Starting RAG server...');
    
    const isWindows = process.platform === 'win32';
    const python = path.join(ragPath, 'venv', isWindows ? 'Scripts' : 'bin', 'python');
    const appPath = path.join(ragPath, 'app.py');

    if (!fs.existsSync(python)) {
        console.error('Python virtual environment not found. Please run setup first.');
        process.exit(1);
    }

    if (!fs.existsSync(appPath)) {
        console.error('Flask application not found. Please run setup first.');
        process.exit(1);
    }

    const flask = spawn(python, [appPath], {
        cwd: ragPath,
        stdio: 'inherit'
    });

    flask.on('error', (error) => {
        console.error('Failed to start Flask server:', error);
        process.exit(1);
    });

    process.on('SIGINT', () => {
        flask.kill();
        process.exit();
    });

    // Log server status
    console.log('RAG server started successfully');
}

// If running directly (not through the extension)
if (require.main === module) {
    const gitRoot = require('child_process').execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    const ragPath = path.join(gitRoot, '.rag');
    startServer(ragPath);
}

module.exports = { startServer };
