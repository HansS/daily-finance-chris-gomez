(function(Backbone, _, $) {

/**
 * Transaction
 *
 * A record of money movement
 **/
var Transaction = Backbone.Model.extend({
    defaults: {
        type: 'debit',
        amount: '',
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
    deposit: function(amount, options)
    {

        var amount = parseFloat(amount, 10);
        var balance = this.get('balance');
        var total = balance + amount;

        this.set({
            balance: total
        });
    },
    withdraw: function(amount, options)
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
 * TransactionLog
 *
 * A collection of Transaction Models
 **/
var TransactionLog = Backbone.Collection.extend({
    model: Transaction,
    initialize: function()
    {
        this.bind('add', this.fillInBlanksOnAdd, this);
        this.bind('add', this.createTransactionRecord, this);
        this.bind('add', this.distributeFunds, this);
    },
    fillInBlanksOnAdd: function(model)
    {
        // We can't use defaults: because they're bound to the view
        // Don't want the user to have to undo them to enter data
        if (! model.has('description')) {
            model.set({
                description: '-'
            });
        }

        // Sometimes we set it manually before here
        if (! model.has('created_at')) {
            model.set({
                created_at: new Date()
            })
        }

        model.set({
            timestamp: model.get('created_at').getTime()
        })

        var account = App.accounts.getByCid(model.get('account_cid'));
        var date = moment(model.get('created_at'));

        // Create some helper values for the view
        model.set({
            account_name: account.get('name'),
            created_date: date.date(),
            created_month: date.format('MMM'),
            created_year: date.year(),
            display_amount:
                (model.get('type') == 'debit' ? '-' : '+') + ' $' + model.get('amount')
        })


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

        // Move the money around
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
                    account.withdraw(portion, { silent: true })
                })
            }

            // Deposit the money
            account.deposit(transaction.get('amount'), { silent: true });
        });

        var totals = {
            'credit': 0,
            'debit': 0
        }

        // Add up the final numbers
        App.accounts.each(function(account) {
            totals[account.get('type')] += account.get('balance');
        })

        $('#money-out-the-door').text(totals.debit);
        $('#money-in-the-bank').text(totals.credit);
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
        var view = new AccountStatus({
            model: model
        })

        App.accountViews.push(view);
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
 * FeatureBar
 *
 * All the buttons at the bottom of the page
 **/
var FeatureBar = Backbone.View.extend({
    el: '#feature-bar',
    events: {
        //'click #create-category-btn': 'addCategory'
        'click #scope-select li': 'setScope'
    },
    initialize: function()
    {
        // Strange.. I couldn't get the backbone events feature working. Works
        // elsewhere.. ?
        $('#create-category-btn').click(this.addCategory);

        $('#open-category-modal-btn').click(this.focusOnModalInput);

        App.transactionWall.setScope('day')
    },
    setScope: function(e)
    {
        $('#scope-select li').each(function(i, e) {
            $(e).removeClass('active');
        });

        var li = $(e.currentTarget)
        li.addClass('active');

        var scope = li.find('.pill').text().toLowerCase();

        App.transactionWall.setScope(scope)
    },
    focusOnModalInput: function()
    {
        // This should work!
        $('input#category_name').focus();
    },
    addCategory: function()
    {
        var nameInput = $('#category_name');
        var typeInput = $('#category_type');

        App.accounts.add({
            name: nameInput.val(),
            type: typeInput.val()
        })

        App.transactionForm.updateAccountOptions();

        $('#category-modal').modal('hide');
    }
})

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
        var availableHeight = $('#income-scale').outerHeight();
        var availableWidth = $(this.el).parent().parent().width();
        var accounts = App.accounts.getByType(this.model.get('type'));
        var currentBalance = this.model.get('balance');
        var totalBalance = 0;

        // Add up the total balance
        _(accounts).each(function(account) {
            totalBalance += account.get('balance');
        });

        // Find out how much our balance represents of all the accounts
        // of the same type
        if (currentBalance == 0 || totalBalance == 0) {
            var percentageOfBalance = 0;
        } else {
            var percentageOfBalance = (currentBalance / totalBalance);
        }

        // Get a pixel value using the percentage (minus borders)
        var relativeWidth =
            (availableWidth * percentageOfBalance)
            - ($(this.el).outerWidth() - $(this.el).width())


        // Split the available vertical space evenly (minus borders)
        var equalHeight =
            (availableHeight / accounts.length)
            - ($(this.el).outerHeight(true) - $(this.el).height())

        // Split the vertical space evenly
        li.find('.bar').animate({
            height: equalHeight + 'px',
            width: relativeWidth + 'px'
        }, {
            duration: 500,
            queue: false
        })

    }
})

/**
 * TransactionRecord
 *
 * A line item for a transaction
 **/
var TransactionRecord = Backbone.View.extend({
    tagName: 'div',
    className: 'transaction clearfix',
    initialize: function()
    {
        // Add the markup to this.el
        $(this.el).html($('#transaction-template').html());

        // Add the transaction to the list
        App.transactionWall.insertRecord(this);

        Backbone.ModelBinding.bind(this);
    }
})


/**
 * TransactionWall
 *
 * A list of organized transactions
 **/
var TransactionWall = Backbone.View.extend({
    el: '#transaction-wall',
    events: {
        'click .register-click': 'displayHistory'
    },
    initialize: function()
    {
        // Pretty up the standard scrollbars
        $(this.el).jScrollPane({
            hideFocus: true,
            verticalGutter: 10,
        });

        this.pane = $(this.el).find('.jspPane');
    },
    setScope: function(scope)
    {
        $(this.el).removeClass('day-scope month-scope year-scope')
            .addClass(scope + '-scope');

        // Let the scrollbar plugin know that it likely has a new height
        $(this.el).data('jsp').reinitialise()
    },
    insertRecord: function(transactionRecord)
    {
        // This is a WAY hacky way for me to insert headings into the wall
        // regarding the times the transactions where recorded. It could
        // probably have been automated and there's no good reason to have
        // HTML in my script
        var date = transactionRecord.model.get('created_at');

        var year = moment(date).year();
        var month = moment(date).month();
        var day = moment(date).day();

        var yearKey = year;
        var monthKey = [year, month].join('-');
        var dayKey = [year, month, day].join('-');

        var yearHeadingId = '#heading-' + yearKey;
        var monthHeadingId = '#heading-' + monthKey;
        var dayHeadingId = '#heading-' + dayKey;

        if (! $(yearHeadingId).length) {
            $(this.pane).prepend(
                '<h3 class="year-heading alt-font" id="heading-' + yearKey + '">'
                    + moment(date).format('YYYY')
                + '</h3>')

        }

        if (! $(monthHeadingId).length) {
            $(yearHeadingId).after(
                '<h3 class="month-heading alt-font" id="heading-' + monthKey + '">'
                    + moment(date).format('MMMM, YYYY')
                + '</h3>')
        }

        if (! $(dayHeadingId).length) {
            $(monthHeadingId).after(
                '<h3 class="day-heading alt-font" id="heading-' + dayKey + '">'
                    + moment(date).format('dddd, MMMM Do YYYY')
                + '</h3>')
        }

        // Add the actual record to the list
        $(dayHeadingId).after(transactionRecord.el);

        // Let the scrollbar plugin know that it likely has a new height
        $(this.el).data('jsp').reinitialise()
    },
    displayHistory: function()
    {
        var timestamp = $(this.el).find('.timestamp').text();
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
DailyFinance.prototype.accountViews = [];
DailyFinance.prototype.accounts = new Bank();
DailyFinance.prototype.transactions = new TransactionLog();
DailyFinance.prototype.initialize = function()
{
    // Initial render();
    this.render();

    // Times when we'll want to rerender
    $(window).resize(_.debounce(this.render, 300));
    this.accounts.bind('add', this.render, this);
    //this.accounts.bind('change:balance', this.render, this);

    // Create the default accounts
    // Restaurants, Groceries, Work Expenses,
    // Entertainment, Paycheques, Rent, Utilities
    this.accounts.add({
        type: 'credit',
        name: 'Paycheques'
    });
    this.accounts.add({
        type: 'credit',
        name: 'Freelance'
    });
    this.accounts.add({
        type: 'credit',
        name: 'Lottery'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Restaurants'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Groceries'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Work Expenses'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Entertainment'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Rent'
    });
    this.accounts.add({
        type: 'debit',
        name: 'Utilities'
    });

    // Setup any predefined Views that need to wait for DOM ready
    // Note: Has to happen after model population
    this.transactionForm = new TransactionForm();
    this.transactionWall = new TransactionWall();
    this.featureBar = new FeatureBar();

    // Pretend to be a user
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
    function enqueu(accountCid, amount, date, description)
    {
        var transaction = _.clone(accountsByCid[accountCid]);
        transaction.amount = amount;
        transaction.description = description;

        // Causes .has() to fail otherwise
        if (date) {
            transaction.created_at = date;
        }

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
        }, 1000);
    }

    enqueu('c1', 1000, new Date(2011, 1, 1));
    enqueu('c2', 2000, new Date(2011, 1, 2));
    enqueu('c3', 5000, new Date(2011, 2, 1));
    enqueu('d1', 100.55, new Date(2011, 2, 1));
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
    // Had to add in padding by hand.. running out of time
    // Don't ask how I got to 46
    var workspaceHeight =
        windowHeight - (headerHeight + footerHeight + 40) + 'px';

    $('#income-scale').css({ height: workspaceHeight });
    $('#transaction-wall').css({ height: workspaceHeight });

    if (App.transactionWall) {
        $(App.transactionWall.el).data('jsp').reinitialise()
    }

    _(App.accountViews).each(function(view) {
        view.render();
    });

    console.log('>>> Rendered!')
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
    console.log('>>> Ready!');
    App.initialize();
});

})(Backbone, _, $);