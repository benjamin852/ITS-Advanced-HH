import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades"
import "hardhat-contract-sizer";


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
