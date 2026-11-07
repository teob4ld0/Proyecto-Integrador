import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const services = [
  { name: 'BACKEND', color: '\x1b[36m', args: ['--prefix', './Backend', 'run', 'dev'] },
  { name: 'FRONTEND', color: '\x1b[35m', args: ['--prefix', './Frontend', 'run', 'dev'] },
];

const reset = '\x1b[0m';
const children = [];

console.log('\nStarting Danmakrew unified workspace...');
console.log('  -> Web + Game UI : http://localhost:3000');
console.log('  -> REST API      : http://localhost:8080/api');
console.log('  -> WebSockets    : ws://localhost:9001 (/signal & /game)\n');

function prefixStream(stream, prefix) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim().length > 0) {
        process.stdout.write(`${prefix} ${line}\n`);
      }
    }
  });
}

for (const svc of services) {
  const child = spawn(npmCmd, svc.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  });
  const tag = `${svc.color}[${svc.name}]${reset}`;
  prefixStream(child.stdout, tag);
  prefixStream(child.stderr, tag);
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${tag} exited with code ${code}`);
    }
  });
  children.push(child);
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

