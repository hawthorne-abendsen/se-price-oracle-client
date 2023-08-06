/*eslint-disable no-undef */
const crypto = require('crypto')
const {exec} = require('child_process')
const {Keypair, Server} = require('soroban-client')
const {default: BigNumber} = require('bignumber.js')
const Client = require('../src')
const AssetType = require('../src/asset-type')
const contractConfig = require('./contract.config')

if (contractConfig.assets.length < 2)
    throw new Error('Need at least 2 assets to run tests')

const initAssetLength = 1

const extraAsset = {type: AssetType.GENERIC, code: 'JPY'}


function normalize_timestamp(timestamp) {
    return Math.floor(timestamp / contractConfig.resolution) * contractConfig.resolution
}
const MAX_I128 = new BigNumber('170141183460469231731687303715884105727')
const ADJUSTED_MAX = MAX_I128.dividedBy(new BigNumber(`1e+${contractConfig.decimals}`)) //divide by 10^14
initTimestamp = normalize_timestamp(Date.now())

let admin
let account
let contractId
/**
 * @type {Client}
 */
let client

async function prepare() {
    admin = Keypair.random()
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
    const signature = admin.signDecorated(transaction.hash())
    return signature
}

const txOptions = {
    minAccountSequence: '0',
    fee: 1000
}

beforeAll(async () => {
    await prepare()
}, 30000)

test('config', async () => {
    const tx = await client.config(account, {
        admin: admin.publicKey(),
        assets: contractConfig.assets.slice(0, initAssetLength),
        period: contractConfig.resolution * 10,
        baseFee: new BigNumber(1000)
    }, txOptions)

    const signature = signTransaction(tx)

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('add_assets', async () => {
    const tx = await client.addAssets(account, contractConfig.assets.slice(initAssetLength), txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)
}, 30000)

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

        const signature = signTransaction(tx, admin.secret())

        const response = await client.submitTransaction(tx, [signature])

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 30000)

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

        const signature = signTransaction(tx, admin.secret())

        const response = await client.submitTransaction(tx, [signature])

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 30000)

test('set_price (extra price)', async () => {

    let timestamp = initTimestamp

    for (let i = 0; i < 3; i++) {
        const prices = []
        contractConfig.assets.push(extraAsset)
        for (const asset of contractConfig.assets)
            prices.push({asset, price: generateRandomI128()})

        const tx = await client.setPrice(
            account,
            prices,
            timestamp,
            txOptions
        )

        const signature = signTransaction(tx, admin.secret())

        const response = await client.submitTransaction(tx, [signature])

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 30000)

test('add_asset (extra asset)', async () => {
    const tx = await client.addAssets(account, [extraAsset], txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)
}, 30000)

//TODO: add test for get_price for extra asset before adding it (must be null) and after adding it (must be valid price)

test('admin', async () => {

    const tx = await client.admin(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('base', async () => {

    const tx = await client.base(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)


test('decimals', async () => {

    const tx = await client.decimals(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('resolution', async () => {

    const tx = await client.resolution(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('period', async () => {

    const tx = await client.period(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('assets', async () => {

    const tx = await client.assets(account, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('price', async () => {
    const tx = await client.price(account, contractConfig.assets[1], initTimestamp, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_price', async () => {

    const tx = await client.xPrice(account,
        contractConfig.assets[0],
        contractConfig.assets[1],
        initTimestamp,
        txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('lastprice', async () => {

    const tx = await client.lastPrice(account, contractConfig.assets[0], txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_lt_price', async () => {

    const tx = await client.xLastPrice(account, contractConfig.assets[0], contractConfig.assets[1], txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('prices', async () => {

    const tx = await client.prices(account, contractConfig.assets[0], 3, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_prices', async () => {

    const tx = await client.xPrices(account, contractConfig.assets[0], contractConfig.assets[1], 3, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('twap', async () => {

    const tx = await client.twap(account, contractConfig.assets[0], 3, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_twap', async () => {

    const tx = await client.xTwap(account, contractConfig.assets[0], contractConfig.assets[1], 3, txOptions)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)