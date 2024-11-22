const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

// Parse version
const versionMatch = packageJson.version.match(/^(\d+\.\d+\.\d+)-(\d+)\.(\d+)\.(\d+)$/);
if (!versionMatch) {
    // Initialize RAG version if not present
    const baseVersion = packageJson.version;
    packageJson.version = `${baseVersion}-0.0.1`;
} else {
    // Extract version parts
    const [, baseVersion, major, minor, patch] = versionMatch;
    
    // Convert to numbers
    let majorNum = parseInt(major, 10);
    let minorNum = parseInt(minor, 10);
    let patchNum = parseInt(patch, 10);

    // Increment with carrying
    patchNum++;
    if (patchNum > 9) {
        patchNum = 0;
        minorNum++;
        if (minorNum > 9) {
            minorNum = 0;
            majorNum++;
        }
    }

    // Update version
    packageJson.version = `${baseVersion}-${majorNum}.${minorNum}.${patchNum}`;
}

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version updated to: ${packageJson.version}`);
