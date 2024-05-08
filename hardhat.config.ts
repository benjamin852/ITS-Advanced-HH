import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades"
import "hardhat-contract-sizer";
import '@nomicfoundation/hardhat-chai-matchers'
import 'hardhat-tracer'
import fs from 'fs-extra'; // Imported directly with TypeScript support

// Task to clean up the .openzeppelin directory
task("cleanOpenZeppelin", "Removes the .openzeppelin directory", async (_, hre, runSuper) => {
  const directory = './.openzeppelin';
  if (fs.existsSync(directory)) {
    await fs.remove(directory);
    console.log('.openzeppelin directory removed successfully.');
  }
});



const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200 // Adjust the runs according to how often you expect to call the functions
      }
    }
  },
  networks: {
    hardhat: {
      blockGasLimit: 10000000,  // Set higher gas limit
      initialBaseFeePerGas: 0,  // Can help with estimating gas
    },
    polygon: {
      url: "http://localhost:1545",  // Replace with the actual RPC URL if not local
    },
  },

  mocha: {
    timeout: 120000 // Timeout for all tests in milliseconds
  }
};

export default config;
