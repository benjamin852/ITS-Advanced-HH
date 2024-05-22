import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import {
    Contract,
    ContractFactory,
    Signer,
    Wallet,
    AbiCoder,
    keccak256,
    ZeroAddress,
    encodeBytes32String,
} from 'ethers';

import { createNetwork, relay } from '@axelar-network/axelar-local-dev';

import { calculateExpectedTokenId } from './utils';
describe('TokenFactory', () => {
    let polygon: any;
    let avalanche: any;
    let TokenFactory: ContractFactory;
    let AccessControl: ContractFactory;
    let SemiNativeFactory: ContractFactory;
    let Deployer: ContractFactory;
    let factoryProxy: Contract;
    let accessControlProxy: Contract;
    let deployerProxy: Contract;
    let deployerEOA: Signer;

    let polygonUserWallet: Wallet;
    let avalancheUserWallet: Wallet;

    const burnRate = 10000;
    const txFeeRate = 20000;

    const abiCoder = new AbiCoder();

    before(async () => {
        upgrades.silenceWarnings();
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
        SemiNativeFactory = await ethers.getContractFactory("MultichainToken");
        AccessControl = await ethers.getContractFactory('AccessControl');
        TokenFactory = await ethers.getContractFactory('TokenFactory');
        Deployer = await ethers.getContractFactory('Deployer');

        [deployerEOA] = await ethers.getSigners();
        accessControlProxy = await upgrades.deployProxy(
            AccessControl,
            [await deployerEOA.getAddress()],
            { initializer: 'initialize' }
        );
        //1. More common for people to use hardhat deploy
        //2. Proxy we deploy in examples is not realistic
        //3. Upgrade upgradeable i'd rather use hardhat upgrade func
        const deployerProxy = await upgrades.deployProxy(
            Deployer,
            [
                polygon.interchainTokenService.address,
                accessControlProxy.target,
                polygon.gateway.address,
            ],
            {
                initializer: 'initialize',
                unsafeAllow: ['constructor', 'state-variable-immutable'],
            }
        );

        factoryProxy = await upgrades.deployProxy(
            TokenFactory,
            [
                polygon.interchainTokenService.address,
                polygon.gasService.address,
                polygon.gateway.address,
                accessControlProxy.target,
                deployerProxy.target,
                encodeBytes32String('polygon'),
            ],
            {
                initializer: 'initialize',
                unsafeAllow: ['constructor', 'state-variable-immutable'],
            }
        );
    });

    afterEach(async () => {
        await relay();
    });
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
        beforeEach(async () => {
            await factoryProxy.deployHomeNative(burnRate, txFeeRate);
        });
        describe('src', () => {

            it('should successfully deploy remote semi native token', async () => {
                // const saltItsToken = await factoryProxy.S_SALT_ITS_TOKEN();
                // const expectedId = calculateExpectedTokenId(
                //     abiCoder,
                //     await factoryProxy.getAddress()
                // );
                // const semiNativeFactoryBytecode = SemiNativeFactory.bytecode;
                // const abi = SemiNativeFactory.interface
                // const initializeFunction = abi.getFunction("initialize");
                // if (!initializeFunction) throw new Error('init func not found')
                // const initializeSelector: string = initializeFunction.selector;


                // const payload = abiCoder.encode(
                //     ['bytes32', 'bytes32', 'bytes32'],
                //     [saltItsToken, saltProxy, expectedId]
                // );


                // await expect(factoryProxy.deployRemoteSemiNativeToken('avalanche'))
                //     .to.emit(polygon.gateway, 'ContractCall')
                //     .withArgs(factoryProxy.address,
                //         avalanche.name,
                //         deployerProxy.address,
                //         hashedPayload,
                //         payload,);


                await factoryProxy.deployRemoteSemiNativeToken('avalanche', { value: 1e18.toString() })
            });

        });
        describe('dest', () => { });
    });
    describe('deployHomeNative', () => {
        const SALT_PROXY =
            '0x000000000000000000000000000000000000000000000000000000000000007B';
        it('Should deploy new token at correct address', async () => {
            const expectedAddr = await factoryProxy.getExpectedAddress(SALT_PROXY);
            const expectedId = calculateExpectedTokenId(
                abiCoder,
                await factoryProxy.getAddress()
            );
            await expect(factoryProxy.deployHomeNative(burnRate, txFeeRate))
                .to.emit(factoryProxy, 'NativeTokenDeployed')
                .withArgs(expectedAddr, expectedId);
        });
        it('Should save token to native tokens mapping', async () => {
            const expectedAddr = await factoryProxy.getExpectedAddress(SALT_PROXY);
            const tokensMappingBefore = await factoryProxy.s_nativeTokens(
                encodeBytes32String('polygon')
            );
            expect(tokensMappingBefore).to.equal(ZeroAddress);
            await factoryProxy.deployHomeNative(burnRate, txFeeRate);
            const tokensMappingAfter = await factoryProxy.s_nativeTokens(
                encodeBytes32String('polygon')
            );
            expect(tokensMappingAfter).to.equal(expectedAddr);
        });
    });
});
