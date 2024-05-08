import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import {
    Contract,
    Signer,
    Wallet,
    AbiCoder,
    keccak256,
    ZeroAddress,
} from 'ethers';

import { createNetwork, relay } from '@axelar-network/axelar-local-dev';
import { calculateExpectedTokenId } from './utils';
describe('TokenFactory', () => {
    let polygon: any;
    let avalanche: any;
    let TokenFactory: any;
    let AccessControl: any;
    let factoryProxy: Contract;
    let accessControlProxy: Contract;
    let deployer: Signer;

    let polygonUserWallet: Wallet;
    let avalancheUserWallet: Wallet;

    const burnRate = 10000;
    const txFeeRate = 20000;

    const abiCoder = new AbiCoder();

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
        [polygonUserWallet] = polygon.userWallets;
        [avalancheUserWallet] = avalanche.userWallets;
    });

    beforeEach(async () => {
        AccessControl = await ethers.getContractFactory('AccessControl');
        TokenFactory = await ethers.getContractFactory('TokenFactory');
        [deployer] = await ethers.getSigners();
        accessControlProxy = await upgrades.deployProxy(
            AccessControl,
            [await deployer.getAddress()],
            { initializer: 'initialize' }
        );
        factoryProxy = await upgrades.deployProxy(
            TokenFactory,
            [
                polygon.interchainTokenService.address,
                polygon.gasService.address,
                polygon.gateway.address,
                accessControlProxy.target,
            ],
            { initializer: 'initialize' }
        );
    });

    // afterEach(async () => {
    //     await relay();
    // });
    describe('initialize', () => {
        it('should set ITS address', async () => {
            expect(polygon.interchainTokenService.address).to.equal(
                await factoryProxy.s_its()
            );
        });
        it('should set gateway address', async () => {
            expect(polygon.gateway.address).to.equal(await factoryProxy.s_gateway());
        });
        it('should set gas service address', async () => {
            expect(polygon.gasService.address).to.equal(
                await factoryProxy.s_gasService()
            );
        });
        it('should set access control address', async () => {
            expect(accessControlProxy.target).to.equal(
                await factoryProxy.s_accessControl()
            );
        });
    });
    describe('deployRemoteSemiNativeToken', () => {
        describe('src', () => {
            it('should successfully trigger multichain tx', async () => {

                const saltItsToken = await factoryProxy.S_SALT_ITS_TOKEN();
                const saltProxy = await factoryProxy.S_SALT_PROXY();
                const expectedId = calculateExpectedTokenId(
                    abiCoder,
                    await factoryProxy.getAddress()
                );
                const payload = abiCoder.encode(
                    ['bytes32', 'bytes32', 'bytes32'],
                    [saltItsToken, saltProxy, expectedId]
                );
                const itsDeploymentParams = await factoryProxy.getItsDeploymentParams();
                console.log(itsDeploymentParams, 'itsdeploymentparams')

                await factoryProxy.deployRemoteSemiNativeToken('avalanche', itsDeploymentParams)
            });
        });
        describe('dest', () => { });
    });
    describe('deployHomeNative', () => {
        it('Should deploy new token at correct address', async () => {
            const itsDeploymentParams = await factoryProxy.getItsDeploymentParams();

            const types = ['bytes', 'address'];
            const decoded = abiCoder.decode(types, itsDeploymentParams);

            const expectedAddr = decoded[1];
            const expectedId = calculateExpectedTokenId(
                abiCoder,
                await factoryProxy.getAddress()
            );
            await expect(
                factoryProxy.deployHomeNative(itsDeploymentParams, burnRate, txFeeRate)
            )
                .to.emit(factoryProxy, 'NativeTokenDeployed')
                .withArgs(expectedAddr, expectedId);
        });
        it('Should save token to native tokens mapping', async () => {
            const itsDeploymentParams = await factoryProxy.getItsDeploymentParams();
            const types = ['bytes', 'address'];
            const decoded = abiCoder.decode(types, itsDeploymentParams);

            const expectedAddr = decoded[1];
            const tokensMappingBefore = await factoryProxy.s_nativeTokens('ethereum');
            expect(tokensMappingBefore).to.equal(ZeroAddress);
            await factoryProxy.deployHomeNative(
                itsDeploymentParams,
                burnRate,
                txFeeRate
            );
            const tokensMappingAfter = await factoryProxy.s_nativeTokens('ethereum');
            expect(tokensMappingAfter).to.equal(expectedAddr);
        });
    });
});
