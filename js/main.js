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

    console.log(windowHeight, headerHeight, footerHeight, workspaceHeight);

    //console.log(workspaceHeight); return;

    $('#workspace').css({ height: workspaceHeight });

    console.log($('#workspace').css('height'));
}, 300));