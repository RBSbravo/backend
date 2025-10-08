#!/usr/bin/env node

/**
 * Railway Deployment Helper Script
 * This script helps verify the deployment is ready
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Deployment Verification');
console.log('=====================================');

// Check if required files exist
const requiredFiles = [
  'package.json',
  'src/index.js',
  'src/app.js',
  'src/config/database.js',
  'src/models/index.js'
];

console.log('\n📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check package.json scripts
console.log('\n📦 Checking package.json scripts...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log('✅ start script exists');
  } else {
    console.log('❌ start script missing');
    allFilesExist = false;
  }
} catch (error) {
  console.log('❌ package.json is invalid');
  allFilesExist = false;
}

// Check environment variables
console.log('\n🔧 Checking environment variables...');
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MYSQL_HOST',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`⚠️  ${envVar} - not set (will use defaults)`);
  }
});

// Final result
console.log('\n🎯 Deployment Status:');
if (allFilesExist) {
  console.log('✅ Ready for Railway deployment!');
  console.log('\n📋 Next steps:');
  console.log('1. Push your code to GitHub');
  console.log('2. Connect Railway to your GitHub repo');
  console.log('3. Set environment variables in Railway');
  console.log('4. Deploy and test the health endpoint');
} else {
  console.log('❌ Deployment not ready - fix missing files first');
  process.exit(1);
}

console.log('\n🔗 Test endpoints after deployment:');
console.log('- Health: https://your-app.railway.app/api/health');
console.log('- Status: https://your-app.railway.app/api/status');
