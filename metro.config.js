const path = require('node:path');
const { watchAndBuild, generatedPath } = require('./build');

const builds = watchAndBuild();
const holdUpdates = process.argv.includes('--held');

// The workaround, with --held: Metro has no hook between a file change and the update it computes, so this replaces
// IncrementalBundler.updateGraph, which HmrServer calls, with one that first waits for the build and for Metro's
// file map to report what the build wrote.
const holdUpdatesForBuilds = (metroServer) => {
  const incrementalBundler = metroServer.getBundler();
  const fileMap = incrementalBundler.getBundler().getWatcher();
  const generated = path.relative(__dirname, generatedPath);
  let seenWrites = 0;
  let waiters = [];
  fileMap.on('change', ({ changes }) => {
    if ([...changes.modifiedFiles].some(([file]) => file === generated)) {
      seenWrites += 1;
      waiters = waiters.filter((waiter) => !waiter());
    }
  });
  const seen = (writes) =>
    new Promise((resolve) => {
      const waiter = () => seenWrites >= writes && (resolve(), true);
      if (!waiter()) waiters.push(waiter);
    });
  const updateGraph = incrementalBundler.updateGraph.bind(incrementalBundler);
  incrementalBundler.updateGraph = async (...parameters) => {
    await seen(await builds.writes());
    return updateGraph(...parameters);
  };
};

module.exports = {
  projectRoot: __dirname,
  watchFolders: [],
  server: {
    port: 8089,
    unstable_onServerCreated: (metroServer) => {
      if (holdUpdates) {
        holdUpdatesForBuilds(metroServer);
      }
    },
  },
};
