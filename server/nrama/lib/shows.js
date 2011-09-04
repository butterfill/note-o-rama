/**
 * Show functions to be exported from the design doc.
 */

var templates = require('kanso/templates');


exports.welcome = function (doc, req) {
    return {
        title: 'Note-o-rama : note - quote - analyse',
        content: templates.render('welcome.html', req, {})
    };
};

exports.not_found = function (doc, req) {
    return {
        title: '404 - Not Found',
        content: templates.render('404.html', req, {})
    };
};
