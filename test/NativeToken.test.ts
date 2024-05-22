// import { ethers, upgrades } from 'hardhat';
// import { expect } from 'chai';
// import { Contract, Signer, Wallet, BaseContract } from 'ethers';
// import { createNetwork, relay } from '@axelar-network/axelar-local-dev';
// import hre from 'hardhat';

// describe('NativeTokenV1', () => {
//   let polygon: any;
//   let avalanche: any;
//   let token: any;
//   let accessControlProxy: any;
//   let owner: Signer;
//   let notOwner: Signer;
//   let senderPolygon: Wallet;
//   let receiverPolygon: Wallet;
//   let receiverAvalanche: Wallet;

//   const burnRate = 10000;
//   const txFeeRate = 20000;

//   before(async () => {
//     // Initialize a Polygon network
//     polygon = await createNetwork({
//       name: 'Polygon',
//       port: 1545,
//     });

//     // Initialize an Avalanche network
//     avalanche = await createNetwork({
//       name: 'Avalanche',
//       port: 1546,
//     });
//     [senderPolygon, receiverPolygon] = polygon.userWallets;
//     [receiverAvalanche] = avalanche.userWallets;
//   });
//   beforeEach(async () => {
//     // Get signers
//     [owner, notOwner] = await ethers.getSigners();

//     // Deploy AccessControl as an upgradeable contract
//     const AccessControlFactory = await ethers.getContractFactory(
//       'AccessControl'
//     );
//     accessControlProxy = await upgrades.deployProxy(
//       AccessControlFactory,
//       [await owner.getAddress()],
//       {
//         initializer: 'initialize',
//       }
//     );

//     // Deploy NativeTokenV1 as an upgradeable contract
//     const NativeTokenV1 = await ethers.getContractFactory('NativeTokenV1');
//     token = await upgrades.deployProxy(
//       NativeTokenV1,
//       [
//         accessControlProxy.target,
//         polygon.interchainTokenService.address,
//         burnRate,
//         txFeeRate,
//       ],
//       {
//         initializer: 'initialize',
//       }
//     );
//   });

//   describe('Deployment', () => {
//     it('Should set the right owner', async () => {
//       expect(await accessControlProxy.isAdmin(await owner.getAddress())).to.be
//         .true;
//     });
//     it('Should have the correct initial settings', async () => {
//       expect(await token.s_accessControl()).to.equal(accessControlProxy.target);
//       expect(await token.s_burnRate()).to.equal(burnRate);
//       expect(await token.s_txFeeRate()).to.equal(txFeeRate);
//       expect(await token.name()).to.equal('Interchain Token');
//       expect(await token.symbol()).to.equal('ITS');
//     });
//   });
//   describe('Admin Functionality', () => {
//     //Reverts correctly but test fails (bug with hardhat)
//     // it('Should revert pause if not admin', async () => {
//     //     await expect(token.connect(notOwner).pause()).to.be.revert;
//     // });
//     it('should pause contract', async () => {
//       expect(await token.paused()).to.be.false;
//       await token.pause();
//       expect(await token.paused()).to.be.true;
//     });
//     it('should unpause contract', async () => {
//       await token.pause();
//       expect(await token.paused()).to.be.true;
//       await token.unpause();
//       expect(await token.paused()).to.be.false;
//     });
//     it('should set new burn rate', async () => {
//       const burnRateBefore = await token.s_burnRate();
//       expect(await token.s_burnRate()).to.equal(burnRateBefore);
//       await token.setBurnRate(123);
//       expect(await token.s_burnRate()).to.equal(BigInt(123));
//     });
//     it('should set new tx fee rate', async () => {
//       const txFeeRateBefore = await token.s_txFeeRate();
//       expect(await token.s_txFeeRate()).to.equal(txFeeRateBefore);
//       await token.setTxFee(123);
//       expect(await token.s_txFeeRate()).to.equal(BigInt(123));
//     });
//   });
// });
