/**
 * List functions to be exported from the design doc.
 */
var templates = require('kanso/templates'),
    events = require('kanso/events'),
    db = require('kanso/db'),
    _ = require('./underscore')._;      //nb this is more uptodate than that incl. with kanso 0.0.7

/**
 * The templates need to know what's in the path of the current url and how to
 * include parts of that in creating links.
 * This may include garbage like 'group' and 'descending' parameters.
 *
 * Use: e.g. <a href="{baseURL}{query_user_url}/authors/{author}">{author}</a>
 *  will provide a link to /users/user/authors/author from a page with a user in its path,
 *  and a link to /authors/author from a page with no such link.
 */
var _make_query_urls = function( req) {
    var query_urls = {}
    _(req.query).each(function(value, key){
        query_urls['query_'+key] = value;
        query_urls['query_'+key+'_url'] = '/'+key+'s/'+encodeURIComponent( value );
    });
    return query_urls;
}

/**
 * used in templates : true if broswer-rendered and the current notes & quotes are the user's
 *  (combine the two things because we're mainly interested in whether the user can edit)
 */
var _is_users_own_page = function(req) {
    return req.client && req.query.user && req.query.user==req.userCtx.name ;
}

/**
 *
 */
var make_universal_template_data = function(req) {
    var universal_template_data = _.extend(
        _make_query_urls(req),
        { is_users_own_page : _is_users_own_page(req) }
    );

    //TODO remove (for testing only)
    if( req.client ) {
        window.req = req;
        window.utd = universal_template_data;
        window._ = _;
    }
    
    return universal_template_data;
}

exports.all_users = function (head, req) {

    start({code: 200, headers: {'Content-Type': 'text/html'}});

    // fetch all the rows
    var users = [],
        row = getRow();
    while( row ) {
        var updated_time = '';
        try {
            updated_time = new Date(parseInt(row.value.max)).toISOString()
        } catch(e) {}
        users.push({
            user_id : row.key,
            updated_time : updated_time    //this is time a source was updated
        });
        row = getRow();
    }

    // generate the markup for a list of users
    var content = templates.render('all_users.html', req, _({
            users : users
        }).extend( make_universal_template_data(req) )
    );

    return {title: 'note-o-rama : all users', content: content};

};


/**
 * show sources
 *
 * to show all sources for single user or for all users,
 * works with view userId_source
 *
 * to show sources for an author (either for single user or all users)
 * works with view author_userId
 * 
 */
exports.sources = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

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
    
    var content = templates.render('sources.html', req, _({
            sources : sources
        }).extend( make_universal_template_data(req) )
    );

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
   
    var title = null,
        url = null,
        source = null;
    var row = getRow();
    while( row ) {
        var thing = row.value || row.doc;
        
        // -- set title &c (only held on quotes, not notes)
        if( !title && thing.page_title ) { title = thing.page_title; }
        if( !url && thing.url ) { url = thing.url; }
        
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
    
    // -- configure note edit event -- blur on textbox triggers save note
    if( req.client ) {
        $('textarea.note-content').die().live('blur', function(){
            console.log('caught blur: saving note ...');
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
                    if( error ) {
                        note.content = old_content;
                        $note.text(note.content);
                        $note.css('color','red').removeAttr('disabled');
                        return;
                    }
                    $note.parents('li.note').hide(1000, function(){ $note.remove(); });
                });
                return;
            } 
            $note.css('color','#3300CC').css('text-shadow','0 0 2px #555555');
            note.content = new_content;
            db.saveDoc(note, {}, function(error, data){
                if( error ) {
                    note.content = old_content;
                    //nb we don't update the textarea -- user may try to re-save
                    $note.css('color','red').removeAttr('disabled');
                } 
                note._rev = data.rev;
                $note.css('color','black').css('text-shadow','none').removeAttr('disabled');
                $note.text(note.content);   //must update text for sorting to work
                //$note.parents('ul.notes').first().sortlist(); //sorting sometimes makes it seem the note disappeared
                return;
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
       
    var content = templates.render('source.html', req, _({
            title : (title || 'untitled'),
            url : url,
            quotes : quotes,
            source : source,
            nof_notes : _.size(find_note),
            notes : _.toArray(find_note)
        }).extend( make_universal_template_data(req) )
    );

    return {title: 'note-o-rama : '+title, content: content };
}





/**
 * notes & quotes from one or more sources
 * works with views: tags (?others)
 * NB: will not work with views that include docs (must be used with ?include_docs=true)
 *
 * e.g.(single user)
 *   http://localhost:5984/nrama/_design/nrama/_rewrite/source?key=["http://en.wikipedia.org/wiki/Komodo_dragons?h=i","steve@gmail.com"]
 * or using the rewrites for /user/user_id/source/page_id:
 *  http://localhost:5984/nrama/_design/nrama/_rewrite/user/steve@gmail.com/source/http%3A%2F%2Fstackoverflow.com%2Fquestions%2F332872%2Fhow-to-encode-a-url-in-javascript
 * e.g. (all users)
 *  http://localhost:5984/nrama/_design/nrama/_rewrite/source?startkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons?h=i%22,%22steve@gmail.com%22]&endkey=[%22http://en.wikipedia.org/wiki/Komodo_dragons?h=i%22,{}]
 *
 *
 */
exports.quotes = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var find_source = {};   //indexed by page_id, the first source we find gets priority
    var quotes_for_source = {}; //indexed by page_id
    var find_quote = {};    //indexed by _id
    var notes_for_quotes = {};
    var find_note = {}; //indexed by _id

    var row = getRow();
    while( row ) {
        var thing = row.doc;        // <-- NB must be used with ?include_docs=true
        
        if( thing.type == 'source' ) {
            var source = thing;
            if( !find_source[source.page_id] ) {
                find_source[source.page_id] = source;
                source.updated_time = new Date(source.updated).toISOString()
            }
        }
        if( thing.type == 'quote' ) {
            var quote = thing;
            find_quote[quote._id] = quote;
            quotes_for_source[quote.page_id] = _(quotes_for_source[quote.page_id]).union([quote]);
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

    
    // -- attach quotes to sources
    var sources = _(find_source).values();    //this only includes one source per page_id
    _(sources).each(function(source){
        source.quotes = quotes_for_source[source.page_id] || [];
    });

    // -- attach notes to quotes
    var quotes = _(find_quote).values();
    _(quotes).each(function(quote) {
        quote.notes = notes_for_quotes[quote._id] || [];
    });

    // -- sort quotes by page_order within each source
    // TODO!
    
    
    var content = templates.render('quotes2.html', req, _({
            title : 'untitled', //todo
            sources : sources
        }).extend( make_universal_template_data(req) )
    );
    

    return {title: 'note-o-rama : ', content: content };

}











/**
 * 
 *
 */
exports.quotes2 = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var find_source = {};   //indexed by page_id, the first source we find gets priority
    var quotes_for_source = {}; //indexed by page_id
    var find_quote = {};    //indexed by quote_hash 
    var notes_for_quotes = {};
    var find_note = {}; //indexed by _id
   
    var row = getRow();
    while( row ) {
        var thing = row.doc;        // <-- NB must be used with ?include_docs=true
        
        if( thing.type == 'source' ) {
            var source = thing;
            if( !find_source[source.page_id] ) {
                find_source[source.page_id] = source;
                source.updated_time = new Date(source.updated).toISOString();   //nb should not persist this property
                source.users = [];          //nb should not persist this property
            }
            find_source[source.page_id].users.push(source.user_id);
        }
        if( thing.type == 'quote' ) {
            var quote = thing;
            if( !find_quote[quote.hash] ) {
                find_quote[quote.hash] = quote;
                quotes_for_source[quote.page_id] = _(quotes_for_source[quote.page_id]).union([quote]);
                quote.users = [];   //nb should not persist this property (quotes are not updated)
            }
            find_quote[quote.hash].users.push(quote.user_id);
        }
        if( thing.type == 'note' ) {
            var note = thing;
            find_note[note._id] = note;
            if( !notes_for_quotes[note.quote_hash]  ) {
                notes_for_quotes[note.quote_hash] = [];
            }
            notes_for_quotes[note.quote_hash].push(note);
        }
        
        row = getRow();
    }

    // -- attach notes to quotes
    var quotes = _(find_quote).values();
    _(quotes).each(function(quote) {
        quote.notes = notes_for_quotes[quote.hash] || [];
    });

    // -- attach quotes to sources
    var sources = _(find_source).values();    //this only includes one source per page_id
    _(sources).each(function(source){
        source.quotes = quotes_for_source[source.page_id] || [];
    });

    // -- for each source, sort its quotes by page_order
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
    _(sources).each(function(source){
        var source_quotes = source.quotes;
        source_quotes.sort(quote_sorter);
    });
    
    // -- configure note edit event -- blur on textbox triggers save note
    if( req.client ) {
        $('textarea.note-content').die().live('blur', function(){
            console.log('caught blur: saving note ...');
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
                    if( error ) {
                        note.content = old_content;
                        $note.text(note.content);
                        $note.css('color','red').removeAttr('disabled');
                        return;
                    }
                    $note.parents('li.note').hide(1000, function(){ $note.remove(); });
                });
                return;
            } 
            $note.css('color','#3300CC').css('text-shadow','0 0 2px #555555');
            note.content = new_content;
            db.saveDoc(note, {}, function(error, data){
                if( error ) {
                    note.content = old_content;
                    //nb we don't update the textarea -- user may try to re-save
                    $note.css('color','red').removeAttr('disabled');
                } 
                note._rev = data.rev;
                $note.css('color','black').css('text-shadow','none').removeAttr('disabled');
                $note.text(note.content);   //must update text for sorting to work
                //$note.parents('ul.notes').first().sortlist(); //sorting sometimes makes it seem the note disappeared
                return;
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
       
    var content = templates.render('quotes2.html', req, _({
            sources : sources
        }).extend( make_universal_template_data(req) )
    );

    return {title: 'note-o-rama : TODO', content: content };
}



