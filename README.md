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

Expected, for a config that could hold the update: one update carrying `screen.js` and `generated.js`.

`yarn test` (Metro 0.87.2): the update carrying `screen.js` comes first, and `generated.js` follows in a second one.

```text
update 1: screen.js
update 2: generated.js
FAIL: the update carrying screen.js does not carry generated.js
```

`yarn test:held`, with the internal method replaced:

```text
update 1: screen.js, generated.js
PASS: screen.js and generated.js arrived in one update
```
