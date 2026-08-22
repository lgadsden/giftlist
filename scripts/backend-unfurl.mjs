#!/usr/bin/env node
/**
 * Start edge functions + Playwright unfurl sidecar for local gift scraping.
 * Usage: npm run backend:unfurl
 */
import { spawn } from 'node:child_process';

const kids = [];

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    console.log(`[${name}] exited`, code ?? signal);
    for (const k of kids) {
      if (k !== child) k.kill('SIGTERM');
    }
    process.exit(code ?? 1);
  });
  kids.push(child);
}

run('functions', 'npx', ['supabase', 'functions', 'serve']);
run('playwright', 'node', ['scripts/unfurl-browser.mjs']);

function shutdown() {
  for (const k of kids) k.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
