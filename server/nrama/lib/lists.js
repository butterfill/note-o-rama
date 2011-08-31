/**
 * List functions to be exported from the design doc.
 */
var templates = require('kanso/templates'),
    events = require('kanso/events'),
    db = require('kanso/db'),
    _ = require('kanso/underscore')._;

exports.all_users = function (head, req) {

    start({code: 200, headers: {'Content-Type': 'text/html'}});

    // fetch all the rows
    var users = [];
    var user = getRow();
    while( user ) {
        users.push(user);
        user = getRow();
    }

    // generate the markup for a list of users
    var content = templates.render('all_users.html', req, { users : users });

    return {title: 'note-o-rama : all users', content: content};

};


/**
 * show sources
 *
 * to show all sources for single user (or all users),
 * works with view userId_source
 *
 * to show sources for an author (either for single user or all users)
 * works with view author_userId
 * 
 */
exports.sources = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var user_url,
        user_id,
        author,
        author_url;
    if( req.query.user_id ) {
        user_id = req.query.user_id ;
        user_url = '/user/'+encodeURIComponent(user_id);
    }
    if( req.query.author ) {
      author = req.query.author;
      author_url = '/author/'+encodeURIComponent(author);
    }
    if( author && user_id ) {
      user_author_url = user_url + '/' + author_url;
    }
    
    var sources = [];
    var row;
    while( row = getRow() ) {
        if( row.value || row.doc ) {
            var thing = row.value || row.doc;
            if( thing.type && thing.type == 'source' ) {
                if( thing.page_id ) {
                    thing.page_id_enc = encodeURIComponent(thing.page_id);
                }
                if( thing.updated ) {
                    thing.updated_time = new Date(thing.updated).toISOString();   //human-readable
                }
                sources.push(thing);
            }
        }
    }
    
    //TODO remove (for testing only)
    if( req.client ) {
      window.req = req
    }
    
    var content = templates.render('sources.html', req, {
        user_url : user_url,
        user_id : user_id,
        author : author,
        author_url : author_url,
        sources : sources
    });

    return {title: 'note-o-rama : sources', content: content };
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
    if( req.query.user_id ) {
        user_id = req.query.user_id;    //we are displaying this for a specific user
    }
    
    var title = null,
        url = null,
        page_id = null,
        source = null;
    var row = getRow();
    while( row ) {
        var thing = row.value || row.doc;
        
        // -- set title &c (only held on quotes, not notes)
        if( !title && thing.page_title ) { title = thing.page_title; }
        if( !url && thing.url ) { url = thing.url; }
        if( !page_id && thing.page_id ) { page_id = thing.page_id; }
        
        if( thing.type == 'source' ) {
            source = thing;
            source.updated_time = new Date(source.updated).toISOString()
        }
        if( thing.type == 'quote' ) {
            var quote = thing;
            find_quote[quote._id] = quote;
            quotes.push(quote);
        }
        if( thing.type == 'note' ) {
            var note = thing;
            find_note[note._id] = note;
            if( !notes_for_quotes[note.quote_id]  ) {
                notes_for_quotes[note.quote_id] = [];
            }
            notes_for_quotes[note.quote_id].push(note);
        }
        
        row = getRow();
    }
    
    // -- sort quotes by page_order
    var array_comparitor = function(a,b){
        if( a.length == 0 ) {
            return b.length == 0 ? 0 : -1 /*b first*/;
        }
        if( b.length == 0 ) {
            return a.length == 0 ? 0 : 1 /* a first */;
        }
        var left = a[0];
        var right = b[0];
        if( left == right ) {
            return array_comparitor(a.slice(1),b.slice(1)); //nb slice does not modify in place
        }
        return left - right /* +ve = a first */;
    };
    var page_order_comparitor = function(a,b) {
        // -- arrays
        if( a instanceof Array && b instanceof Array ) {
            return array_comparitor(a,b);
        } else {
            if( a instanceof Array ) { return 1; } //arrays before everything else
            if( b instanceof Array ) { return -1; }
        }
        // -- numbers
        var a_num = parseFloat(a),
            b_num = parseFloat(b),
            _is_num = function(n){ return !isNaN(n) && isFinite(n); }  //thank you http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
            a_is_num = _is_num(a_num),
            b_is_num = _is_num(b_num);
        if( a_is_num && b_is_num ) {  
            return a_num - b_num;
        } else {
            if( a_num ) { return 1; }
            if( b_num ) { return -1; }
        }
        // -- whatever else
        return a > b ? 1 : (a < b ? -1 : 0);
    }
    var quote_sorter = function(a,b){ return page_order_comparitor(a.page_order, b.page_order) };    // <-- NB b,a because we want ascending order
    quotes.sort(quote_sorter);
    
    // -- attach notes to quotes
    for( idx in quotes ) {
        var quote = quotes[idx];
        quote.notes = notes_for_quotes[quote._id] || [];
        quote.nof_notes = _.size(notes_for_quotes[quote._id]);
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
                    type : 'note',
                    content : "type here",
                    quote_id : quote._id,
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
    var is_user_page = req.client && (user_id) && user_id==req.userCtx.name ;
    
    
    var data = {
        title : (title || 'untitled'),
        url : url,
        page_id : page_id,
        quotes : quotes,
        is_user_page : is_user_page,
        user_id : user_id,
        source : source,
        nof_notes : _.size(find_note),
        notes : _.toArray(find_note)
    };
    
    
    var content = templates.render('source.html', req, data);
    
    // communicate with window so that can do stuff after HTML rendered
    // this is probably a sign I should have built this with widgets.  Oh well.
    if( req.client ) {
        window._is_client_rendered=true;
    } 

    return {title: 'note-o-rama : '+title, content: content };
}