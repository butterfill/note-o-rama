/**
 * Show functions to be exported from the design doc.
 */

var templates = require('kanso/templates'),
    uuid_sync = require('./uuid');
    nrama_constructors = require('./nrama2');

var nrama = {};
nrama.uuid = nrama_constructors._make_uuid(uuid_sync);

exports.welcome = function (doc, req) {
    var data = {
        anon_user_name : '*'+nrama.uuid(true).slice(0,10)
    };

    return {
        title: 'Note-o-rama : note - quote - analyse',
        content: templates.render('welcome.html', req, data)
    };
};

exports.not_found = function (doc, req) {
    return {
        title: '404 - Not Found',
        content: templates.render('404.html', req, {})
    };
};
