import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { Contract, Signer, Wallet } from 'ethers';
import { createNetwork, relay } from '@axelar-network/axelar-local-dev';

describe('NativeTokenV1', function () {
    let polygon: any;
    let avalanche: any;
    let token: Contract;
    let accessControlProxy: Contract;
    let owner: Signer;
    let senderPolygon: Wallet;
    let receiverPolygon: Wallet;
    let receiverAvalanche: Wallet;

    const burnRate = 10000;
    const txFeeRate = 20000;

    before(async () => {
        // Initialize a Polygon network
        polygon = await createNetwork({
            name: 'Polygon',
            port: 1545,
        });

        // Initialize an Avalanche network
        avalanche = await createNetwork({
            name: 'Avalanche',
            port: 1546,
        });
        [senderPolygon, receiverPolygon] = polygon.userWallets;
        [receiverAvalanche] = avalanche.userWallets;
    });
    beforeEach(async function () {
        // Get signers
        [owner] = await ethers.getSigners();

        // Deploy AccessControl as an upgradeable contract
        const AccessControlFactory = await ethers.getContractFactory(
            'AccessControl'
        );
        accessControlProxy = await upgrades.deployProxy(AccessControlFactory, [await owner.getAddress()], {
            initializer: 'initialize',
        });

        // Deploy NativeTokenV1 as an upgradeable contract
        const NativeTokenV1 = await ethers.getContractFactory(
            'NativeTokenV1'
        );
        token = (await upgrades.deployProxy(
            NativeTokenV1,
            [accessControlProxy.target, polygon.interchainTokenService.address, burnRate, txFeeRate],
            {
                initializer: 'initialize',
            }
        ))

    });

    describe('Deployment', function () {
        it('Should set the right owner', async function () {
            expect(await accessControlProxy.isAdmin(await owner.getAddress())).to.be.true;
        });
        it('Should have the correct initial settings', async function () {
            expect(await token.s_accessControl()).to.equal(accessControlProxy.target);
            expect(await token.s_burnRate()).to.equal(burnRate);
            expect(await token.s_txFeeRate()).to.equal(txFeeRate);
            expect(await token.name()).to.equal("Interchain Token")
            expect(await token.symbol()).to.equal("ITS")
        });
    });
    /*
        describe('Transactions', function () {
            it('Should transfer tokens between accounts', async function () {
                await token.mint(owner.address, 1000);
                await token.transfer(receiver.address, 500);
                expect(await token.balanceOf(receiver.address)).to.equal(500);
                expect(await token.balanceOf(owner.address)).to.equal(500);
            });
    
            it('Should fail if sender doesn’t have enough tokens', async function () {
                const initialOwnerBalance = await token.balanceOf(owner.address);
                await expect(
                    token.connect(receiver).transfer(owner.address, 1)
                ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
                expect(await token.balanceOf(owner.address)).to.equal(
                    initialOwnerBalance
                );
            });
        });
    
        describe('Admin Functions', function () {
            it('Should allow admin to pause and unpause the token', async function () {
                await token.pause();
                await expect(token.transfer(receiver.address, 100)).to.be.revertedWith(
                    'Pausable: paused'
                );
    
                await token.unpause();
                await token.transfer(receiver.address, 100);
                expect(await token.balanceOf(receiver.address)).to.equal(100);
            });
    
            it('Only admin should be able to set burn rate and transaction fee', async function () {
                await expect(token.connect(receiver).setBurnRate(200)).to.be.revertedWith(
                    'OnlyAdmin'
                );
                await expect(token.connect(receiver).setTxFee(100)).to.be.revertedWith(
                    'OnlyAdmin'
                );
    
                await token.setBurnRate(200);
                expect(await token.s_burnRate()).to.equal(200);
    
                await token.setTxFee(100);
                expect(await token.s_txFeeRate()).to.equal(100);
            });
        });
    */
    // Add more tests as required for minting, reward claiming, etc.
});
