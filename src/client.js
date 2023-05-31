const {Server, Contract, TransactionBuilder, Address, xdr, Transaction, Account} = require('soroban-client')

/**
 * @typedef {Object} Config
 * @property {string} admin - Valid Stellar account ID
 * @property {string[]} assets - Array of valid Stellar asset codes in valid Stellar contract ID format
 * @property {number} period - Redeem period in milliseconds
 * @property {{hi: string, lo: string}} baseFee - Base fee in stroops
 */

/**
 * @typedef {Object} TxOptions
 * @property {number} fee - Transaction fee in stroops
 * @property {number} timeout - Transaction timeout in seconds
 */

/**
 * @param {OracleClient} client
 * @param {string} source
 * @param {xdr.Operation} operation
 * @param {TxOptions} options
 */
async function buildTransaction(client, source, operation, options) {
    let sourceAccount = null

    if (typeof source === 'object')
        sourceAccount = new Account(source.accountId, source.sequence)
    sourceAccount = await client.server.loadAccount(source)

    const transaction = new TransactionBuilder(sourceAccount, {fee: options.fee, networkPassphrase: client.network})
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
                val: xdr.ScVal.scvVec(config.assets.map(v => new Address(v).toScVal()))
            }),
            //we dont need it for
            new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol('base_fee'),
                val: xdr.ScVal.scvI128(
                    new xdr.Int128Parts({
                        lo: xdr.Uint64.fromString(config.baseFee?.lo ?? '0'),
                        hi: xdr.Uint64.fromString(config.baseFee?.hi ?? '0')
                    })
                )
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
            options
        )
    }

    /**
     * Builds a transaction to register assets
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string[]} assets - Array of valid Stellar asset addresses
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async addAssets(source, assets, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this,
            source,
            this.contract.call(
                'add_assets',
                new Address(getAccountId(source)).toScVal(),
                xdr.ScVal.scvVec(assets.map(v => new Address(v).toScVal()))
            ),
            options
        )
    }

    /**
     * Builds a transaction to set prices
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {{ hi: string, lo: string }[]} prices - Array of prices
     * @param {number} timestamp - Timestamp in milliseconds
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async setPrice(source, prices, timestamp, options = {fee: 100, timeout: 30}) {
        const scValPrices = xdr.ScVal.scvVec(prices.map(v =>
            xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                    lo: xdr.Uint64.fromString(v.lo),
                    hi: xdr.Uint64.fromString(v.hi)
                })
            )
        ))
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'set_price',
                new Address(getAccountId(source)).toScVal(),
                scValPrices,
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options
        )
    }

    /**
     * Builds a transaction to get admin
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async admin(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('admin'), options)
    }

    /**
     * Builds a transaction to get base asset
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async base(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('base'), options)
    }

    /**
     * Builds a transaction to get decimals
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async decimals(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('decimals'), options)
    }

    /**
     * Builds a transaction to get resolution
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async resolution(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('resolution'), options)
    }

    /**
     * Builds a transaction to get retention period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async period(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('period'), options)
    }

    /**
     * Builds a transaction to get supported assets
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async assets(source, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(this, source, this.contract.call('assets'), options)
    }

    /**
     * Builds a transaction to get asset price at timestamp
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} asset - Valid Stellar asset address
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
                new Address(asset).toScVal(),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options
        )
    }

    /**
     * Builds a transaction to get cross asset price at timestamp
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} baseAsset - Valid Stellar base asset address
     * @param {string} quoteAsset - Valid Stellar quote asset address
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
                new Address(baseAsset).toScVal(),
                new Address(quoteAsset).toScVal(),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(timestamp.toString()))
            ),
            options
        )
    }

    /**
     * Builds a transaction to get last asset price
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} asset - Valid Stellar asset address
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async lastPrice(source, asset, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call('lastprice', new Address(asset).toScVal()),
            options
        )
    }

    /**
     * Builds a transaction to get last cross asset price
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} baseAsset - Valid Stellar base asset address
     * @param {string} quoteAsset - Valid Stellar quote asset address
     * @param {TxOptions} options - Transaction options
     * @returns {Promise<Transaction>} Prepared transaction
     */
    async xLastPrice(source, baseAsset, quoteAsset, options = {fee: 100, timeout: 30}) {
        return await buildTransaction(
            this,
            source,
            this.contract.call(
                'x_last_price',
                new Address(baseAsset).toScVal(),
                new Address(quoteAsset).toScVal()
            ),
            options
        )
    }

    /**
     * Builds a transaction to get last asset price records
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} asset - Valid Stellar base asset address
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
                new Address(asset).toScVal(),
                xdr.ScVal.scvU32(records)
            ),
            options
        )
    }

    /**
     * Builds a transaction to get last cross asset price records
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} baseAsset - Valid Stellar base asset address
     * @param {string} quoteAsset - Valid Stellar quote asset address
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
                new Address(baseAsset).toScVal(),
                new Address(quoteAsset).toScVal(),
                xdr.ScVal.scvU32(records)
            ),
            options
        )
    }

    /**
     * Builds a transaction to get asset price records in a period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} asset - Valid Stellar base asset address
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
                new Address(asset).toScVal(),
                xdr.ScVal.scvU32(records)
            ),
            options
        )
    }

    /**
     * Builds a transaction to get last cross asset price in a period
     * @param {string|{accountId: string, sequence: string}} source - Valid Stellar account ID, or object with accountId and sequence
     * @param {string} baseAsset - Valid Stellar base asset address
     * @param {string} quoteAsset - Valid Stellar quote asset address
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
                new Address(baseAsset).toScVal(),
                new Address(quoteAsset).toScVal(),
                xdr.ScVal.scvU32(records)
            ),
            options
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
     * @returns {Promise<TransactionResponse>} Transaction response
     */
    async getTransaction(hash) {
        return await this.server.getTransaction(hash)
    }
}

module.exports = OracleClient