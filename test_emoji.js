
const prefix = '⚡';
const body = '⚡ping';
const isCmd = body.startsWith(prefix);
const command = isCmd ? body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

console.log(`Prefix: ${prefix}`);
console.log(`Body: ${body}`);
console.log(`Is Cmd: ${isCmd}`);
console.log(`Command: ${command}`);

const prefix2 = '🤖';
const body2 = '🤖menu';
console.log(`---`);
console.log(`Prefix: ${prefix2}`);
console.log(`Body: ${body2}`);
console.log(`Command: ${body2.startsWith(prefix2) ? body2.slice(prefix2.length) : ''}`);
