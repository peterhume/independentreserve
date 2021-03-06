var util = require('util'),
    _ = require('underscore'),
    request	= require('request'),
    crypto = require('crypto'),
    cheerio = require('cheerio'),
    VError = require('verror');

var IndependentReserve = function(key, secret, server, timeout)
{
    this.key = key;
    this.secret = secret;

    this.server = server || 'https://api.independentreserve.com';
    this.timeout = timeout || 10000;    // in milliseconds

    // initialize nonce to current unix time in milliseconds
    this.nonce = (new Date()).getTime();
};

IndependentReserve.prototype.postRequest = function postRequest(action, callback, params)
{
    var functionName = 'IndependentReserve.postRequest()';

    if(!this.key || !this.secret)
    {
        var error = new Error('The API key and secret must be set on initiation of the IndependentReserve function for private API request.');
        return callback(error);
    }

    // Set custom User-Agent string
    var headers = {"User-Agent": "Independent Reserve Javascript API Client"};

    var path = '/Private/' + action;

    var nonce = this.nonce++;
    var url = this.server + path;

    // create a string of comma separated values
    var message = [url, 'apiKey=' + this.key, 'nonce=' + nonce].join(',') ;

    // append a string of comma separated key=value pairs
    _.keys(params).forEach(function(key)
    {
        message = message + ',' + key + '=' + params[key];
    });

    var signer = crypto.createHmac('sha256', new Buffer(this.secret, 'utf8'));
    var signature = signer.update(message).digest('hex').toUpperCase();

    var postData = _.extend({
        apiKey: this.key,
        signature: signature,
        nonce: nonce
    }, params);

    var options = {
        url: url,
        method: 'POST',
        headers: headers,
        json: postData,
        timeout: this.timeout
    };

    var requestDesc = util.format('%s request to url %s with nonce %s and params %s',
        options.method, options.url, nonce, JSON.stringify(params));

    executeRequest(options, requestDesc, action, callback);
};

IndependentReserve.prototype.getRequest = function(action, callback, params)
{
    var functionName = 'IndependentReserve.getRequest()';

    // Set custom User-Agent string
    var headers = {"User-Agent": "Independent Reserve Javascript API Client"};

    var path = '/Public/' + action;

    var options = {
        url: this.server + path,
        method: 'GET',
        headers: headers,
        qs: params,
        json: {},   // set to empty object so json response will be parsed
        timeout: this.timeout
    };

    var requestDesc = util.format('%s request to url %s with params %s',
        options.method, options.url, JSON.stringify(params));

    executeRequest(options, requestDesc, action, callback);
};

function executeRequest(options, requestDesc, action, callback)
{
    var functionName = 'IndependentReserve.executeRequest()';

    request(options, function(err, response, data)
    {
        var error = null;   // default to no error

        if(err)
        {
            error = new VError(err, '%s failed %s', functionName, requestDesc);
            error.name = err.code;
        }
        else if (response.statusCode < 200 || response.statusCode >= 300)
        {
            error = new VError('%s HTTP status code %s returned from %s. Status message: %s', functionName,
                response.statusCode, requestDesc, response.statusMessage);
            error.name = response.statusCode;
        }
        // only WithdrawDigitalCurrency does not return any data
        else if (action !== "WithdrawDigitalCurrency")
        {
            if (!data)
            {
                error = new VError('%s failed %s. No data returned.', functionName, requestDesc );
            }
            else if (data.Message)
            {
                error = new VError('%s failed %s. Response message: %s', functionName, requestDesc, data.Message);
                error.name = data.Message;
            }
            // if request was not able to parse json response into an object
            else if (!_.isObject(data) )
            {
                // try and parse HTML body form response
                $ = cheerio.load(data);
                var responseBody = $('body').text();

                if (responseBody)
                {
                    error = new VError(err, '%s could not json parse response from %s. Response body:\n%s', functionName, requestDesc, responseBody);
                }
                else
                {
                    error = new VError(err, '%s could not parse json or HTML body from %s', functionName, requestDesc);
                }
            }
        }

        callback(error, data);
    });
}

//
// Public Functions
//

IndependentReserve.prototype.getValidPrimaryCurrencyCodes = function getValidPrimaryCurrencyCodes(callback)
{
    this.getRequest('getValidPrimaryCurrencyCodes', callback);
};

IndependentReserve.prototype.getValidSecondaryCurrencyCodes = function getValidSecondaryCurrencyCodes(callback)
{
    this.getRequest('GetValidSecondaryCurrencyCodes', callback);
};

IndependentReserve.prototype.getValidLimitOrderTypes = function getValidLimitOrderTypes(callback)
{
    this.getRequest('GetValidLimitOrderTypes', callback);
};

IndependentReserve.prototype.getValidMarketOrderTypes = function getValidMarketOrderTypes(callback)
{
    this.getRequest('getValidMarketOrderTypes', callback);
};

IndependentReserve.prototype.getMarketSummary = function getMarketSummary(primaryCurrencyCode, secondaryCurrencyCode, callback)
{
    this.getRequest('getMarketSummary', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        secondaryCurrencyCode: secondaryCurrencyCode}
    );
};

IndependentReserve.prototype.getOrderBook = function getOrderBook(primaryCurrencyCode, secondaryCurrencyCode, callback)
{
    this.getRequest('GetOrderBook', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        secondaryCurrencyCode: secondaryCurrencyCode}
    );
};

IndependentReserve.prototype.getRecentTrades = function getRecentTrades(primaryCurrencyCode, secondaryCurrencyCode, numberOfRecentTradesToRetrieve, callback)
{
    this.getRequest('GetRecentTrades', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        secondaryCurrencyCode: secondaryCurrencyCode,
        numberOfRecentTradesToRetrieve: numberOfRecentTradesToRetrieve}
    );
};

//
// Private Functions
//

IndependentReserve.prototype.placeLimitOrder = function placeLimitOrder(primaryCurrencyCode, secondaryCurrencyCode, orderType, price, volume, callback)
{
    this.postRequest('PlaceLimitOrder', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        secondaryCurrencyCode: secondaryCurrencyCode,
        orderType: orderType,
        price: price,
        volume: volume}
    );
};

IndependentReserve.prototype.placeMarketOrder = function placeMarketOrder(primaryCurrencyCode, secondaryCurrencyCode, orderType, volume, callback)
{
    this.postRequest('PlaceMarketOrder', callback, {
            primaryCurrencyCode: primaryCurrencyCode,
            secondaryCurrencyCode: secondaryCurrencyCode,
            orderType: orderType,
            volume: volume}
    );
};

/**
 * Provides a single method to place limit or market orders
 * price is ignored for market orders
 */
IndependentReserve.prototype.placeOrder = function placeOrder(primaryCurrencyCode, secondaryCurrencyCode, orderType, price, volume, callback)
{
    if (orderType == 'MarketOffer' || orderType == 'MarketBid')
    {
        this.postRequest('PlaceMarketOrder', callback, {
            primaryCurrencyCode: primaryCurrencyCode,
            secondaryCurrencyCode: secondaryCurrencyCode,
            orderType: orderType,
            volume: volume}
        );
    }
    else if (orderType == 'LimitOffer' || orderType == 'LimitBid')
    {
        this.postRequest('PlaceLimitOrder', callback, {
            primaryCurrencyCode: primaryCurrencyCode,
            secondaryCurrencyCode: secondaryCurrencyCode,
            orderType: orderType,
            price: price,
            volume: volume}
        );
    }
    else
    {
        var err = new VError('orderType parameter must equal "MarketOffer", "MarketBid,", "LimitOffer" or "LimitBid" - not %s', orderType);
        callback(err);
    }
};

IndependentReserve.prototype.cancelOrder = function cancelOrder(orderGuid, callback)
{
    this.postRequest('CancelOrder', callback, {orderGuid: orderGuid});
};

IndependentReserve.prototype.getOpenOrders = function getOpenOrders(primaryCurrencyCode, secondaryCurrencyCode, pageIndex, pageSize, callback)
{
    var functionName = 'IndependentReserve.getOpenOrders()',
        error;

    if ( !(pageIndex >= 1) )
    {
        error = new VError('%s pageIndex %s is not >= 1', functionName, pageIndex);
        return callback(error);
    }
    else if ( !(pageSize >= 1 && pageSize <= 50) )
    {
        error = new VError('%s pageSize %s is not >= 1 and <= 50', functionName, pageSize);
        return callback(error);
    }

    this.postRequest('GetOpenOrders', callback, {
            primaryCurrencyCode: primaryCurrencyCode,
            secondaryCurrencyCode: secondaryCurrencyCode,
            pageIndex: pageIndex,
            pageSize: pageSize}
    );
};

IndependentReserve.prototype.getOrderDetails = function getOrderDetails(orderGuid, callback)
{
    this.postRequest('GetOrderDetails', callback, {
            orderGuid: orderGuid}
    );
};

IndependentReserve.prototype.getClosedOrders = function getClosedOrders(primaryCurrencyCode, secondaryCurrencyCode, pageIndex, pageSize, callback)
{
    var functionName = 'IndependentReserve.getClosedOrders()',
        error;

    if ( !(pageIndex >= 1) )
    {
        error = new VError('%s pageIndex %s is not >= 1', functionName, pageIndex);
        return callback(error);
    }
    else if ( !(pageSize >= 1 && pageSize <= 50) )
    {
        error = new VError('%s pageSize %s is not >= 1 and <= 50', functionName, pageSize);
        return callback(error);
    }

    this.postRequest('GetClosedOrders', callback, {
            primaryCurrencyCode: primaryCurrencyCode,
            secondaryCurrencyCode: secondaryCurrencyCode,
            pageIndex: pageIndex,
            pageSize: pageSize}
    );
};

IndependentReserve.prototype.getClosedFilledOrders = function getClosedFilledOrders(primaryCurrencyCode, secondaryCurrencyCode, pageIndex, pageSize, callback)
{
    var functionName = 'IndependentReserve.getClosedFilledOrders()',
        error;

    if ( !(pageIndex >= 1) )
    {
        error = new VError('%s pageIndex %s is not >= 1', functionName, pageIndex);
        return callback(error);
    }
    else if ( !(pageSize >= 1 && pageSize <= 50) )
    {
        error = new VError('%s pageSize %s is not >= 1 and <= 50', functionName, pageSize);
        return callback(error);
    }

    this.postRequest('GetClosedFilledOrders', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        secondaryCurrencyCode: secondaryCurrencyCode,
        pageIndex: pageIndex,
        pageSize: pageSize}
    );
};

IndependentReserve.prototype.getAccounts = function getAccounts(callback)
{
    this.postRequest('GetAccounts', callback);
};

IndependentReserve.prototype.getTransactions = function getTransactions(accountGuid, fromTimestamp, toTimestamp, pageIndex, pageSize, txTypes, callback)
{
    var functionName = 'IndependentReserve.getTransactions()',
        error;

    if ( !(fromTimestamp instanceof Date) )
    {
        error = new VError('%s fromTimestamp %s must be a Date', functionName, fromTimestamp);
        return callback(error);
    }
    else if ( toTimestamp == null || !(toTimestamp instanceof Date) )
    {
        error = new VError('%s toTimestamp %s must be a null or a Date', functionName, toTimestamp);
        return callback(error);
    }
    else if ( !(pageIndex >= 1) )
    {
        error = new VError('%s pageIndex %s is not >= 1', functionName, pageIndex);
        return callback(error);
    }
    else if ( !(pageSize >= 1 && pageSize <= 50) )
    {
        error = new VError('%s pageSize %s is not >= 1 and <= 50', functionName, pageSize);
        return callback(error);
    }

    var options = {
        accountGuid: accountGuid,
        fromTimestampUtc: fromTimestamp.toISOString(),
        pageIndex: pageIndex,
        pageSize: pageSize,
        txTypes: txTypes
    };

    if (toTimestamp != null && toTimestamp instanceof Date)
    {
        options.toTimestampUtc = toTimestamp.toISOString();
    }

    if (txTypes != null && toTimestamp instanceof Array)
    {
        options.txTypes = txTypes;
    }

    this.postRequest('GetTransactions', callback, options);
};

IndependentReserve.prototype.getTrades = function getTrades(pageIndex, pageSize, callback)
{
    var functionName = 'IndependentReserve.getTrades()',
        error;

    if ( !(pageIndex >= 1) )
    {
        error = new VError('%s pageIndex %s is not >= 1', functionName, pageIndex);
        return callback(error);
    }
    else if ( !(pageSize >= 1 && pageSize <= 50) )
    {
        error = new VError('%s pageSize %s is not >= 1 and <= 50', functionName, pageSize);
        return callback(error);
    }

    this.postRequest('GetTrades', callback, {
        pageIndex: pageIndex,
        pageSize: pageSize}
    );
};

IndependentReserve.prototype.getDigitalCurrencyDepositAddress = function getDigitalCurrencyDepositAddress(primaryCurrencyCode, callback)
{
    this.postRequest('GetDigitalCurrencyDepositAddress', callback, {
        primaryCurrencyCode: primaryCurrencyCode
    });
};

IndependentReserve.prototype.getDigitalCurrencyDepositAddresses = function getDigitalCurrencyDepositAddresses(primaryCurrencyCode, pageIndex, pageSize, callback)
{
    this.postRequest('GetDigitalCurrencyDepositAddresses', callback, {
        primaryCurrencyCode: primaryCurrencyCode,
        pageIndex: pageIndex,
        pageSize: pageSize
    });
};

IndependentReserve.prototype.synchDigitalCurrencyDepositAddressWithBlockchain = function synchDigitalCurrencyDepositAddressWithBlockchain(depositAddress, primaryCurrencyCode, callback)
{
    this.postRequest('SynchDigitalCurrencyDepositAddressWithBlockchain', callback, {
        depositAddress: depositAddress,
        primaryCurrencyCode: primaryCurrencyCode
    });
};

IndependentReserve.prototype.withdrawDigitalCurrency = function WithdrawDigitalCurrency(amount, withdrawalAddress, comment, primaryCurrencyCode, callback)
{
    this.postRequest('WithdrawDigitalCurrency', callback, {
        amount: amount,
        withdrawalAddress: withdrawalAddress,
        comment: comment,
        primaryCurrencyCode: primaryCurrencyCode
    });
};

IndependentReserve.prototype.requestFiatWithdrawal = function requestFiatWithdrawal(currency, withdrawalAmount, withdrawalBankAccountName, comment, callback)
{
    this.postRequest('RequestFiatWithdrawal', callback, {
        secondaryCurrencyCode: currency,
        withdrawalAmount: withdrawalAmount,
        withdrawalBankAccountName: withdrawalBankAccountName,
        comment: comment
    });
};

IndependentReserve.prototype.getBrokerageFees = function getBrokerageFees(callback)
{
    this.postRequest('GetBrokerageFees', callback);
};

module.exports = IndependentReserve;
