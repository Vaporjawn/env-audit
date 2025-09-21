import { readFileSync } from 'fs';

// Read the built version to see what's happening
const cliContent = readFileSync('./dist/cli.js', 'utf8');

// Look for the mergeOptions function
const mergeOptionsMatch = cliContent.match(/mergeOptions.*?{[\s\S]*?(?=\n\w|\n\})/);

if (mergeOptionsMatch) {
  console.log('Found mergeOptions in built CLI:');
  console.log(mergeOptionsMatch[0].substring(0, 500) + '...');
} else {
  console.log('mergeOptions not found in built CLI');
}

// Also let's check the DEFAULT_SCAN_OPTIONS
const defaultOptionsMatch = cliContent.match(/DEFAULT_SCAN_OPTIONS.*?{[\s\S]*?include[\s\S]*?\]/);

if (defaultOptionsMatch) {
  console.log('\nFound DEFAULT_SCAN_OPTIONS in built CLI:');
  console.log(defaultOptionsMatch[0]);
} else {
  console.log('DEFAULT_SCAN_OPTIONS not found in built CLI');
}