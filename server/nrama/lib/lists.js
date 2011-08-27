/**
 * List functions to be exported from the design doc.
 */
var templates = require('kanso/templates'),
    events = require('kanso/events'),
    db = require('kanso/db');

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
 * notes & quotes on a particular source
 * works with view pageId_userId
 *
 * e.g.
 *   http://localhost:5984/nrama/_design/nrama/_rewrite/source?startkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons%22]&endkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons%22,{}]
 * 
 */
exports.source = function(head,req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var quotes = [];
    var find_quote = {};    //indexed by _id
    var notes_for_quotes = {};
    var find_note = {}; //indexed by _id
    
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
            find_quote[quote._id] = quote;
            quotes.push(quote);
        }
        if( thing.type == 'note' ) {
            var note = thing;
            find_note[note._id] = note;
            if( !notes_for_quotes[note.quote_uuid]  ) {
                notes_for_quotes[note.quote_uuid] = [];
            }
            notes_for_quotes[note.quote_uuid].push(note);
        }
        
        row = getRow();
    }
    
    // -- sort quotes by page_order
    var quote_sorter = function(a,b){ return a.page_order > b.page_order };
    quotes.sort(quote_sorter);
    
    // -- attach notes to quotes
    for( idx in quotes ) {
        var quote = quotes[idx];
        quote.notes = notes_for_quotes[quote._id] || [];
    }
    
    // -- configure note edit events
    if( req.client ) {
        $('textarea.note-content').die().live('blur', function(){
            //console.log('caught blur: saving note ...');
            var $note = $(this);
            $note.attr('disabled','disabled');
            var note_id = $(this).attr('id');
            var note = find_note[note_id];
            var old_content = note.content;
            var new_content = $note.val();
            if( old_content == new_content ) {
                $note.removeAttr('disabled');
                return;
            }
            if( new_content == '' ) {
                //delete note
                db.removeDoc(note, {}, function(error,data){
                    if( !error ) {
                        $note.parents('li.note').hide(1000, function(){ $note.remove(); });
                    } else {
                        note.content = old_content;
                        $note.css('color','red').removeAttr('disabled');
                    }
                });
                return;
            } 
            $note.css('color','#3300CC').css('text-shadow','0 0 2px #555555');
            note.content = new_content;
            db.saveDoc(note, {}, function(error, data){
                if( !error ) {
                    note._rev = data.rev;
                    $note.css('color','black').css('text-shadow','none').removeAttr('disabled');
                } else {
                    note.content = old_content;
                    $note.css('color','red').removeAttr('disabled');
                }
            });        
        });
    }
    
    var data = {
        title : (title || 'untitled'),
        quotes : quotes,
        call_me_sometime : function(){return 'hi --- call_me_sometime ';}
    };
    
    var content = templates.render('source.html', req, data);

    return {title: 'note-o-rama : '+title, content: content };
}