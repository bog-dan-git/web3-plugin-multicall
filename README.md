# Web3.js Multicall Plugin

This is a [web3.js](https://github.com/web3/web3.js) `4.x` plugin for interacting with Multicall contracts.

## Prerequisites

-   :gear: [NodeJS](https://nodejs.org/) (LTS/Fermium)
-   :toolbox: [Yarn](https://yarnpkg.com/)
-   :computer: [web3.js](https://github.com/web3/web3.js) >= `4.0.2`

## Installation

```bash
yarn add web3-plugin-multicall
```

## Using this plugin

### Installing Version `4.x` of `web3`

When adding the `web3` package to your project, make sure to use version `4.x`:

-   `npm i -S web3@4.0.3`
-   `yarn add web3@4.0.3`


To verify you have the correct `web3` version installed, after adding the package to your project (the above commands), look at the versions listed in your project's `package.json` under the `dependencies` section, it should contain version 4.x similar to:

```json
"dependencies": {
	"web3": "4.0.3"
}
```
### Registering the Plugin with a web3.js Instance

After importing `MulticallPlugin` from `web3-plugin-multicall` and `Web3` from `web3`, register an instance of `ChainlinkPlugin` with an instance of `Web3` like so:

```typescript
import { MulticallPlugin } from 'web3-plugin-multicall';
import { Web3 } from 'web3';

const web3 = new Web3('YOUR_PROVIDER_URL');
const multicallPlugin = new MulticallPlugin();

web3.registerPlugin(multicallPlugin);
```

More information about registering web3.js plugins can be found [here](https://docs.web3js.org/docs/guides/web3_plugin_guide/plugin_users#registering-the-plugin).

Please, note that the default address is set to `0xcA11bde05977b3631167028862bE2a173976CA11`, as specified [here](https://www.multicall3.com/).

You might however want to change it when using testnets, for example:

```typescript
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallPlugin = new MulticallPlugin(MULTICALL_ADDRESS);
```
### Plugin Methods

#### Multicall

This one is a game-changer. It lets you call multiple methods in one go using the Multicall contract.

#### `makeMulticall`

```typescript
makeMulticall(methods: Methods, params?: MulticallConfig): Promise<MethodResults>;
```

Let's see it in action:
```typescript
const web3 = new Web3(new HttpProvider(RPC_URL));
web3.registerPlugin(new MulticallPlugin());

const contract = new web3.eth.Contract(poolAbi, poolAddress);

const [tickSpacing, fee, liquidity, slot0] = await web3.multicall.makeMulticall([
  contract.methods.tickSpacing(), 
  contract.methods.fee(), 
  contract.methods.liquidity(), 
  contract.methods.slot0()
]);
```

You can even use it with multiple contracts. Imagine calling methods from different contracts in one shot:


```typescript
const web3 = new Web3(new HttpProvider(RPC_URL));
web3.registerPlugin(new MulticallPlugin());

const pool1 = new web3.eth.Contract(poolAbi1, poolAddress1);
const pool2 = new web3.eth.Contract(poolAbi2, poolAddress2);

const [tickSpacing1, tickSpacing2] = await web3.multicall.makeMulticall([
  pool1.methods.tickSpacing(),
  pool2.methods.tickSpacing(),
]);
```

> **_NOTE:_** Contracts have to be created using web3 instance that has the plugin registered, so the following example won't work:
> ```typescript
> import { Contract, Web3 } from 'web3';
> import { MulticallPlugin } from 'web3-plugin-multicall';
> const web3 = new Web3();
> web3.registerPlugin(new MulticallPlugin());
> // This is not the correct way to create a contract
> const contract = new Contract(abi, address);
> // This won't work
> await web3.multicall.makeMulticall([contract.methods.method1(), contract.methods.method2()]);
>
