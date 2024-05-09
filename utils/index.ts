import { HardhatRuntimeEnvironment } from 'hardhat/types'

export const getWallet = (rpc: string, hre: HardhatRuntimeEnvironment) => {

    const key = process.env.PRIVATE_KEY
    if (!key) { throw new Error('invalid key') }

    const provider = hre.ethers.getDefaultProvider(rpc)
    const wallet = new hre.ethers.Wallet(key, provider);
    const connectedWallet = wallet.connect(provider)

    return connectedWallet
}