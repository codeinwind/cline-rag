const { spawn } = require('child_process');
const path = require('path');

function startServer() {
    const python = process.platform === 'win32' ? 'venv\\Scripts\\python' : 'venv/bin/python';
    const flask = spawn(python, ['app.py'], {
        stdio: 'inherit',
        shell: true
    });

    flask.on('error', (error) => {
        console.error('Failed to start Flask server:', error);
    });

    process.on('SIGINT', () => {
        flask.kill();
        process.exit();
    });
}

startServer();
