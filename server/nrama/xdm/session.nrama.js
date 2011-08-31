/**
 * modified to use in browser independently of the whole kanso app
 * quite a bit of the functionality has been removed.
 *
 * converted from CommonJS to ordinary, embeddable JS:
 *  exports becomes session
 *
 * depends: db.nrama.js
 *
 * Modifying individual functions has been avoided: they are either deleted or stubbed.
 * 
 * Functions related to the management of user sessions and account information.
 *
 * @module
 */

// This is no longer CommonJS
session = {};
(function(exports){
    /**
     * Module dependencies
     */
    /*
    var db = require('./db'),       //this is required 
        sha1 = require('./sha1'),   //not required
        cookies = require('./cookies'), //not required
        events = require('./events')  //not required
        utils = require('./utils');  //utils object and utils.isBrowser provided in db.nrama.js
    */
    
    
    /**
     * exports.fakeRequest deleted
     */
    
    /**
     * exports.sessionChange stubbed
     */
    exports.sessionChange = function (userCtx, callback) {
        if (callback) {
            callback();
        }
    };
    
    /**
     * Logs out the current user.
     *
     * @name logout(callback)
     * @param {Function} callback
     * @api public
     */
    exports.logout = function (callback) {
        if (!utils.isBrowser()) {
            throw new Error('logout cannot be called server-side');
        }
        db.request({
            type: "DELETE",
            url: "/_session", // don't need baseURL, /_session always available
            username: "_",
            password : "_"
        },
        function (err, resp) {
            if (resp && resp.ok) {
                utils.userCtx = {name: null, roles: []};
                utils.session = {userCtx: utils.userCtx};
                exports.sessionChange(utils.userCtx);
            }
            if (callback) {
                callback(err, resp);
            }
        });
    };
    
    /**
     * Attempt to login using the username and password provided.
     *
     * @name login(username, password, callback)
     * @param {String} username
     * @param {String} password
     * @param {Function} callback
     * @api public
     */
    
    exports.login = function (username, password, callback) {
        if (!utils.isBrowser()) {
            throw new Error('login cannot be called server-side');
        }
        db.request({
            type: "POST",
            url: "/_session",
            data: {name: username, password: password}
        },
        function (err, resp) {
            if (resp && resp.ok) {
                // TODO: for some reason resp.name is set to null in the response
                // even though the roles are correct for the user! Look into this
                // and see if its a bug in couchdb, for now, just using the username
                // given to the login function instead, since we know the login
                // request was accepted.
                //utils.userCtx = {name: resp.name, roles: resp.roles};
                utils.userCtx = {name: username, roles: resp.roles};
                utils.session = {userCtx: utils.userCtx};
                exports.sessionChange(utils.userCtx);
            }
            if (callback) {
                callback(err, resp);
            }
        });
    };
    
    
    /**
     * Returns the current user's session information.
     *
     * @name info(callback)
     * @param {Function} callback
     * @api public
     */
    
    exports.info = function (callback) {
        if (!utils.isBrowser()) {
            throw new Error('info cannot be called server-side');
        }
        db.request({
            type: "GET",
            url: "/_session"
        },
        function (err, resp) {
            var oldUserCtx = utils.userCtx;
            utils.session = resp;
            utils.userCtx = (resp && resp.userCtx) || {name: null, roles: []};
            // TODO: should this check for differences in more than just name?
            if (!oldUserCtx || oldUserCtx.name !== utils.userCtx.name) {
                exports.sessionChange(utils.userCtx);
            }
            if (callback) {
                callback(err, resp);
            }
        });
    };
    
    /**
     * exports.userDb removed
     */
    
    
    /**
     * exports.signup  removed
     */
    
})(session);