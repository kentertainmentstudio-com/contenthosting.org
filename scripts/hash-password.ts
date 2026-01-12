/**
 * Password Hashing Utility
 * 
 * Run with: npx tsx scripts/hash-password.ts
 * Or: npm run hash-password
 * 
 * Enter your password when prompted, get the SHA-256 hash.
 */

import * as crypto from 'crypto';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter password to hash: ', (password: string) => {
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
