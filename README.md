# metro-hold-update-for-generated-module

A module that a tool derives from another file reaches the app one hot-reload update after the change that made it, and nothing public in Metro lets a config make that update wait.

- `index.js` requires `screen.js`, which names a class, and `generated.js`, which holds the styles for it.
- `build.js` stands in for the tool (a CSS compiler, a code generator): whenever `screen.js` changes it writes `generated.js` from it, taking 300 ms.
- `metro.config.js` starts that build. With `--held` it also replaces `IncrementalBundler.updateGraph` on Metro's server so each update first waits for the build and for the file map to report its output: the only way I found to get the two files into one update.
- `test.js` starts Metro, requests the bundle, registers it on `/hot`, changes the class in `screen.js`, and prints each update until one carries `generated.js`.

## Steps

```sh
yarn install
yarn test
yarn test:held
```

`yarn test` exits 1 while the update carrying `screen.js` does not carry `generated.js`, 0 once one update carries
both, and 2 when a step fails. `yarn test:held` runs the same with the internal method replaced, as the behaviour a
supported hook would give.
