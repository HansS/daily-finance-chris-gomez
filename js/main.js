(function(Backbone, _, $) {

/**
 * Transaction
 *
 * A record of money movement
 **/
var Transaction = Backbone.Model.extend({
    defaults: {
        type: 'credit',
        amount: '00.00',
        description: ''
    },
    initialize: function()
    {

        var accounts = App.accounts.getByType(this.get('type'));

        var firstAccountCid = accounts[0].cid;

        this.set({
            account_cid: firstAccountCid
        })
    }
})

/**
 * Account
 *
 * A source/destination of money
 **/
var Account = Backbone.Model.extend({
    defaults: {
        balance: 0
    },
    initialize: function()
    {
    },
    deposit: function(amount)
    {

        var amount = parseFloat(amount, 10);
        var balance = this.get('balance');
        var total = balance + amount;
        this.set({
            balance: total
        });
    },
    withdraw: function(amount)
    {
        var amount = parseFloat(amount, 10);
        var balance = this.get('balance');
        var total = balance - amount;
        this.set({
            balance: total
        });
    }
});

/**
 * TransactionHistory
 *
 * A collection of Transaction Models
 **/
var TransactionHistory = Backbone.Collection.extend({
    model: Transaction,
    initialize: function()
    {
        this.bind('add', this.createTransactionRecord, this);
        this.bind('add', this.distributeFunds, this);
    },
    createTransactionRecord: function(model)
    {
        new TransactionRecord({
            model: model
        });
    },
    distributeFunds: function()
    {
        App.accounts.silentlyZeroBalances();

        this.each(function(transaction) {

            var cid = transaction.get('account_cid');
            var account = App.accounts.getByCid(cid);

            // Take money from each credit account to fund the debit
            if (account.get('type') == 'debit') {
                var creditAccounts = App.accounts.getByType('credit');
                var split = App.util.divideEvenly(
                    transaction.get('amount'), creditAccounts.length);


                _(creditAccounts).each(function(account) {
                    var portion = split.shift();
                    account.withdraw(portion)
                })
            }

            // Deposit the money
            account.deposit(transaction.get('amount'));

        });
    }
})


/**
 * Bank
 *
 * A collection of Account Models
 **/
var Bank = Backbone.Collection.extend({
    model: Account,
    initialize: function(options)
    {
        this.bind('add', this.createAccountStatus, this);
    },
    getByType: function(type) {
        return this.filter(function(account) {
            return account.get('type') == type;
        });
    },
    getCidByName: function(name) {
        var result = this.find(function (account) {
            return account.get('name') == name;
        });

        return result.cid;
    },
    createAccountStatus: function(model)
    {
        // Create the AccountStatus view
        new AccountStatus({
            model: model
        })
    },
    silentlyZeroBalances: function()
    {
        this.each(function(account) {
            account.set({
                balance: 0
            }, { silent: true })
        })
    }
});

/**
 * AccountStatus
 *
 * A presentation of an accounts state
 **/
var AccountStatus = Backbone.View.extend({
    tagName: 'li',
    parentId: '#',
    initialize: function()
    {
        var self = this;

        this.parentId = '#' + this.model.get('type') + '-accounts'

        // Add the markup to this.el
        $(this.el).html($('#account-status-template').html());

        // Insert this.el into the DOM
        $(this.parentId).append(this.el);

        // Bind model to view!
        Backbone.ModelBinding.bind(this)

        // Listen for a change in balance
        this.model.bind('change:balance', this.onBalanceChange, this);

        // Render initially
        this.render();
    },
    onBalanceChange: function() {
        this.render();
    },
    render: function() {
        var li = $(this.el);
        //li.css({backgroundColor: this.model.get('color')})
        li.css({backgroundColor: '#0f0'})
    }
})

/**
 * TransactionRecord
 *
 * A line item for a transaction
 **/
var TransactionRecord = Backbone.View.extend({
    tagName: 'li',
    initialize: function()
    {
        // Add the markup to this.el
        $(this.el).html($('#transaction-template').html());

        // Add the transaction to the list
        $('#transaction-history').prepend(this.el);

        Backbone.ModelBinding.bind(this);
    }
})

/**
 * TransactionForm
 *
 * The interface used to input transactions
 **/
var TransactionForm = Backbone.View.extend({
    el: '#transaction-form',
    events: {
        'change select#type': 'updateAccountOptions',
        'submit': 'applyTransaction'
    },
    initialize: function()
    {
        this.model = new Transaction();

        // Setup the select field with accounts
        this.updateAccountOptions();

        // Make sure amount is always a in currency format
        //$('#amount').maskMoney().mask();

        // Bind model to view!
        Backbone.ModelBinding.bind(this);
    },
    updateAccountOptions: function()
    {
        var type = this.model.get('type');

        var accounts = App.accounts.getByType(type);

        var select = $('#account_cid');
        select.empty()

        for (var index in accounts) {
            var account = accounts[index];

            // I hope I don't get points off for this!
            select.append('<option value="' + account.cid + '">'
                + account.get('name') + '</option>')
        }

        var firstAccountCid = accounts[0].cid;

        this.model.set({ account_cid: firstAccountCid });
    },
    applyTransaction: function(e)
    {
        // We want to be able to call this method without submiting the form,
        // also
        if (e) {
            e.preventDefault();
        }

        // validate

        /*var amount = this.model.get('amount');
        var targetAccount = App.accounts
            .getByCid(this.model.get('account_cid'));

        targetAccount.deposit(amount);

        if (this.model.get('type') == 'debit') {
            var accounts = App.accounts.getByType('credit');
            var portions = App.util.divideEvenly(amount, accounts.length);

            for (var index in accounts) {
                var account = accounts[index];
                var portion = portions.shift();
                account.withdraw(portion);
            }
        }*/

        // Unbind the model/view, they're done with each other
        Backbone.ModelBinding.unbind(this);

        // Add this model to the transaction history
        App.transactions.add(this.model)

        // Tie this view to a new model
        this.model = new Transaction();
        Backbone.ModelBinding.bind(this);

        // Since no change event was fired
        this.updateAccountOptions();

    }
});

function DailyFinance()
{
}
DailyFinance.prototype.accounts = new Bank();
DailyFinance.prototype.transactions = new TransactionHistory();
DailyFinance.prototype.initialize = function()
{
    // Initial render();
    this.render();

    // Rerender at a decent interval
    $(window).resize(_.debounce(this.render, 300));

    // Create the default accounts
    // Restaurants, Groceries, Work Expenses,
    // Entertainment, Paycheques, Rent, Utilities
    this.accounts.add({
        type: 'credit',
        name: 'Paycheques',
        color: '#17370f'
    });
    this.accounts.add({
        type: 'credit',
        name: 'Freelance',
        color: '#17370f'
    });
    this.accounts.add({
        type: 'credit',
        name: 'Lottery',
        color: '#17370f'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Restaurants',
        color: '#81f23e'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Groceries',
        color: '#10fe23'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Work Expenses',
        color: '#a3d20f'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Entertainment',
        color: '#93ab12'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Rent',
        color: '#0f12ef'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Utilities',
        color: '#9f293a'
    });

    // Setup any predefined Views that need to wait for DOM ready
    // Note: Has to happen after model population
    this.transactionForm= new TransactionForm();

    // Fun!
    this.runScriptedUser();
}
DailyFinance.prototype.runScriptedUser = function()
{
    var queue = [];

    // I put together some presets that will make writing transactions easier
    var accountsByCid = {
        c1: {
            type: 'credit',
            account_cid: this.accounts.getCidByName('Paycheques')
        },
        c2: {
            type: 'credit',
            account_cid: this.accounts.getCidByName('Freelance')
        },
        c3: {
            type: 'credit',
            account_cid: this.accounts.getCidByName('Lottery')
        },
        d1: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Groceries')
        },
        d2: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Restaurants')
        },
        d3: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Work Expenses')
        },
        d4: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Entertainment')
        },
        d5: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Rent')
        },
        d6: {
            type: 'debit',
            account_cid: this.accounts.getCidByName('Utilities')
        }
    }

    // And this is just a super lazy way of setting the remaining attributes
    function enqueu(accountCid, amount, description)
    {
        var transaction = _.clone(accountsByCid[accountCid]);
        transaction.amount = amount;
        transaction.description = description;

        queue.push(transaction);
    }

    // We'll apply our mock transactions here
    function deque() {
        var transaction = queue.shift();
        App.transactionForm.model.set(transaction)
        //App.transactionForm.updateAccountOptions();

        setTimeout(function() {
            // Apply what the user has been staring at
            App.transactionForm.applyTransaction();

            // Go again
            if (queue.length > 0) {
                deque()
            }
        }, 2000);
    }

    enqueu('c1', 1000);
    enqueu('c2', 2000);
    enqueu('c3', 5000);
    enqueu('d1', 100.55);
    //enqueu('d1', 500);
    //enqueu('c1', 250);
    //enqueu('d1', 500);

    deque();
}
DailyFinance.prototype.render = function()
{
    // Set the workspace height
    var windowHeight = $(window).height();
    var headerHeight = $('#header').outerHeight();
    var footerHeight = $('#footer').outerHeight();
    var workspaceHeight = windowHeight - (headerHeight + footerHeight) + 'px';

    $('#income-scale').css({ height: workspaceHeight });
    $('#transaction-history').css({ height: workspaceHeight });
}
DailyFinance.prototype.util = {
    divideEvenly: function(amount, divisor)
    {
        var remainder = amount * 100; // 100.50 > 10050
        var parts = divisor;
        var split = [];

        while (remainder > 0) {
            var part = Math.round(remainder / parts);
            remainder -= part;
            parts -= 1;
            split.push((part / 100)) // 10050 > 100.50
        }

        return split;
    }
}

// Make the program globally accessible, give it a short
// name to work with (we're not worried about conflicts)
window.App = new DailyFinance();

// Start the program
$(document).ready(function()
{
    console.log('Ready!');
    App.initialize();
});

})(Backbone, _, $);