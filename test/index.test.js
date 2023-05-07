/*eslint-disable no-undef */
const {Keypair} = require('soroban-client')
const {Client} = require('../src')
const contractConfig = require('./contract.config')

const admin = Keypair.fromSecret(contractConfig.adminSecret)
const client = new Client(contractConfig.network, contractConfig.horizonUrl, contractConfig.id)
const initTimestamp = normalize_timestamp(Date.now())

if (contractConfig.assets.length < 2)
    throw new Error('Need at least 2 assets to run tests')

const initAssetLength = 1

function normalize_timestamp(timestamp) {
    return Math.floor(timestamp / contractConfig.resolution) * contractConfig.resolution
}

function i128ToHiLo(bigInt) {
    const hex = bigInt.toString(16).padStart(32, '0')
    const hi = BigInt(`0x${hex.slice(0, 16)}`).toString()
    const lo = BigInt(`0x${hex.slice(16)}`).toString()
    return {hi, lo}
}

function generateRandomI128() {
    const randomInt = BigInt(Math.floor(Math.random() * 100) + 1)
    const result = randomInt * BigInt(Math.pow(10, contractConfig.decimals))
    return i128ToHiLo(result)
}

function signTransaction(transaction, secretKey) {
    const keypair = Keypair.fromSecret(secretKey)
    const signature = keypair.signDecorated(transaction.hash())
    return signature
}

test('config', async () => {
    const tx = await client.config(admin.publicKey(), {
        admin: admin.publicKey(),
        assets: contractConfig.assets.slice(0, initAssetLength),
        period: contractConfig.resolution * 10,
        baseFee: {hi: '0', lo: '0'}
    })

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('add_assets', async () => {
    const tx = await client.addAssets(admin.publicKey(), contractConfig.assets.slice(initAssetLength))

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)
}, 30000)

test('set_price', async () => {

    let timestamp = initTimestamp

    for (let i = 0; i < 3; i++) {
        const prices = []
        for (let c = 0; c < contractConfig.assets.length; c++) {
            prices.push(generateRandomI128())
        }

        const tx = await client.setPrice(
            admin.publicKey(),
            prices,
            timestamp
        )

        const signature = signTransaction(tx, admin.secret())

        const response = await client.submitTransaction(tx, [signature])

        console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

        timestamp += contractConfig.resolution
    }
}, 30000)

test('admin', async () => {

    const tx = await client.admin(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('base', async () => {

    const tx = await client.base(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('decimals', async () => {

    const tx = await client.decimals(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('resolution', async () => {

    const tx = await client.resolution(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('period', async () => {

    const tx = await client.period(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('assets', async () => {

    const tx = await client.assets(admin.publicKey())

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('price', async () => {
    const tx = await client.price(admin.publicKey(), contractConfig.assets[1], initTimestamp)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_price', async () => {

    const tx = await client.xPrice(admin.publicKey(), contractConfig.assets[0], contractConfig.assets[1], initTimestamp)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('lastprice', async () => {

    const tx = await client.lastPrice(admin.publicKey(), contractConfig.assets[0])

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_lt_price', async () => {

    const tx = await client.xLastPrice(admin.publicKey(), contractConfig.assets[0], contractConfig.assets[1])

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('prices', async () => {

    const tx = await client.prices(admin.publicKey(), contractConfig.assets[0], 3)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_prices', async () => {

    const tx = await client.xPrices(admin.publicKey(), contractConfig.assets[0], contractConfig.assets[1], 3)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('twap', async () => {

    const tx = await client.twap(admin.publicKey(), contractConfig.assets[0], 3)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)

test('x_twap', async () => {

    const tx = await client.xTwap(admin.publicKey(), contractConfig.assets[0], contractConfig.assets[1], 3)

    const signature = signTransaction(tx, admin.secret())

    const response = await client.submitTransaction(tx, [signature])

    console.log(`Transaction ID: ${response.hash}, Status: ${response.status}`)

}, 30000)