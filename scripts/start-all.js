import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const processes = [];

function start(name, cwd, command, args, color) {
  const proc = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.log(`${prefix} ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.error(`${prefix} ${line}`);
    });
  });

  proc.on('exit', (code) => {
    console.log(`${prefix} exited (code ${code})`);
  });

  processes.push(proc);
  return proc;
}

console.log('\n  \x1b[1mREBASE — Starting all services\x1b[0m\n');

start('SIMULATOR', join(root, 'simulator'), 'node', ['server.js'], '35');

await new Promise(r => setTimeout(r, 2000));

start('BACKEND', join(root, 'backend'), 'node', ['server.js'], '36');

await new Promise(r => setTimeout(r, 2000));

start('DASHBOARD', root, 'npx', ['vite', '--host'], '33');

await new Promise(r => setTimeout(r, 1000));

start('STOREFRONT', join(root, 'storefront'), 'npx', ['vite', '--host'], '34');

process.on('SIGINT', () => {
  console.log('\n  Shutting down all services...');
  processes.forEach(p => p.kill());
  process.exit(0);
});

process.on('SIGTERM', () => {
  processes.forEach(p => p.kill());
  process.exit(0);
});
