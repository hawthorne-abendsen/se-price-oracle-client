/*eslint-disable no-undef */
const crypto = require('crypto')
const {exec} = require('child_process')
const {Keypair, Server, TransactionBuilder, Operation} = require('soroban-client')
const {default: BigNumber} = require('bignumber.js')
const Client = require('../src')
const AssetType = require('../src/asset-type')
const contractConfig = require('./contract.config')

if (contractConfig.assets.length < 2)
    throw new Error('Need at least 2 assets to run tests')

const initAssetLength = 1

const extraAsset = {type: AssetType.GENERIC, code: 'JPY'}

const assetToString = (asset) => `${asset.type}:${asset.code}`

const priceToString = (price) => `{price: ${price.price.toString()}, timestamp: ${price.timestamp.toString()}}`


function normalize_timestamp(timestamp) {
    return Math.floor(timestamp / contractConfig.resolution) * contractConfig.resolution
}
const MAX_I128 = new BigNumber('170141183460469231731687303715884105727')
const ADJUSTED_MAX = MAX_I128.dividedBy(new BigNumber(`1e+${contractConfig.decimals}`)) //divide by 10^14
initTimestamp = normalize_timestamp(Date.now())
period = contractConfig.resolution * 10

let admin
let account
let nodesKeypairs
let contractId
/**
 * @type {Client}
 */
let client

function getMajority(totalSignersCount) {
    return Math.floor(totalSignersCount / 2) + 1
}

async function sendTransaction(server, tx) {
    let result = await server.sendTransaction(tx)
    const hash = result.hash
    while (result.status === 'PENDING' || result.status === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000))
        result = await server.getTransaction(hash)
    }
    if (result.status !== 'SUCCESS') {
        throw new Error(`Failed to create multisig account: ${result}`)
    }
    return result
}

async function prepare() {
    admin = Keypair.random()
    nodesKeypairs = Array.from({length: 5}, () => (Keypair.random()))
    const server = new Server(contractConfig.horizonUrl)

    async function deployContract() {
        const command = `soroban contract deploy --wasm ./test/se_price_oracle.wasm --source ${admin.secret()} --rpc-url ${contractConfig.horizonUrl} --network-passphrase "${contractConfig.network}"`
        return await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`)
                    reject(error)
                    return
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`)
                    reject(new Error(stderr))
                    return
                }
                resolve(stdout.trim())
            })
        })
    }

    async function createAdminAccount() {
        await server.requestAirdrop(admin.publicKey(), 'https://friendbot-futurenet.stellar.org')
    }
    await createAdminAccount()
    contractId = await deployContract()

    account = await server.getAccount(admin.publicKey())

    async function updateAdminToMultiSigAccount() {
        const majorityCount = getMajority(nodesKeypairs.length)
        let txBuilder = new TransactionBuilder(account, {fee: 100, networkPassphrase: contractConfig.network})
        txBuilder = txBuilder
            .setTimeout(30000)
            .addOperation(
                Operation.setOptions({
                    masterWeight: 0,
                    lowThreshold: majorityCount,
                    medThreshold: majorityCount,
                    highThreshold: majorityCount
                })
            )

        for (const nodeKeypair of nodesKeypairs) {
            txBuilder = txBuilder.addOperation(
                Operation.setOptions({
                    signer: {
                        ed25519PublicKey: nodeKeypair.publicKey(),
                        weight: 1
                    }
                })
            )
        }

        const tx = txBuilder.build()

        tx.sign(admin)

        await sendTransaction(server, tx)
    }

    await updateAdminToMultiSigAccount()

    client = new Client(contractConfig.network, contractConfig.horizonUrl, contractId)
}

function generateRandomI128() {
    //Generate a random 128-bit number
    const buffer = crypto.randomBytes(16) //Generate 16 random bytes = 128 bits
    const hex = buffer.toString('hex') //Convert to hexadecimal
    let randomNum = new BigNumber(hex, 16) //Convert hex to BigNumber

    const MAX_RANGE = new BigNumber(2).pow(128)
    randomNum = randomNum.dividedBy(MAX_RANGE).times(ADJUSTED_MAX).integerValue(BigNumber.ROUND_DOWN)

    return randomNum
}

function signTransaction(transaction) {
    const shuffledSigners = nodesKeypairs.sort(() => 0.5 - Math.random())
    const selectedSigners = shuffledSigners.slice(0, getMajority(nodesKeypairs.length))
    const txHash = transaction.hash()
    const signatures = []
    for (const signer of selectedSigners) {
        const signature = signer.signDecorated(txHash)
        signatures.push(signature)
    }
    return signatures
}

const txOptions = {
    minAccountSequence: '0',
    fee: 1000
}

beforeAll(async () => {
    await prepare()
}, 3000000)

test('config', async () => {
    const tx = await client.config(account, {
        admin: admin.publicKey(),
        assets: contractConfig.assets.slice(0, initAssetLength),
        period,
        baseFee: new BigNumber(1000),
        version: 1
    }, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 300000)

test('add_assets', async () => {
    const tx = await client.addAssets(account, contractConfig.assets.slice(initAssetLength), txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)
}, 300000)

test('set_price', async () => {

    let timestamp = initTimestamp

    for (let i = 0; i < 3; i++) {
        const prices = []
        for (const asset of contractConfig.assets)
            prices.push({asset, price: generateRandomI128()})

        const tx = await client.setPrice(
            account,
            prices,
            timestamp,
            txOptions
        )

        const signatures = signTransaction(tx)

        const response = await client.submitTransaction(tx, signatures)

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 300000)

test('set_price', async () => {

    let timestamp = initTimestamp

    for (let i = 0; i < 3; i++) {
        const prices = []
        for (const asset of contractConfig.assets)
            prices.push({asset, price: generateRandomI128()})

        const tx = await client.setPrice(
            account,
            prices,
            timestamp,
            txOptions
        )

        const signatures = signTransaction(tx)

        const response = await client.submitTransaction(tx, signatures)

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 300000)

test('set_price (extra price)', async () => {

    let timestamp = initTimestamp
    contractConfig.assets.push(extraAsset)
    for (let i = 0; i < 3; i++) {
        const prices = []
        for (const asset of contractConfig.assets)
            prices.push({asset, price: generateRandomI128()})

        const tx = await client.setPrice(
            account,
            prices,
            timestamp,
            txOptions
        )

        const signatures = signTransaction(tx)

        const response = await client.submitTransaction(tx, signatures)

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 300000)

test('add_asset (extra asset)', async () => {
    const tx = await client.addAssets(account, [extraAsset], txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)
}, 300000)

test('config_version', async () => {
    const tx = await client.configVersion(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

    const version = Client.parseNumberResult(response.resultMetaXdr)

    expect(version).toBe(1)

}, 300000)

//TODO: add test for get_price for extra asset before adding it (must be null) and after adding it (must be valid price)

test('admin', async () => {

    const tx = await client.admin(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const adminPublicKey = Client.parseAdminResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Admin: ${adminPublicKey}`)

    expect(admin.publicKey()).toBe(adminPublicKey)

}, 3000000)

test('base', async () => {

    const tx = await client.base(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const base = Client.parseBaseResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Base: ${assetToString(base)}`)

    expect(base !== null && base !== undefined).toBe(true)

}, 3000000)


test('decimals', async () => {

    const tx = await client.decimals(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const decimals = Client.parseNumberResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Decimals: ${decimals}`)

    expect(decimals).toBe(contractConfig.decimals)

}, 300000)

test('resolution', async () => {

    const tx = await client.resolution(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const resolution = Client.parseNumberResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Resolution: ${resolution}`)

    expect(resolution).toBe(contractConfig.resolution / 1000) //in seconds

}, 300000)

test('period', async () => {

    const tx = await client.period(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const periodValue = Client.parseNumberResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Period: ${periodValue}`)

    expect(periodValue).toBe(period)

}, 300000)

test('assets', async () => {

    const tx = await client.assets(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const assets = Client.parseAssetsResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Assets: ${assets.map(a => assetToString(a)).join(', ')}`)

    expect(assets.length).toEqual(contractConfig.assets.length)

}, 300000)

test('price', async () => {
    const tx = await client.price(account, contractConfig.assets[1], initTimestamp, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const price = Client.parsePriceResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Price: ${priceToString(price)}`)

    expect(price).toBeDefined()
}, 300000)

test('x_price', async () => {

    const tx = await client.xPrice(account,
        contractConfig.assets[0],
        contractConfig.assets[1],
        initTimestamp,
        txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const price = Client.parsePriceResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Price: ${priceToString(price)}`)

    expect(price).toBeDefined()

}, 300000)

test('lastprice', async () => {

    const tx = await client.lastPrice(account, contractConfig.assets[0], txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const price = Client.parsePriceResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Price: ${priceToString(price)}`)

    expect(price).toBeDefined()

}, 300000)

test('x_lt_price', async () => {

    const tx = await client.xLastPrice(account, contractConfig.assets[0], contractConfig.assets[1], txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const price = Client.parsePriceResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Price: ${priceToString(price)}`)

    expect(price).toBeDefined()

}, 300000)

test('prices', async () => {

    const tx = await client.prices(account, contractConfig.assets[0], 3, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const prices = Client.parsePricesResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Prices: ${prices.map(p => priceToString(p)).join(', ')}`)

    expect(prices.length > 0).toBe(true)

}, 300000)

test('x_prices', async () => {

    const tx = await client.xPrices(account, contractConfig.assets[0], contractConfig.assets[1], 3, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const prices = Client.parsePricesResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Prices: ${prices.map(p => priceToString(p)).join(', ')}`)

    expect(prices.length > 0).toBe(true)

}, 300000)

test('twap', async () => {

    const tx = await client.twap(account, contractConfig.assets[0], 3, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const twap = Client.parseTwapResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Twap: ${twap.toString()}`)

    expect(twap.isGreaterThan(0)).toBe(true)

}, 300000)

test('x_twap', async () => {

    const tx = await client.xTwap(account, contractConfig.assets[0], contractConfig.assets[1], 3, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const twap = Client.parseTwapResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Twap: ${twap.toString()}`)

    expect(twap.isGreaterThan(0)).toBe(true)

}, 300000)

test('lasttimestamp', async () => {
    const tx = await client.lastTimestamp(account, txOptions)

    const signatures = signTransaction(tx)

    const response = await client.submitTransaction(tx, signatures)

    const timestamp = Client.parseNumberResult(response.resultMetaXdr)

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}, Timestamp: ${timestamp}`)

    expect(timestamp).toBeGreaterThan(0)

}, 300000)