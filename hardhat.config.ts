import dotenv from 'dotenv';
import { task, HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import '@nomicfoundation/hardhat-chai-matchers';
import 'hardhat-tracer';
import fs from 'fs-extra'; // Imported directly with TypeScript support
import chains from './chains.json';
import { getWallet } from './utils'
import { HardhatRuntimeEnvironment } from 'hardhat/types';

dotenv.config();

// Task to clean up the .openzeppelin directory
task(
  'cleanOpenZeppelin',
  'Removes the .openzeppelin directory',
  async (_, hre, runSuper) => {
    const directory = './.openzeppelin';
    if (fs.existsSync(directory)) {
      await fs.remove(directory);
      console.log('.openzeppelin directory removed successfully.');
    }
  }
);
task('deployRemoteBNB', 'deploy deployer on remote chain (BNB for testing').setAction(async (taskArgs, hre) => {
  const connectedWallet = getWallet(chains[1].rpc, hre)
  const AccessControl = await hre.ethers.getContractFactory('AccessControl');
  const Deployer = await hre.ethers.getContractFactory('Deployer');
  const accessControlProxy = await hre.upgrades.deployProxy(
    AccessControl,
    [connectedWallet.address],
    { initializer: 'initialize' }
  );
  const deployer = await hre.upgrades.deployProxy(Deployer, [
    accessControlProxy.target,
    chains[1].gateway
  ])
  console.log(`BNB deployer contract address: ${deployer.target}`)

})
task('deployHomeCelo', 'deploy factory on home chain, (celo for testing)')
  .addParam('deployer', 'Deployer on dest chain')
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const connectedWallet = getWallet(chains[0].rpc, hre)
    const AccessControl = await hre.ethers.getContractFactory('AccessControl');
    const TokenFactory = await hre.ethers.getContractFactory('TokenFactory');
    const accessControlProxy = await hre.upgrades.deployProxy(
      AccessControl,
      [connectedWallet.address],
      { initializer: 'initialize' }
    );
    const tokenFactory = await hre.upgrades.deployProxy(TokenFactory, [
      chains[0].its,
      chains[0].gasService,
      chains[0].gateway,
      accessControlProxy.target,
      taskArgs.deployer
    ])



    console.log(`celo contract address: ${tokenFactory.target}`)
  });

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Adjust the runs according to how often you expect to call the functions
      },
    },
  },
  networks: {
    hardhat: {
      blockGasLimit: 10000000, // Set higher gas limit
      initialBaseFeePerGas: 0, // Can help with estimating gas
    },
    polygonLocalTest: {
      url: 'http://localhost:1545', // Replace with the actual RPC URL if not local
    },
    celo: {
      url: chains[0].rpc,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: chains[0].chainId,
    },
    BNB: {
      url: chains[1].rpc,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      chainId: chains[1].chainId,
    },
  },

  mocha: {
    timeout: 120000, // Timeout for all tests in milliseconds
  },
};

export default config;
