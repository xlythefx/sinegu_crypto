# MEXC Futures — Error codes

Numeric `code` values returned by the futures Open API (English descriptions as in MEXC materials). Confirm current codes and messages in [MEXC’s official API documentation](https://mexcdevelop.github.io/apidocs/).

| Code | Description |
|------|-------------|
| 401 | Not logged in or login has expired |
| 402 | API Key expired, please apply again |
| 406 | Accessing IP is not in the whitelist |
| 500 | Internal error. Please try again. |
| 501 | System busy, try again later |
| 506 | Unknown source of request |
| 510 | Requests are too frequent, please try again later |
| 511 | You do not have access to the interface |
| 513 | Invalid request, please try again later |
| 600 | Parameter error |
| 601 | Data parsing error |
| 602 | Confirming signature failed |
| 603 | Repeated request |
| 604 | Sorry, this feature is under maintenance |
| 701 | Please enable API Key read access |
| 702 | Please enable API Key write access |
| 703 | Trading information read access is required |
| 704 | Please enable API Key trading information write access |
| 801 | System under maintenance |
| 1000 | Account does not exist |
| 1001 | Contract does not exist |
| 1002 | Contract not activated |
| 1003 | Risk limit level error, please try again after adjustment |
| 1004 | Amount error |
| 2001 | Order direction error |
| 2002 | Position type error |
| 2003 | Exceeded the maximum buying price {amount}{currency}, please fill in again |
| 2004 | Selling price is lower than the minimum price {amount}{currency}, please fill in again |
| 2005 | Balance insufficient |
| 2006 | Leverage multiplier must be within the upper limit {max} and lower limit {min} |
| 2007 | Order price error |
| 2008 | Insufficient number of positions can be closed |
| 2009 | Position is nonexistent or closed |
| 2011 | Order quantity error |
| 2013 | Number of cancelled orders exceeds {count} |
| 2014 | Orders in batches shall not be greater than {count} |
| 2015 | Price or quantity precision error, please enter again |
| 2016 | Trigger order exceeds the max. number of {count} |
| 2018 | Cannot exceed the maximum reducible margin {vol} |
| 2019 | Leverage adjustment unavailable while orders are open |
| 2021 | Order leverage is inconsistent with the existing position leverage |
| 2022 | Position type error |
| 2023 | Risk limit cannot be modified at the moment due to leverage of existing open positions |
| 2024 | There's order with leverage greater than the maximum leverage of the new order, so modifying the risk limit is unavailable at the moment |
| 2025 | Your current position amount is greater than the allowable amount of the new order. Please modify the risk limit and place the order again |
| 2026 | Leverage adjustment is unavailable for cross margin |
| 2027 | Cross and isolated position of the same direction are alternative. |
| 2028 | Maximum order quantity of {count} exceeded |
| 2029 | Order type error |
| 2030 | External order ID too long (max. 32 digit) |
| 2031 | Current risk limit and maximum allowable number of positions exceeded, please adjust the risk limit |
| 2032 | Order price is lower than the liquidation price of the position |
| 2033 | Order price is higher than the liquidation price of the position |
| 2034 | Batch query quantity exceeds the limit of {count} |
| 2035 | Market order level not supported |
| 2036 | Number of orders has exceeded the limit, please contact Customer Service |
| 2037 | Trading too frequent, please try again later |
| 2038 | Max. allowable positions exceeded, please contact customer service |
| 2039 | Counterparty's order amount shall not be greater than that of the best bid or best ask. Please select more orders in the orderbook or reduce the order amount before placing the order |
| 2040 | Order does not exist |
| 2041 | Current order status does not allow cancelation |
| 2042 | Duplicate order ID |
| 2043 | The order does not match the position |
| 2044 | Insufficient margin to adjust leverage |
| 2045 | Minimum ratio allowed is {number} |
| 2046 | Maximum ratio allowed is {number} |
| 2047 | Minimum variance allowed is {number} |
| 2048 | Maximum variance allowed is {number} |
| 2049 | Liquidation may occur after the order is filled at the specified price. Please update the price before placing the order. |
| 2051 | Exceeds the maximum order amount allowed for a single order |
| 2052 | Partially filled orders do not support price or quantity editing |
| 2053 | One-way mode does not support limit order editing currently |
| 2054 | Unable to place a new order as the system has not found any successfully canceled orders. Please try editing the order again later or place a new order. |
| 2055 | System does not support limit order editing currently |
| 2056 | Market close order is in progress due to market volatility. Please try again later. We apologize for any inconvenience caused. |
| 2057 | Not meeting the minimum order amount required for a single order |
| 2058 | Chase Order Failed: The system does not currently support chase orders |
| 2059 | Chase Order Failed: Your order has been filled or canceled |
| 2060 | Chase Order Failed: TP price must be higher than the best bid price |
| 2061 | Chase Order Failed: SL price must be lower than the best bid price |
| 2062 | Chase Order Failed: TP price must be lower than the best ask price |
| 2063 | Chase Order Failed: SL price must be higher than the best ask price |
| 2064 | Unable to place chase orders in one-way position mode |
| 2065 | Chase Order Failed: Insufficient assets |
| 2066 | Chase Order Failed: This action will result in liquidation |
| 2068 | MEXC has disabled certain SMS services |
| 2069 | Your current Cross Margin position is showing a loss. Please close the position before claiming the reward again. |
| 2070 | Price distance cannot exceed 5% of the current bid1/ask1 |
| 2071 | Max. chase distance cannot exceed 10% |
| 2072 | You can have up to {count} active chase limit orders per account at a time |
| 2073 | A chase limit order already exists for this Futures pair |
| 2074 | Chase limit orders cannot be edited |
| 2075 | This is not a chase limit order |
| 2076 | This order is a chase limit order |
| 3001 | Trigger order price type error |
| 3002 | Trigger order type error |
| 3003 | Execution cycle error |
| 3004 | Trigger price error |
| 3006 | Order prices can only be edited for orders that have not been triggered yet |
| 3007 | Take-profit price of a trigger-market long order should be higher than the trigger price |
| 3008 | Take-profit price of a trigger-limit long order should be higher than the order price |
| 3009 | Stop-loss price of a trigger-market long order should be lower than the trigger price |
| 3010 | Stop-loss price of a trigger-limit long order should be lower than the order price |
| 3011 | Take-profit price of a trigger-market short order should be lower than the trigger price |
| 3012 | Take-profit price of a trigger-limit short order should be lower than the order price |
| 3013 | Stop-loss price of a short position trigger-market order should be higher than the trigger price |
| 3014 | Stop-loss price of a short position trigger-limit order should be higher than the order price |
| 3015 | Pre-set TP/SL prices can only be edited for orders that have not been triggered yet |
| 4001 | Unsupported cryptocurrency |
| 5001 | Stop profit price and stop loss price cannot both be empty |
| 5002 | Stop-limit order is nonexistent or closed |
| 5003 | The price of stop-limit order error |
| 5004 | Total amount of the stop-limit order is greater than the closable amount of the position |
| 5005 | Order failed as there is already a position TP/SL order. |
| 5006 | You currently have maker orders or positions in the opposite direction under a different margin mode |
| 6001 | Trading is forbidden |
| 6002 | Position opening is forbidden. Please contact Customer Service |
| 6003 | Incorrect time range, you can select up to 90 days only |
| 6004 | The trading pair and status should be filled in |
| 6005 | The trading pair is not available |
| 6006 | The current version does not support Cross Margin function, please use the Web version |
| 6007 | Switching from Cross Margin mode to Isolated Margin Mode is not supported |
| 6008 | Order placed successfully (The estimated liquidation price may not show accurately on the current version, kindly update to the latest version.) |
| 6009 | Position opening is currently unavailable for your account. Please go to Help Center to submit information for risk control removal. |
| 6010 | You are unable to use Multi-Asset mode. Please contact Customer Service. |
| 6011 | Unable to switch to Multi-Asset mode as there are currently active orders or positions. Please cancel the orders or close the positions first. |
| 6012 | Sub-accounts cannot use Multi-Asset mode |
| 6013 | Traders in Copy Trade cannot use Multi-Asset mode |
| 6014 | Your account has liabilities and cannot switch to Multi-Asset mode |
| 6015 | The account has liabilities and cannot switch to Single-Asset mode. Please clear the liabilities first. |
| 6016 | Unable to switch to Single-Asset mode as there are currently active orders or positions. Please cancel the orders or close the positions first. |
| 6017 | The current price has expired. Please request the price again. |
| 6018 | The current exchange rate is unfavorable, and this action may put your account at risk. Please request a new price |
| 6019 | Coin-margined trading is not supported in Multi-Asset mode |
| 6020 | Only cross margin is allowed in Multi-Asset mode |
| 6021 | There is an issue with the liability crypto. Please try again later. |
| 6022 | Trading error. Please try again later. |
| 6023 | Market maker accounts cannot use Multi-Asset mode |
| 6024 | Prediction Futures trading is not available in Multi-Asset mode |
| 6025 | Position airdrops are not available in Multi-Asset mode |
| 7001 | Please cancel active orders or close positions before modifying position mode |
| 7002 | Position mode mismatch, please switch position mode |
| 7003 | The new order type must be consistent with the existing order or the opening type of position |
| 7004 | The new order leverage must be consistent with the existing order or the leverage of the position |
| 7005 | The position amount for closing is insufficient, please check the position or the pending order |
| 7008 | Cannot be less than the minimum order amount {value} USDT |
| 7009 | Your leverage ratio (position value/wallet balance) is too high. Please close positions, make a transfer, or deposit funds first. |
| 8002 | Invalid state |
| 8003 | User mismatch |
| 8004 | No rewards to claim |
| 8005 | Activity does not exist |
| 8006 | Event rewards has been received |
| 8007 | The event has concluded |
| 8008 | Not participating in event |
| 8009 | The tournament does not exist |
| 8010 | Exceeded the registration time for the tournament |
| 8011 | Multiple registrations are not supported |
| 8012 | Insufficient available margin |
| 8016 | Activity in preparation. Please try again later |
| 8017 | Activity has ended. |
| 8019 | You are not entitled to participate in this activity. Please contact customer service for more details. |
| 8020 | The sub-account cannot participate in this activity. |
| 8021 | Claim failed. Please contact customer service. |
| 8022 | The rewards of this activity have been claimed. Please come back next time. Thank you for your support. |
| 8023 | Today's activity reward has been claimed. Please come back tomorrow. Thank you for your support. |
| 8024 | You are not a new user and cannot participate in this activity. |
| 8025 | This activity is not available in your country or region. |
| 8026 | This rule already exists. |
| 8027 | You've created the maximum number of rules. |
| 8028 | Insufficient deposit. Failed to claim reward. |
| 8029 | Registration is unavailable for the country you're located |
| 8030 | Event has not started |
| 8031 | Event has ended |
| 8032 | Lucky draw has not been enabled |
| 8033 | Registration unsuccessful |
| 8034 | Daily trading limit has not met the requirement |
| 8035 | Prize pool has been fully redeemed |
| 8036 | Lucky Spin chances are used up |
| 8037 | Cannot participate in multiple competitions at the same time |
| 8038 | The match has started |
| 8040 | Reward can't be claimed as it has expired |
| 8041 | You've successfully redeemed the reward, which will be distributed within 24 hours after the daily event ends. If the reward isn't credited to your account within 24 hours, it might have triggered the risk control system. |
| 8043 | We're sorry, you haven't reached the minimum trading volume. |
| 8044 | We're sorry, but the reward has been claimed. Please stay tuned for upcoming rewards. |
| 8045 | We are excited to see you complete the tasks and receive your rewards |
| 8046 | There's no check-in event on the day |
| 8047 | We're sorry, you haven't reached the minimum trading volume of this checkpoint. |
| 8048 | Exceeded the maximum number of {count} trading pairs for price alerts! |
| 8049 | Exceeded the maximum number of {count} price alerts supported for a single futures! |
| 8050 | The maximum number of indicator alerts is {count} |
| 8051 | Team does not exist |
| 8052 | Min. team member requirement not met |
| 8053 | Not within the allowed time frame |
| 8054 | Incorrect team code |
| 8055 | Application already exists |
| 8056 | You have already joined a team |
| 8057 | Unable to leave after the team is formed |
| 8058 | Unable to leave as the event is about to start |
| 8059 | No team creation request to cancel |
| 8060 | Status changed. Please refresh and try again. |
| 8061 | Record does not exist |
| 8062 | Team leader cannot leave the team |
| 8063 | Team Leader cannot transfer to themselves |
| 8064 | Withdrawal limit exceeded |
| 8065 | Action limit exceeded |
| 8066 | Not part of the team |
| 8067 | Members who are removed from a team will need to wait 24 hours before joining a new team |
| 8098 | You can't take part in this event at the moment. For more details, please contact Customer Service. |
| 8099 | You can't take part in this event at the moment. For more details, please contact Customer Service. |
| 8100 | Insufficient Points |
| 8101 | No draws available. Please try again later. |
| 8102 | Insufficient Picks |
| 8201 | Today's Prize Pool Fully Claimed |
| 8202 | Recommended |
| 8900 | You need to complete the advanced KYC to participate in the event |
| 8815 | Current positions exceeded the maximum number of positions {amount}{currency} that can be held at the target leverage |
| 8816 | Exceeded the maximum number of positions {amount}{currency} that can be held at this leverage |
| 8818 | Current positions exceeded the maximum number of contracts {amount} that can be held at the target leverage |
| 8819 | Exceeded the maximum number of contracts {amount} that can be held at this leverage |
| 8820 | Due to risk control measures, your account has reached the maximum position limit and cannot open additional positions |
| 8821 | The current position quantity exceeds the maximum position quantity allowed for the target leverage. The current maximum leverage that can be set is {leverage}. |
| 8817 | Risk limiting mechanism has been upgraded. Please check the website for more information. |
| 8901 | Registered already! |
| 8902 | The event has expired! |
| 8903 | The event hasn't started yet! |
| 8904 | The event has ended! |
| 8905 | Sorry, you're not eligible for the event! |
| 8906 | Unable to access your info! |
| 8907 | Unable to access your asset info! |
| 8908 | You haven't activated the Futures account yet! |
| 8909 | To take part in the event, your USDT-M Futures account equity shall be greater than {minEquity} USDT, please try again after making transfer! |
| 8910 | Unable to access your country code! |
| 8911 | Unable to access your Futures settings info! |
| 8912 | Automatically cancelled as position has been closed |
| 8913 | Manually cancelled by user |
| 8915 | Leverage mode cannot be changed as there is an active order or position. Please cancel the order or close the position first. |
| 8916 | The file size exceeds the limit and cannot be generated, or has not been generated yet. Please download it from the web version or try again later. |
| 8917 | The reduce-only order would lead to insufficient position margin for existing orders |
| 8918 | Queries for market makers or particular users are not currently supported |
| 8919 | Exceeds the maximum value limit for position and open order values across all trading pairs for a single user |
| 8920 | Position opening has been suspended for the current trading pair and only closing is allowed. If you have any questions, please contact Customer Service. |
| 8921 | Position closing has been suspended for the current trading pair and only opening is allowed. If you have any questions, please contact Customer Service. |
| 8922 | Trading has been suspended for the current trading pair. If you have any questions, please contact Customer Service. |
| 8925 | Unable to export further as the remaining export quota for this month is 0! |
| 8926 | There is no data available for export in this time period. Please select a different time range for export. |
| 8927 | The number of data entries exported this time is too high. Please try reducing the export time range and exporting the data in batches. |
| 8928 | Single file download limit exceeded. Please apply to export reward history again. |
| 8929 | An export task is already in progress |
| 8930 | Not yet listed, unable to place an order |
| 8931 | Your leverage exceeds the maximum limit of {max}x in your country/region. Please adjust your leverage and try again. |
| 8932 | Due to risk controls, opening new positions for this pair is temporarily disabled. Only closing is allowed. |
| 8933 | This prediction futures is currently unavailable for trading |
| 8934 | Position opening is prohibited |
| 8935 | Number of open positions for prediction futures exceeds the limit {limit} |
| 8936 | Quantity must be between {min} and {max} {settleCoin} |
| 8937 | Today's loss exceeds the limit: {loseLimit} {settleCoin} |
| 8938 | Payout has changed. Please refresh the page and try again. |
| 8939 | Time unit has changed. Please refresh the page and try again. |
| 8940 | Invalid direction selection |
| 8941 | This prediction futures does not exist |
| 8942 | Invalid payout rate |
| 8943 | Invalid time unit |
| 8944 | Invalid quantity precision |
| 8945 | Daily profit has exceeded the maximum threshold of {dailyProfitUpperLimit} USDT. |
| 8946 | The number of open positions for Prediction Futures has exceeded the daily limit of {dailyOpenPositionUpperLimit}. |
| 9065 | Transfer failed due to risk control. Please contact Customer Service. |
| 9066 | Transfer failed. Insufficient balance. |
| 9067 | Transfer failed |
| 9068 | Trading unavailable due to market closure. Only order cancellations are allowed; new orders cannot be placed. |
| 9069 | This trading pair only supports TP/SL triggered by fair price. |
| 9070 | This pair supports Isolated Margin mode only |
| 9071 | This pair supports Cross Margin mode only |
| 9501 | Unable to create bot due to risk control reasons. Please contact Customer Service. |
| 9502 | Grid count must not exceed {MaxGridQty}. |
| 9503 | Grid count too high. Unable to create bot. |
| 9504 | Price range below limit: {DownPriceLimit}. |
| 9505 | Price range exceeds limit: {UperPriceLimit}. |
| 9506 | Investment must exceed {MinInvestment} {currency}. |
| 9507 | Sub-account retrieval failed. Cannot create grid. |
| 9508 | A maximum of {NoOfBots} bots can run simultaneously. |
| 9509 | Rejected: Bot already running. |
| 9510 | Rejected: Bot already stopped. |
| 9511 | Rejected: Withdrawable amount exceeds {MaxWithdrawable} {currency}. |
| 9512 | Rejected: Invalid stop price. |
| 9513 | Bot trading is not currently supported in sub-accounts. |
| 9514 | The TP amount is invalid and will cause the bot to stop immediately |
| 9515 | The SL amount is invalid and will cause the bot to stop immediately |
| 9516 | The bot is not running and cannot be modified |
| 9517 | The TP PNL rate is invalid and will cause the bot to stop immediately |
| 9518 | The SL PNL rate is invalid and will cause the bot to stop immediately |
| 9998 | Only position closing is supported, as the platform does not support other operations in your current country/region |
| 9999 | Network error. Please try again. |
| 200005 | To further enhance the security of user accounts and assets, and better protect the rights and interests of our users, please complete KYC verification before proceeding with futures trading. Thank you for your understanding and support! |
| 200006 | To enhance the security of your account and assets, please complete KYC verification before proceeding with futures trading. You currently have a trading limit of up to 1,000 USDT (or equivalent in other crypto) in margin before verification. The current limit has been reached; please complete the verification promptly. Thank you for your understanding and support! |
| 300000 | Your total futures trading margin has exceeded 1,000 USDT. To enhance the security of user accounts and assets, and better protect user rights and interests, you need to complete KYC verification to participate in events. Thank you for your understanding and support! |
| 300001 | To further enhance the security of user accounts and assets, and better protect the rights and interests of our users, please complete KYC verification before participating. Thank you for your understanding and support! |
| 300002 | Due to the relevant regulations, this service is not supported in your region |

Placeholders such as `{amount}`, `{currency}`, `{count}`, and `{leverage}` are filled by the API in runtime messages.

---

**Related:** [Futures — integration guide](futures-integration-guide.md)
