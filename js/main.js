(function(Backbone, _, $, dust) {

var Transaction = Backbone.Model.extend({
    defaults: {
        account_type: 'debit',
        amount: '12.10',
        description: 'ex: lunch with client, taxi fare, etc..'
    },
    initialize: function()
    {

        var accounts = App.accounts.getByType(this.get('account_type'));

        var firstAccountCid = accounts[0].cid;

        this.set({
            account_cid: firstAccountCid
        })
    }
})

var TransactionForm = Backbone.View.extend({
    el: '#transaction-form',
    events: {
        'change select#account_type': 'onTypeChange',
        'submit': 'onSubmit'
    },
    initialize: function()
    {
        this.model = new Transaction();

        // Setup the select field with categories
        this.onTypeChange();

        // Make sure amount is always a in currency format
        $('#amount').maskMoney().mask();

        // Bind model to view!
        Backbone.ModelBinding.bind(this);
    },
    onTypeChange: function() {
        var type = this.model.get('account_type');

        var accounts = App.accounts.getByType(type);

        var select = $('#account_cid');
        select.empty()

        for (var index in accounts) {
            var account = accounts[index];

            // I hope I don't get points off for this!
            select.append('<option value="' + account.cid + '">' + account.get('name') + '</option>')
        }

        var firstAccountCid = accounts[0].cid;

        this.model.set({ account_cid: firstAccountCid });
    },
    onSubmit: function(e) {

        // validate

        var account = App.accounts.getByCid(this.model.get('account_cid'));

        if (this.model.get('account_type') == 'debit') {
            account.deposit(this.model.get('amount'));
        }

        return false;
    }
});

var AccountStatus = Backbone.View.extend({
    tagName: 'li',
    parentId: '#',
    initialize: function()
    {
        var self = this;

        this.parentId = '#' + this.model.get('account_type') + '-categories'

        // Add the markup to this.el
        $(this.el).html($('#account-status-template').html());

        // Insert this.el into the DOM
        $(this.parentId).append(this.el);

        // Bind model to view!
        Backbone.ModelBinding.bind(this)

        this.model.bind('change:balance', this.onBalanceChange, this);

        this.render();
    },
    onBalanceChange: function() {
        this.render();
    },
    render: function() {
        var li = $(this.el);
        li.css({backgroundColor: this.model.get('color')})
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
    deposit: function(amount) {

        var amount = parseFloat(amount, 10);
        var balance = this.get('balance');
        var total = balance + amount;
        console.log(amount, balance, total)
        this.set({
            balance: total
        });
    }
});

/**
 * Bank
 *
 * A collection of Account Models
 **/
var Bank = Backbone.Collection.extend({
    model: Account,
    initialize: function(options)
    {
        this.bind('add', this.onAddModel, this);
    },
    getByType: function(type) {
        return this.filter(function(account) {
            return account.get('account_type') == type;
        });
    },
    onAddModel: function(model)
    {
        //console.log('Bank:', model.get('name'), 'account added')

        // Create the AccountStatus view
        new AccountStatus({
            model: model
        })
    }
});

function DailyFinance()
{
}
DailyFinance.prototype.accounts = new Bank();
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
        account_type: 'credit',
        name: 'Paycheques',
        color: '#17370f'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Restaurants',
        color: '#81f23e'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Groceries',
        color: '#10fe23'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Work Expenses',
        color: '#a3d20f'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Entertainment',
        color: '#93ab12'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Rent',
        color: '#0f12ef'
    });
    this.accounts.add({
        account_type: 'debit',
        name: 'Utilities',
        color: '#ef293a'
    });

    // Setup any predefined Views that need to wait for DOM ready
    // Note: Has to happen after model population
    this.transactionForm= new TransactionForm();
}
DailyFinance.prototype.render = function()
{
    // Set the workspace height
    var windowHeight = $(window).height();
    var headerHeight = $('#header').outerHeight();
    var footerHeight = $('#footer').outerHeight();
    var workspaceHeight = windowHeight - (headerHeight + footerHeight) + 'px';

    $('#workspace').css({ height: workspaceHeight });
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

})(Backbone, _, $, dust);