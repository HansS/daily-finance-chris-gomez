/**
 * Purse
 *
 * A place to put money
 **/
var Purse = Backbone.Model.extend({

});

/**
 * Transaction
 *
 * A transfer of money
 **/
var Transaction = Backbone.Model.extend({

});

$(document).ready(function() {
    window.user = new Purse();
})

$(window).resize(_.debounce(function() {
    var windowHeight = $(window).height();
    var headerHeight = $('#header').outerHeight();
    var footerHeight = $('#footer').outerHeight();
    var workspaceHeight = windowHeight - (headerHeight + footerHeight) + 'px';

    $('#workspace').css({ height: workspaceHeight });
}, 300));