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

    // generate the markup for a list of users
    var content = templates.render('all_users.html', req, { users : users });

    return {title: 'note-o-rama : all users', content: content};

};

/**
 * A list of sources (just urls --- TODO supply author, title)
 * works with view userId_pageId
 *
 * e.g.
 *   http://localhost:5984/nrama/_design/nrama/_list/sources/userId_pageId
 *   http://localhost:5984/nrama/_design/nrama/_list/sources/userId_pageId?group=true&startkey=[%22steve@gmail.com%22]&endkey=[%22steve@gmail.com%22,{}]
 */
exports.sources = function(head, req) {

    start({code: 200, headers: {'Content-Type': 'text/html'}});
    
    var sources = [];
    var row = getRow();
    while( row ) {
        var source = {};
        source.user_id = row.key[0];
        source.page_id = row.key[1];
        source.nof_items = row.value;
        sources.push(source);
        row = getRow();
    }

    var content = templates.render('sources.html', req, { sources : sources });

    return {title: 'note-o-rama : my sources', content: content };
};

/**
 * notes & quotes on a particular source, with the currently logged in user's first.
 *
 * works with view pageId_type_userId
 *
 * e.g.
 *   http://localhost:5984/nrama/_design/nrama/_rewrite/source?startkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons%22]&endkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons%22,{}]
 * 
 */
exports.source = function(head,req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var user_id = req.userCtx.name;

    var my_quotes = [];
    var all_other_quotes = [];
    var notes_for_quotes = {};
    
    var title = null;
    var row = getRow();
    while( row ) {
        var thing = row.value;
        
        // -- set title (only held on quotes, not notes)
        if( !title && thing.page_title ) {
            title = thing.page_title;
        }
        
        if( thing.type == 'quote' ) {
            var quote = thing;
            if( user_id == quote.user_id ) {
                my_quotes.push(quote);
            } else {
                all_other_quotes.push(quote);
            }
        }
        if( thing.type == 'note' ) {
            var note = thing;
            if( !notes_for_quotes[note.quote_uuid]  ) {
                notes_for_quotes[note.quote_uuid] = [];
            }
            notes_for_quotes[note.quote_uuid].push(note);
        }
        
        row = getRow();
    }
    
    // -- sort quotes by page_order
    var quote_sorter = function(a,b){ return a.page_order > b.page_order };
    my_quotes.sort(quote_sorter);
    all_other_quotes.sort(quote_sorter);

    // -- attach notes to quotes
    var attach_notes = function attach_notes(quote_list) {
        for( idx in quote_list ) {
            var quote = quote_list[idx];
            quote.notes = notes_for_quotes[quote._id] || [];
        }
    };
    attach_notes(my_quotes);
    attach_notes(all_other_quotes);

    // -- function that writes user name only if a note (or other thing) is not from the current user
    var write_user_id = function(chunk, context){
        var thing_user_id = context.get('user_id');
        if( thing_user_id != user_id ) {
            return chunk.write('<span class="other-user">['+thing_user_id+']</span> ');
        } else {
            return chunk.write('');
        }
    };
    
    var data = {
        title : (title || 'untitled'),
        my_quotes : my_quotes,
        all_other_quotes : all_other_quotes,
        write_user_id : write_user_id
    };
    var content = templates.render('source.html', req, data);

    return {title: 'note-o-rama : '+title, content: content };
}