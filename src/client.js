const {Server, Contract, TransactionBuilder, Address, xdr, Transaction, Account, Memo} = require('soroban-client')
const AssetType = require('./asset-type')
const {i128ToHiLo} = require('./utils/i128-helper')

/**
 * @typedef {import('bignumber.js').default} BigNumber
 */

/**
 * @typedef {Object} Asset
 * @property {AssetType} type - Asset type
 * @property {string} code - Asset code
 */

/**
 * @typedef {Object} Config
 * @property {string} admin - Valid Stellar account ID
 * @property {Asset[]} assets - Array of assets
 * @property {number} period - Redeem period in milliseconds
 * @property {BigNumber} baseFee - Base fee in stroops
 */

/**
 * @typedef {Object} TxOptions
 * @property {number} fee - Transaction fee in stroops
 * @property {number} timeout - Transaction timeout in seconds
 * @property {string} memo - Transaction memo
 * @property {{min: number | Data, max: number | Date}} timebounds - Transaction timebounds
 * @property {string[]} signers - Transaction signers
 * @property {string} minAccountSequence - Minimum account sequence
 */

/**
 * @typedef {import('soroban-client').SorobanRpc.GetTransactionResponse} TransactionResponse
 */

/**
 * @param {OracleClient} client - Oracle client instance
 * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID
 * @param {xdr.Operation} operation - Stellar operation
 * @param {TxOptions} options - Transaction options
 * @param {string} network - Stellar network
 * @returns {Promise<Transaction>}
 */
async function buildTransaction(client, source, operation, options, network) {
    let sourceAccount = null

    if (typeof source === 'object')
        sourceAccount = new Account(source.accountId, source.sequence)
    else
        sourceAccount = await client.server.getAccount(source)

    const txBuilderOptions = structuredClone(options)
    txBuilderOptions.memo = options.memo ? Memo.text(options.memo) : null
    txBuilderOptions.networkPassphrase = network

    const transaction = new TransactionBuilder(sourceAccount, txBuilderOptions)
        .addOperation(operation)
        .setTimeout(options.timeout)
        .build()

    return await client.server.prepareTransaction(transaction, client.network)
}

function getAccountId(source) {
    if (typeof source === 'object') {
        return source.accountId
    }
    return source
}

/**
 * @param {Asset} asset - Asset object
 * @returns {xdr.ScVal}
 */
function buildAssetScVal(asset) {
    switch (asset.type) {
        case AssetType.STELLAR:
            return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Stellar'), new Address(asset.code).toScVal()])
        case AssetType.GENERIC:
            return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Generic'), xdr.ScVal.scvSymbol(asset.code)])
        default:
            throw new Error('Invalid asset type')
    }
}

/**
 *
 * @param {BigNumber} value - i128 value
 * @returns {xdr.ScVal}
 */
function convertToI128ScVal(value) {
    const {hi, lo} = value ? i128ToHiLo(value) : {hi: '0', lo: '0'}
    return xdr.ScVal.scvI128(
        new xdr.Int128Parts({
            hi: xdr.Int64.fromString(hi),
            lo: xdr.Uint64.fromString(lo)
        })
    )
}

function convertToPriceUpdateItem(priceUpdateItem) {
    return xdr.ScVal.scvMap([
        new xdr.ScMapEntry({key: xdr.ScVal.scvSymbol('asset'), val: buildAssetScVal(priceUpdateItem.asset)}),
        new xdr.ScMapEntry({key: xdr.ScVal.scvSymbol('price'), val: convertToI128ScVal(priceUpdateItem.price)})
    ])
}

/**
 *
 * @param {Asset} a - Asset a
 * @param {Asset} b - Asset b
 * @returns {number}
 */
function sortAssets(a, b) {
    //Compare by type first
    if (a.type > b.type) return -1
    if (a.type < b.type) return 1

    //Compare by code
    return a.code.localeCompare(b.code)
}

class OracleClient {

    /**
     * @type {string}
     * @description Valid Stellar contract ID
     */
    contractId

    /**
     * @type {Contract}
     * @description Stellar contract instance
     */
    contract

    /**
     * @type {string}
     * @description Stellar network passphrase
     */
    network

    /**
     * @type {string}
     * @description Horizon URL
     */
    horizonUrl

    /**
     * @type {Server}
     * @description Horizon server instance
     */
    server

    constructor(network, horizonUrl, contractId) {
        this.contractId = contractId
        this.contract = new Contract(contractId)
        this.network = network
        this.horizonUrl = horizonUrl
        this.server = new Server(horizonUrl, {allowHttp: true})
    }

    /**
     * Builds a transaction to configure the oracle contract
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Config} config - Configuration object
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async config(source, config, options = {fee: 100, timeout: 30}) {
        const configScVal = xdr.ScVal.scvMap([
            new xdr.ScMapEntry({key: xdr.ScVal.scvSymbol('admin'), val: new Address(config.admin).toScVal()}),
            new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol('assets'),
                val: xdr.ScVal.scvVec(config.assets.sort(sortAssets).map(asset => buildAssetScVal(asset)))
            }),
            new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol('base_fee'),
                val: convertToI128ScVal(config.baseFee)
            }),
            new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol('period'),
                val: xdr.ScVal.scvU64(xdr.Uint64.fromString(config.period.toString()))
            })
        ])
        return await buildTransaction(
            this,
            source,
            this.contract.call('config', new Address(getAccountId(source)).toScVal(), configScVal),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to register assets
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset[]} assets - Array of assets
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async addAssets(source, assets, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this,
            source,
            this.contract.call(
                'add_assets',
                new Address(getAccountId(source)).toScVal(),
                xdr.ScVal.scvVec(assets.sort(sortAssets).map(asset => buildAssetScVal(asset)))
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to set prices
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {{asset: Asset, price: BigNumber}[]} updates - Array of prices
     * @param {number} timestamp - Timestamp in milliseconds
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async setPrice(source, updates, timestamp, options = {fee: 100, timeout: 30}) {
        const scValPrices = xdr.ScVal.scvVec(updates.sort((a, b) => sortAssets(a.asset, b.asset)).map(u => convertToPriceUpdateItem(u)))
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'set_price',
                new Address(getAccountId(source)).toScVal(),
                scValPrices,
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get admin
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async admin(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('admin'), options, this.network)
    }

    /**
     * Builds a transaction to get base asset
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async base(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('base'), options, this.network)
    }

    /**
     * Builds a transaction to get decimals
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async decimals(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('decimals'), options, this.network)
    }

    /**
     * Builds a transaction to get resolution
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async resolution(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('resolution'), options, this.network)
    }

    /**
     * Builds a transaction to get retention period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async period(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('period'), options, this.network)
    }

    /**
     * Builds a transaction to get supported assets
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async assets(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('assets'), options, this.network)
    }

    /**
     * Builds a transaction to get asset price at timestamp
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} asset - Asset to get price for
     * @param {number} timestamp - Timestamp in milliseconds
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async price(source, asset, timestamp, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'price',
                buildAssetScVal(asset),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get cross asset price at timestamp
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} baseAsset - Base asset
     * @param {Asset} quoteAsset - Quote asset
     * @param {number} timestamp - Timestamp in milliseconds
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async xPrice(source, baseAsset, quoteAsset, timestamp, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'x_price',
                buildAssetScVal(baseAsset),
                buildAssetScVal(quoteAsset),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get last asset price
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} asset - Asset to get price for
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async lastPrice(source, asset, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call('lastprice', buildAssetScVal(asset)),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get last cross asset price
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} baseAsset - Base asset
     * @param {Asset} quoteAsset - Quote asset
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async xLastPrice(source, baseAsset, quoteAsset, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'x_last_price',
                buildAssetScVal(baseAsset),
                buildAssetScVal(quoteAsset)
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get last asset price records
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} asset - Asset to get prices for
     * @param {number} records - Number of records to return
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async prices(source, asset, records, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'prices',
                buildAssetScVal(asset),
                xdr.ScVal.scvU32(records)
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get last cross asset price records
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} baseAsset - Base asset
     * @param {Asset} quoteAsset - Quote asset
     * @param {number} records - Number of records to return
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async xPrices(source, baseAsset, quoteAsset, records, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'x_prices',
                buildAssetScVal(baseAsset),
                buildAssetScVal(quoteAsset),
                xdr.ScVal.scvU32(records)
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get asset price records in a period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} asset - Asset to get prices for
     * @param {number} records - Number of records to return
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async twap(source, asset, records, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'twap',
                buildAssetScVal(asset),
                xdr.ScVal.scvU32(records)
            ),
            options,
            this.network
        )
    }

    /**
     * Builds a transaction to get last cross asset price in a period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {Asset} baseAsset - Base asset
     * @param {Asset} quoteAsset - Quote asset
     * @param {number} records - Number of records to return
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async xTwap(source, baseAsset, quoteAsset, records, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'x_twap',
                buildAssetScVal(baseAsset),
                buildAssetScVal(quoteAsset),
                xdr.ScVal.scvU32(records)
            ),
            options,
            this.network
        )
    }

    /**
     * @param {Transaction} transaction - Transaction to submit
     * @param {xdr.DecoratedSignature[]} signatures - Signatures
     * @returns {Promise<TransactionResponse>} Transaction response
     */
    async submitTransaction(transaction, signatures = []) {
        const txXdr = transaction.toXDR() //Get the raw XDR for the transaction to avoid modifying the transaction object
        const tx = new Transaction(txXdr, this.network) //Create a new transaction object from the XDR
        signatures.forEach(signature => tx.addDecoratedSignature(signature))

        const submitResult = await this.server.sendTransaction(tx)
        if (submitResult.status !== 'PENDING') {
            throw new Error(`Transaction submit failed: ${submitResult.status}`)
        }
        const hash = submitResult.hash
        let response = await this.getTransaction(hash)
        while (response.status === "PENDING" || response.status === "NOT_FOUND") {
            response = await this.getTransaction(hash)
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        response.hash = hash //Add hash to response to avoid return new object
        return response
    }

    /**
     * @param {string} hash - Transaction hash
     * @returns {Promise<TransactionResponse>} - Transaction response
     */
    async getTransaction(hash) {
        return await this.server.getTransaction(hash)
    }
}

module.exports = OracleClient