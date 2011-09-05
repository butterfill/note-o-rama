/**
 * List functions to be exported from the design doc.
 */
var templates = require('kanso/templates'),
    events = require('kanso/events'),
    db = require('kanso/db'),
    _ = require('./underscore')._,
    nrama_init = require('./nrama2_init').init;


/**
 * set the title element for a page based on the query
 */
var make_title = function(what, req) {
    var title = 'Note-o-rama : ';
    if( req.query && req.query.user ) {
        title += req.query.user+"'s "+what;
    } else {
        title += what;
    }
    return title;
}

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
    return {
        is_users_own_page : req.client && req.query.user && req.query.user==req.userCtx.name
    };
}


/**
 *
 */
var make_universal_template_data = function(req) {
    var universal_template_data = _.extend(
        _make_query_urls(req),
        _is_users_own_page(req),
        { req_client : req.client }
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
    var users = [];
    var row;
    while( row = getRow() ) {
        var updated_time = '';
        try {
            updated_time = new Date(parseInt(row.value.max)).toISOString()
        } catch(e) {}
        users.push({
            user_id : row.key,
            updated_time : updated_time    //this is time a source was updated
        });
    }

    // generate the markup for a list of users
    var content = templates.render('all_users.html', req, _({
            users : users
        }).extend( make_universal_template_data(req) )
    );

    return {title: make_title('users',req), content: content};

};


/**
 * list all sources for single user or for all users
 * works with view userId_source
 * The sources are listed in the order they were last updated
 */
exports.sources = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var sources = [];
    var row;
    while( row = getRow() ) {
        if( row.doc ) {
            var thing = row.doc;
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
    
    return {title: make_title('sources',req), content: content };
};


/**
 * list authors (and their sources)
 * use with userId_author view
 *
 * Here we exploit the fact that the rows are sorted by author.
 * The query should provide author_index_in_key to specify where in the view-provided
 *   key an author's name can be found.
 */
exports.authors = function (head, req) {

    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var authors = [];   //keys will be authors, values will be a list of sources
    var author_index_in_key = parseInt( req.query.author_index_in_key );

    var row = getRow();
    while( row ) {
        if( !row || !row.key || !row.key[author_index_in_key] ) {
            row = getRow();
            continue;
        }
        var current_author = row.key[author_index_in_key];
        author_sources = {
            author_name : current_author,
            sources : [row.doc]
        };
        row = getRow();
        while( row && row.key[author_index_in_key] == current_author ) {
            author_sources.sources.push(row.doc)
            row = getRow();
        }
        authors.push(author_sources);
    }

    var content = templates.render('authors.html', req, _({
            authors : authors
        }).extend( make_universal_template_data(req) )
    );

    return {title: make_title('authors',req), content: content};

};

/**
 * tag cloud for [all users' | a user's] tags
 * user with views: tags_all and tags
 *
 * the query should include tag_index_in_key which specifies the index of the tag
 *   in the key provided by the view
 */
exports.tags = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var tag_index_in_key = parseInt( req.query.tag_index_in_key );
    
    var tags = [];
    
    var row ;
    while( row = getRow() ) {
        if( !row.key || !row.key[tag_index_in_key] ) {
            continue;
        }
        tags.push({
           text : row.key[tag_index_in_key],
           weight : row.value,
           url : "/"
        });
    }
    var content = templates.render('tags.html', req, _({
            tags : tags
        }).extend( make_universal_template_data(req) )
    );

    if( req.client ) {
        window.tags = tags; //todo remove
        $(document).one('nrama_page_loaded', function(){
            $('#tag_cloud').jQCloud(tags, {
                callback : function() {
                    $('#tag_cloud a').each(function(){
                        $(this).attr('href', req.userCtx.baseURL + (req.query.user ? '/users/'+encodeURIComponent(req.query.user) : '') + '/tags/'+ $(this).text());
                    });
                }
            });
        });
    }


    return {title: make_title('tags',req), content: content};
}

/**
 * Written for single or multi-users.
 * TODO factor out common parts with exports.quotes
 * (most of this is duplicated, and the nrama part is VERBATIM)
 */
exports.flow = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var find_source = {};   //indexed by _id
    var find_quote = {};    //indexed by quote_hash, priority to the first we find
    var find_note = {}; //indexed by _id
   
    var row;
    while( row  = getRow() ) {
        var thing = row.doc;        // <-- NB must be used with ?include_docs=true
        
        if( !thing || !thing.type ) {
            continue;
        }
        
        if( thing.type == 'source' ) {
            var source = thing;
            find_source[source._id] = source;
            source.updated_time = new Date(source.updated).toISOString();   //nb should not persist this property
        }
        if( thing.type == 'quote' ) {
            var quote = thing;
            if( !find_quote[quote.hash] ) {
                find_quote[quote.hash] = quote;
                quote.users = [];   //nb should not persist this property (quotes are not updated)
            }
            find_quote[quote.hash].users.push(quote.user_id);
        }
        if( thing.type == 'note' ) {
            var note = thing;
            find_note[note._id] = note;
        }
    }

    //attach notes to quotes
    var notes = _.values(find_note);
    var note_orphan_ids = [];   //ids of notes with no quote found; 
    _.each(notes, function(note) {
        var quote = find_quote[note.quote_hash];
        if( !quote ) {
            note_orphan_ids.push(note._id);
        }else {
            if( !quote.notes ){
                quote.notes = [];
            }
            quote.notes.push(note);
        }
    });
    // for now we don't do anything with the note orphans
    
    //attach sources to quotes
    var quotes = _.values(find_quote);
    _.each(quotes, function(quote){
        quote.source = find_source[quote.source_id]; //may be undefined
    });
    
    if( req.client ) {
        window.quotes = quotes; //TODO debug only

        $(document).one('nrama_page_loaded', function(){
            $('._sort-me').sortlist();
            $('textarea._nrama-note-content').autogrow();
        });
    }
    
    var content = templates.render('flow.html', req, _({
            quotes : quotes
        }).extend( make_universal_template_data(req) )
    );


    // -- configure nrama, attach event listners (copied verbatim from exports.quotes)
    if( req.client ) {
        
        var nrama = nrama_init(find_source);
        window.nrama = nrama;                   //TODO remove!
        
        $(document).one('nrama_page_loaded', function(){
            $('._nrama-note').each(function(){
                var $note = $(this);
                var note_id = $note.attr('id');
                $note.data('nrama_note', find_note[note_id]);
            });
            
            //save after notes have been edited
            $('textarea._nrama-note-content').one('blur', nrama.notes.update_on_blur);
            
            //configure add a note
            $('.add-a-note').die().live('click', function(){
                console.log('add a note ...');
                var $quote = $(this).parents('._nrama-quote').first();
                var quote = find_quote[$quote.attr('id')];
                var note = nrama.notes.create(quote);
                //add to page data
                find_note[note._id] = note;
                //display note
                var note_html = '<li id="'+note._id+'" class="_nrama-note"><textarea class="_nrama-note-content">'+note.content+'</textarea></li>';
                var $note = $(note_html);
                $('ul.notes',$quote).prepend($note);
                $note = $('#'+note._id);        //overwrite after prepend
                $note.data('nrama_note',note);
                $('textarea', $note).focus().select().one('blur', nrama.notes.update_on_blur);
                $note.hide().show(500, function(){ $('#'+note._id).autogrow().focus().select(); });
                console.log('done');
            });
            
            //TODO can only do this if user owns the quote!!!
            
            //configure delete a quote
            var delete_on_meta_click = function(e){
                if( !e.altKey && !e.metaKey ) {
                    return;
                }
                var $quote = $(this).parents('._nrama-quote').first();
                var quote = find_quote[ $quote.attr('id') ];
                if( quote.user_id[0] != '*' ) {
                    if( !req.userCtx || req.userCtx.name != quote.user_id ) {
                        console.log('cannot delete another users quotes');
                        return;
                    }
                }
                var $notes =  $('._nrama-note', $quote);  
                if( $notes.length != 0 ) {
                    //don't delete quotes with notes attached ...
                    $quote.css({'border-top':'1px dashed red',
                                     'border-bottom':'1px dashed red'})
                    //... instead make the relevant notes bounce
                    $notes.effect('bounce', function(){
                        $quote.css({'border-top':'none',
                                         'border-bottom':'none'},500);
                    });
                    return;
                }
                //remove the quote
                $quote.css('background-color','orange');
                nrama.persist.rm(quote, function(error, data){
                    if( error ) {
                        nrama._debug({msg:'nrama: error removing quote',error:error});
                    } else {
                        $quote.css('background-color','red').
                            animate({'background-color':'black'}, function(){
                                $quote.remove();
                            });
                    }
                });
            }
            $('.quote-content').die().live('click', delete_on_meta_click);
        });
    }
    
    

    return {title: make_title('flow',req), content: content};

}



/**
 * lists quotes organised by source.
 * can handle one or more sources.
 * makes no assumptions about keys or values; can only be used with include_docs
 * 
 * for use with
 *   -  /sources/:source
 *   -  /users/:user/sources/:source
 *   - /tags/:tag
 *   - /users/:user/tags/:tag
 */
exports.quotes = function(head, req) {
    start({code: 200, headers: {'Content-Type': 'text/html'}});

    var find_source = {};   //indexed by page_id, the first source we find gets priority
    var find_quote = {};    //indexed by quote_hash 
    var notes_for_quotes = {};
    var find_note = {}; //indexed by _id
   
    var row;
    while( row  = getRow() ) {
        var thing = row.doc;        // <-- NB must be used with ?include_docs=true
        
        if( !thing || !thing.type ) {
            continue;
        }
        
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
    }

    // -- attach notes to quotes and quotes to sources
    var quotes = _(find_quote).values();
    var orphaned_quotes = [];        //for now we don't do anything with oprhans
    _(quotes).each(function(quote) {
        quote.notes = notes_for_quotes[quote.hash] || [];
        var source = find_source[quote.page_id];
        if( !source ) {
            orphaned_quotes.push(quote);
        } else{
            if( !source.quotes ) {
                source.quotes = [];
            }
            source.quotes.push(quote);
        }
    });
    var sources = _(find_source).values();

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
        if( source_quotes ) {
            source_quotes.sort(quote_sorter);
        }
    });
    
    
    // -- configure nrama, attach event listners
    if( req.client ) {
        
        var nrama = nrama_init(find_source);
        window.nrama = nrama;                   //TODO remove!
        
        $(document).one('nrama_page_loaded', function(){
            $('._nrama-note').each(function(){
                var $note = $(this);
                var note_id = $note.attr('id');
                $note.data('nrama_note', find_note[note_id]);
            });
            
            //save after notes have been edited
            $('textarea._nrama-note-content').one('blur', nrama.notes.update_on_blur);
            
            //configure add a note
            $('.add-a-note').die().live('click', function(){
                console.log('add a note ...');
                var $quote = $(this).parents('._nrama-quote').first();
                var quote = find_quote[$quote.attr('id')];
                var note = nrama.notes.create(quote);
                //add to page data
                find_note[note._id] = note;
                //display note
                var note_html = '<li id="'+note._id+'" class="_nrama-note"><textarea class="_nrama-note-content">'+note.content+'</textarea></li>';
                var $note = $(note_html);
                $('ul.notes',$quote).prepend($note);
                $note = $('#'+note._id);        //overwrite after prepend
                $note.data('nrama_note',note);
                $('textarea', $note).focus().select().one('blur', nrama.notes.update_on_blur);
                $note.hide().show(500, function(){ $('#'+note._id).autogrow().focus().select(); });
                console.log('done');
            });
            
            //TODO can only do this if user owns the quote!!!
            
            //configure delete a quote
            var delete_on_meta_click = function(e){
                if( !e.altKey && !e.metaKey ) {
                    return;
                }
                var $quote = $(this).parents('._nrama-quote').first();
                var quote = find_quote[ $quote.attr('id') ];
                if( quote.user_id[0] != '*' ) {
                    if( !req.userCtx || req.userCtx.name != quote.user_id ) {
                        console.log('cannot delete another users quotes');
                        return;
                    }
                }
                var $notes =  $('._nrama-note', $quote);  
                if( $notes.length != 0 ) {
                    //don't delete quotes with notes attached ...
                    $quote.css({'border-top':'1px dashed red',
                                     'border-bottom':'1px dashed red'})
                    //... instead make the relevant notes bounce
                    $notes.effect('bounce', function(){
                        $quote.css({'border-top':'none',
                                         'border-bottom':'none'},500);
                    });
                    return;
                }
                //remove the quote
                $quote.css('background-color','orange');
                nrama.persist.rm(quote, function(error, data){
                    if( error ) {
                        nrama._debug({msg:'nrama: error removing quote',error:error});
                    } else {
                        $quote.css('background-color','red').
                            animate({'background-color':'black'}, function(){
                                $quote.remove();
                            });
                    }
                });
            }
            $('.quote-content').die().live('click', delete_on_meta_click);
        });
    }
    
    
    
    //TODO remove !
    if( req.client ) {
        window.sources = sources;
        window.find_quote = find_quote;
    }
    var content = templates.render('quotes.html', req, _({
            sources : sources,
            no_sources : (sources.length == 0)  //because !![] == true
        }).extend( make_universal_template_data(req) )
    );

    return {title: make_title('notes',req), content: content };
}



