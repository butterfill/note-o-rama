/**
 * List functions to be exported from the design doc.
 */
var templates = require('kanso/templates');

exports.all_users = function (head, req) {

    start({code: 200, headers: {'Content-Type': 'text/html'}});

    // fetch all the rows
    var users = [];
    var user = getRow();
    while ( user ) {
        users.push(user);
        user = getRow();
    }

    // generate the markup for a list of blog posts
    var content = templates.render('all_users.html', req, {
        users : users
    });

    return {title: 'note-o-rama : all users', content: content};

};
