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
 * e.g.(single user)
 *   http://localhost:5984/nrama/_design/nrama/_rewrite/source?key=["http://en.wikipedia.org/wiki/Komodo_dragons?h=i","steve@gmail.com"]
 * or using the rewrites for /user/user_id/source/page_id:
 *  http://localhost:5984/nrama/_design/nrama/_rewrite/user/steve@gmail.com/source/http%3A%2F%2Fstackoverflow.com%2Fquestions%2F332872%2Fhow-to-encode-a-url-in-javascript
 * e.g. (all users)
 *  http://localhost:5984/nrama/_design/nrama/_rewrite/source?startkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons?h=i%22,%22steve@gmail.com%22]&endkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons?h=i%22,{}]
 *
 * NB use encodeURIComponent to put a page_idinto a url!
 *
 */
exports.source = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var quotes = [];
    var find_quote = {};    //indexed by _id
    var notes_for_quotes = {};
    var find_note = {}; //indexed by _id
    var user_id = null;
    var multiple_user_ids = false;
    
    var title = null;
    var row = getRow();
    while( row ) {
        var thing = row.value;
        
        // -- set title (only held on quotes, not notes)
        if( !title && thing.page_title ) {
            title = thing.page_title;
        }
        
        if( thing.user_id ) {
            if( user_id && thing.user_id != user_id ) {
                multiple_user_ids = true;
            }
            user_id = thing.user_id;
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
    
    // -- configure note edit event
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
                    $note.text(note.content);   //must update text for sorting to work
                    //$note.parents('ul.notes').first().sortlist(); //sorting sometimes makes it seem the note disappeared
                } else {
                    note.content = old_content;
                    $note.css('color','red').removeAttr('disabled');
                }
            });        
        });
    }
    
    //configure add a note
    if( req.client ) {
        $('.add-a-note').die().live('click', function(){
            console.log('add a note ...');
            var $quote = $(this).parents('.quote').first();
            var quote = find_quote[$quote.attr('id')];
            db.newUUID(function(error,uuid){
                if(error) {
                    console.log(error);
                    return;
                }
                console.log(uuid);
                var note = {
                    _id : uuid,
                    uuid : uuid,
                    type : 'note',
                    content : "type here",
                    quote_uuid : quote.uuid,
                    page_id : quote.page_id,
                    url : quote.url,
                    created : new Date().getTime(),
                    user_id : req.userCtx.name
                }
                find_note[note._id] = note;
                var note_html = '<li class="note"><textarea id="'+note._id+'" class="note-content">'+note.content+'</textarea></li>';
                $note = $(note_html);
                $('ul.notes',$quote).prepend($note);
                $note.hide().show(500, function(){ $('#'+note._id).autogrow().focus().select(); });
                console.log('done');
            });
        });
    }
    

    //used in template : returns true if the item in the current context, note or quote, is the user's
    var is_user_page = req.client && (!multiple_user_ids) && user_id==req.userCtx.name ;
    
    var data = {
        title : (title || 'untitled'),
        quotes : quotes,
        is_user_page : is_user_page,
        multiple_user_ids : multiple_user_ids,
        user_id : user_id
    };
    
    
    var content = templates.render('source.html', req, data);
    
    // communicate with window so that can do stuff after HTML rendered
    // this is probably a sign I should have built this with widgets.  Oh well.
    if( req.client ) {
        window._is_client_rendered=true;
    } 

    return {title: 'note-o-rama : '+title, content: content };
}