// Starts Metro with metro.config.js, registers the bundle for hot reload, edits screen.js, and prints every update
// Metro sends until one carries generated.js. Exits 1 when the update carrying screen.js does not carry generated.js,
// 0 when one update carries both, and 2 when a step fails.
const fs = require('node:fs');
const path = require('node:path');
const Metro = require('metro');
const { screenPath, generatedPath } = require('./build');

const HOST = '127.0.0.1';
const UPDATE_TIMEOUT_MS = 10_000;

const originals = new Map([screenPath, generatedPath].map((file) => [file, fs.readFileSync(file, 'utf8')]));
const restore = () => {
  for (const [file, source] of originals) fs.writeFileSync(file, source);
};

const held = process.argv.includes('--held');
const mode = held ? 'updates held' : 'no hold';

const modulesOf = (update) =>
  [...update.added, ...update.modified].map(({ sourceMappingURL }) => path.basename(new URL(sourceMappingURL).pathname).replace(/(\.js)?\.map$/, '.js'));

const main = async () => {
  const config = await Metro.loadConfig({ config: path.join(__dirname, 'metro.config.js') });
  const { httpServer } = await Metro.runServer(config, { host: HOST });
  const bundleUrl = `http://${HOST}:${config.server.port}/index.bundle?platform=ios&dev=true&minify=false`;
  console.log(`Metro ${require('metro/package.json').version}, ${mode}`);

  const response = await fetch(bundleUrl);
  console.log(`bundle: HTTP ${response.status}`);
  await response.text();

  const socket = new WebSocket(`ws://${HOST}:${config.server.port}/hot`);
  const updates = [];
  let finished = false;
  const done = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`no update carried generated.js within ${UPDATE_TIMEOUT_MS} ms`)), UPDATE_TIMEOUT_MS);
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === 'bundle-registered') {
        fs.writeFileSync(screenPath, "module.exports = { className: 'banner' };\n");
        console.log('edited screen.js: className card -> banner');
      } else if (message.type === 'update' && !message.body.isInitialUpdate && !finished) {
        const modules = modulesOf(message.body);
        updates.push(modules);
        console.log(`update ${updates.length}: ${modules.join(', ')}`);
        if (modules.includes('generated.js')) {
          finished = true;
          clearTimeout(timeout);
          resolve();
        }
      } else if (message.type === 'error') {
        console.log(`error: ${JSON.stringify(message.body)}`);
      }
    });
  });
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'register-entrypoints', entryPoints: [bundleUrl] })));

  try {
    await done;
  } finally {
    socket.close();
    httpServer.close();
    restore();
  }
  const withScreen = updates.find((modules) => modules.includes('screen.js'));
  if (withScreen === undefined) {
    console.log('SUMMARY: step failed: no update carried screen.js');
    process.exit(2);
  }
  if (!withScreen.includes('generated.js')) {
    console.log(`SUMMARY: defect (${mode}): the update carrying screen.js does not carry generated.js, which reached the app ${updates.length - updates.indexOf(withScreen) - 1} update(s) later`);
    process.exit(1);
  }
  console.log(`SUMMARY: fixed (${mode}): screen.js and generated.js arrived in one update`);
  process.exit(0);
};

main().catch((error) => {
  restore();
  console.error(error);
  console.log(`SUMMARY: step failed: ${error.message}`);
  process.exit(2);
});
