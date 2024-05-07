import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { createNetwork, relay } from '@axelar-network/axelar-local-dev';

describe("TokenFactory", () => {
    let polygon: any;
    let avalanche: any;
    let TokenFactory: any;
    let AccessControl: any;
    let factoryProxy: Contract
    let accessControlProxy: Contract
    let deployer: Signer;
    let addr1: Signer;

    let polygonUserWallet: Wallet;
    let avalancheUserWallet: Wallet;


    before(async () => {
        // Initialize a Polygon network
        polygon = await createNetwork({
            name: 'Polygon',
            port: 1545
        });

        // Initialize an Avalanche network
        avalanche = await createNetwork({
            name: 'Avalanche',
        });
        [polygonUserWallet] = polygon.userWallets;
        [avalancheUserWallet] = avalanche.userWallets;

    });

    beforeEach(async () => {
        AccessControl = await ethers.getContractFactory("AccessControl");
        TokenFactory = await ethers.getContractFactory("TokenFactory");
        [deployer, addr1] = await ethers.getSigners();
        accessControlProxy = await upgrades.deployProxy(AccessControl, [deployer.address], { initializer: 'initialize' })
        factoryProxy = await upgrades.deployProxy(TokenFactory, [polygon.interchainTokenService.address,
        polygon.gasService.address,
        polygon.gateway.address, accessControlProxy.target], { initializer: 'initialize' });
    });

    describe('initialize', () => {
        it('should set its address', async () => {
            expect(polygon.interchainTokenService.address).to.equal(await factoryProxy.s_its())
        })
        it('should set gateway address', async () => {
            expect(polygon.gateway.address).to.equal(await factoryProxy.s_gateway())
        })
        it('should set gas service address', async () => {
            expect(polygon.gasService.address).to.equal(await factoryProxy.s_gasService())
        })
        it('should set access control address', async () => {
            expect(accessControlProxy.target).to.equal(await factoryProxy.s_accessControl())
        })
    })
    describe("Deployment and Initialization", () => {
        it("Should set the right deployer", async function () {
            console.log(await factoryProxy.s_gateway(), 'gateway from storage')
            await factoryProxy.testMe()
            console.log(await factoryProxy.wazy(), 'the waz')
        });

    });

});
