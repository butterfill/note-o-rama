/**
 * Bindings to Kanso events
 *
 * (most of this is taken from the kanso admin app example,
 *      https://github.com/caolan/kanso/blob/master/admin/lib/app.js)
 */

var events = require('kanso/events'),
    session = require('kanso/session'),
    templates = require('kanso/templates'),
    events = require('kanso/events'),
    db = require('kanso/db');



/**
 * The init method fires when the app is initially loaded from a page rendered
 * by CouchDB.
 */
events.on('init', function () {
    bindSessionControls();
});


/**
 * The sessionChange event fires when the app is first loaded and the user's
 * session information becomes available. It is also fired whenever a change
 * to the user's session is detected, for example after logging in or out.
 */
events.on('sessionChange', function (userCtx, req) {
    $('#session').replaceWith(templates.render('session.html', req, userCtx));
    bindSessionControls();
});



/**
 * The updateFailure event fires when an update function returns a document as
 * the first part of an array, but the client-side request to update the
 * document fails.
 */

events.on('updateFailure', function (err, info, req, res, doc) {
    alert(err.message || err.toString());
});


// --- nrama only after here

/**
 * afterResponse is not documented, but I think it fires after the
 * document has been rendered by the client (and not after rendering by the server)
 */
events.on('afterResponse', function(info, req, res) {
	if( req.client && typeof $ !=='undefined' ) {
        $('._timeago').timeago();
        $('._sort-me').sortlist();
        $('textarea._nrama-note-content').autogrow();
	}
    
});


// --- taken from the kanso admin app
var bindSessionControls = function () {
    $('#session .logout a').click(function (ev) {
        ev.preventDefault();
        session.logout();
        return false;
    });
    $('#session .login a').click(function (ev) {
        ev.preventDefault();
        var div = $('<div><h2>Login</h2></div>');
        div.append('<form id="login_form" action="/_session" method="POST">' +
            '<div class="general_errors"></div>' +
            '<div class="username field">' +
                '<label for="id_name">Username</label>' +
                '<input id="id_name" name="name" type="text" />' +
                '<div class="errors"></div>' +
            '</div>' +
            '<div class="password field">' +
                '<label for="id_password">Password</label>' +
                '<input id="id_password" name="password" type="password" />' +
                '<div class="errors"></div>' +
            '</div>' +
            '<div class="actions">' +
                '<input type="button" id="id_cancel" value="Cancel" />' +
                '<input type="submit" id="id_login" value="Login" />' +
            '</div>' +
        '</form>');
        $('#id_cancel', div).click(function () {
            $.modal.close();
        });
        $('form', div).submit(function (ev) {
            ev.preventDefault();
            var username = $('input[name="name"]', div).val();
            var password = $('input[name="password"]', div).val();
            console.log($('.username .errors', div));
            $('.username .errors', div).text(
                username ? '': 'Please enter a username'
            );
            $('.password .errors', div).text(
                password ? '': 'Please enter a password'
            );
            if (username && password) {
                session.login(username, password, function (err) {
                    $('.general_errors', div).text(err ? err.toString(): '');
                    if (!err) {
                        $(div).fadeOut('slow', function () {
                            $.modal.close();
                        });
                    }
                });
            }
            return false;
        });
        div.modal({autoResize: true, overlayClose: true});
        return false;
    });
    $('#session .signup a').click(function (ev) {
        ev.preventDefault();
        var div = $('<div><h2>Create an account</h2></div>');
        div.append("<p>It's free.</p>");
        div.append('<form id="signup_form" action="/_session" method="POST">' +
            '<div class="general_errors"></div>' +
            '<div class="username field">' +
                '<label for="id_name">Username</label>' +
                '<input id="id_name" name="name" type="text" />' +
                '<div class="errors"></div>' +
            '</div>' +
            '<div class="password field">' +
                '<label for="id_password">Password</label>' +
                '<input id="id_password" name="password" type="password" />' +
                '<div class="errors"></div>' +
            '</div>' +
            '<div class="actions">' +
                '<input type="button" id="id_cancel" value="Cancel" />' +
                '<input type="submit" id="id_create" value="Create" />' +
            '</div>' +
        '</form>');
        $('#id_cancel', div).click(function () {
            $.modal.close();
        });
        $('form', div).submit(function (ev) {
            ev.preventDefault();
            var username = $('input[name="name"]', div).val();
            var password = $('input[name="password"]', div).val();
            console.log($('.username .errors', div));
            $('.username .errors', div).text(
                username ? '': 'Please enter a username'
            );
            $('.password .errors', div).text(
                password ? '': 'Please enter a password'
            );
            if (username && password) {
                session.signup(username, password, function (err) {
                    $('.general_errors', div).text(err ? err.toString(): '');
                    if( err.status === 409 || err.error === 'conflict' ) {
                        $('.general_errors', div).text('That username is already taken');
                    }
                    if (!err) {
                        session.login(username, password, function (err) {
                            $('.general_errors', div).text(err ? err.toString(): '');
                            $(div).fadeOut('slow', function () {
                                $.modal.close();
                            });
                        });
                    }
                });
            }
            return false;
        });
        div.modal({autoResize: true, overlayClose: true});
        return false;
    });
};