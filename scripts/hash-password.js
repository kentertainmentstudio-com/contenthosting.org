/**
 * Password Hashing Utility
 * 
 * Run with: node scripts/hash-password.js
 * Or: npm run hash-password
 * 
 * Enter your password when prompted, get the SHA-256 hash.
 */

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter password to hash: ', (password) => {
    if (!password) {
        console.error('Password cannot be empty');
        rl.close();
        process.exit(1);
    }
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    
    console.log('\n=== Password Hash ===');
    console.log('SHA-256:', hash);
    console.log('\nAdd this to your environment variables as ADMIN_PASSWORD_HASH');
    console.log('\nExample for .dev.vars:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    
    rl.close();
});
