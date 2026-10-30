// A stand-in for a tool that derives a module from other files (a CSS compiler, a code generator): it writes
// generated.js from screen.js, and like a real one it takes a while.
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const BUILD_DURATION_MS = 300;

const screenPath = path.join(__dirname, 'screen.js');
const generatedPath = path.join(__dirname, 'generated.js');

const generatedSource = (screenSource) => {
  const className = /className:\s*'([^']+)'/.exec(screenSource)?.[1] ?? 'card';
  return `module.exports = { styles: { ${className}: { padding: 8 } } };\n`;
};

// Rebuilds whenever screen.js changes. `writes()` settles, once the builds started so far have finished, to the
// number of times generated.js has been written.
const watchAndBuild = () => {
  let writeCount = 0;
  let builds = Promise.resolve(writeCount);
  const build = async () => {
    const source = generatedSource(fs.readFileSync(screenPath, 'utf8'));
    await delay(BUILD_DURATION_MS);
    if (fs.readFileSync(generatedPath, 'utf8') !== source) {
      fs.writeFileSync(generatedPath, source);
      writeCount += 1;
    }
    return writeCount;
  };
  fs.watch(screenPath, () => {
    builds = builds.then(build);
  });
  return { writes: () => builds };
};

module.exports = { watchAndBuild, screenPath, generatedPath };
