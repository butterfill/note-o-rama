/**
 * note-o-rama, second attempt
 *
 * I haven't decided what license to use yet, it will depend on what
 * I end up linking to.  For now if you want to use any of this, please
 * just email me (stephen.butterfill@gmail.com)
 *
 * For dependencies see test_page.html (some may not be necessary)
 * 
 */

nrama = {};
//nrama.$j = jQuery.noConflict();
nrama.$j = $; //TODO revise

//fix uuids so that it doesn't include dashes (no good for couchDB)
nrama.uuid = function (){
    var before = uuid();
    var after = 'njs'+before.replace(/-/g,'');
    return after;
};


nrama.options = {
    server_url : 'http://127.0.0.1:5984/',
    db_name : 'nrama',
    easyXDM_cors_url : 'http://127.0.0.1:5984/easy_xdm/cors/provider.html',
    //server_url : 'http://127.0.0.1:8080/test',
    //server_url : 'http://noteorama.iriscouch.com/',
    user_id : nrama.uuid(),
    tags : '',  //space delimited string of tags
    background_color : '#FCF6CF',
    note_background_color : 'rgba(180,180,180,0.9)',
    debug : true,
    note_width : 150, //pixels
    note_default_text : 'type now',
    note_style : {
        //'background-color' : '#FCF6CF',
        "border":"1px solid",
        'background-color' : 'rgb(229,229,299)',    //default in case options.note_background_color fails
        "border-color":"#CDC0B0",
        "padding":"3px",
        'cursor':'move',
        'height':'auto',
        "z-index":"9998" //ensure always on top
    },
    note_inner_style : {},
    note_editor_style : {
        "wrap":"soft",
        "padding-left":"1px",
        "padding-top":"1px",
        "padding-right":"0px",
        "padding-bottom":"0px",
        "border":"none",
        "line-height":"1.1",
        'background-color' : 'inherit'
    }
};
nrama.options.note_style["width"] = nrama.options.note_width+"px";
nrama.options.note_editor_style['width'] = nrama.options.note_width+"px";



nrama._debug = function(){};    //does nothing if not debugging
if( nrama.options.debug ) {
    //global object contains stuff for debugging
    d = {};
    nrama._debug = function _debug(map){
        $.each(map, function(key,val){
            $.log('nrama._debug setting d.'+key+'='+val);
            d[key]=val;
        });
    };
}

nrama._internal = {
    zindex_counter : 10000,  //used for bringing notes to the front
    is_connected : false // true if known to be connected
}

nrama.persist = {
    
    /**
     * because we're doing cross domain stuff we can't just do $.ajax.
     * Instead we need to call nrama.persist.rpc.request -- it works roughly the same
     * This depends on some config:
     *  -- easyXDM.js (and JSON2.js)
     *  -- installing the cors html file (and its dependencies) on the server at:
     *        nrama.options.easyXDM_cors_url
     *        e.g. localhost:5984/easy_xdm/cors/provider.html
     */
    rpc : new easyXDM.Rpc({
                                remote: nrama.options.easyXDM_cors_url
                            },
                            {
                                remote: {
                                    request: {}
                                }
                            }),
    /**
     * simple wrapper for easyXDM's rpc.request
     * @params are like those for jQuery.ajax
     * if request succeeds, param.success is called with the data parsed as
     * JSON (i.e. you're in trouble if the data is HTML or otherwise not JSON).
     */
    ajax : function ajax( params ){
        var _success = function _success(res){
            if( params.success ) {
                var data;
                try {
                    data = JSON.parse(res.data);
                } catch(e) {
                    $.log('nrama error in JSON.parse, re-throwing');
                    throw e;
                }
                params.success(data);
            }
            
        }
        nrama.persist.rpc.request({
            url : params.url,
            data : JSON.stringify(params.data)|| {},
            processData : false,
            method : params.method || params.type,
            headers : params.headers || {'Content-Type': 'application/json'}
            },
            _success,
            params.error || function(){}
        );
    },
    
    /**
     * updates the value of nrama._internal.is_connected
     */
    is_connected : function is_connected() {
        var on_error = function(res){
            nrama._internal.is_connected = false;
            $.log("is_connected error"); 
            nrama._debug({res:res});
        }
        var on_success = function(res){
            nrama._internal.is_connected = true;
            $.log("is_connected success");
            nrama._debug({res:res});
        }
        nrama.persist.ajax({
                            url : nrama.options.server_url,
                            data : {},
                            method : "GET",
                            success : on_success,
                            error : on_error
            });
    },
    
    /**
     * save a note or a quote (or anything with a uuid that JSON.stringify will
     *  work on, really).
     * If successful, will also update a _rev property on thing
     */
    save : function save(thing, on_success, on_error) {
        $.log('nrama save ' + thing.uuid+' started');
        var url = nrama.options.server_url;
        url += nrama.options.db_name + '/';
        url += thing.uuid;
        var _success = function _success(data){
            thing._rev = data.rev;
            if( on_success ) {
                on_success(data);
            }
        };
        nrama.persist.ajax({
                            url : url,
                            data : thing,
                            method : "PUT",
                            success : _success,
                            error : on_error
        })
    },
    
    /**
     * loads a single object
     * on_success will be called with parsed JSON data
     */
    load : function load(uuid, on_success, on_error) {
        var url = nrama.options.server_url;
        url += nrama.options.db_name + '/';
        url += uuid;
        nrama.persist.ajax({
                            url : url,
                            method : "GET",
                            success : on_success,
                            error : on_error
        })
    },
    
    /**
     * deletes a quote or note from the server providing it has a '_rev' property.
     * if no _rev property, calls on_error with an empty object
     *  (we exploit this below --- absence of
     *  _rev means it's not an object that has come from, or been sent to, the server).
     * 
     * for the api we're using, see:
     *   http://www.couchbase.org/sites/default/files/uploads/all/documentation/couchbase-api-dbdoc.html#couchbase-api-dbdoc_db-doc_delete
     */
    rm : function rm(thing, on_success, on_error) {
        if( !thing._rev ) {
            $.log("nrama can't delete "+ (thing.type||'') +" " + thing.uuid +" because no _rev");
            if( on_error ) {
                on_error({});
            } else {
                return;
            }
        }
        var url = nrama.options.server_url;
        url += nrama.options.db_name + '/';
        url += thing.uuid;
        url += '?rev='+thing._rev;  //nb parameter name must be 'rev' not '_rev'
        nrama.persist.ajax({
                            url : url,
                            method : "DELETE",
                            data : {},  //rev is specified as part of URL
                            success : on_success,
                            error : on_error
        })
        /**
        nrama.persist.load(uuid, function(thing){
            if( !thing._rev ) {
                $.log("error deleting "+uuid);
                on_error();
            }
            var _rev = thing._rev;
            url += '?rev='+_rev;  //nb parameter name must be 'rev' not '_rev'
            nrama.persist.ajax({
                                url : url,
                                method : "DELETE",
                                data : {},  //rev is specified as part of URL
                                success : on_success,
                                error : on_error
            })
        }, on_error );
        */
    }
   
    
    
};

/**
 * ways of serializing and restoring rangy range objects.
 *
 * These would ideally work across browsers.  Rangy says it doesn't because IE's
 * dom is different.
 * 
 * (Multiple options allow us to upgrade methods of serialization
 * while still being able to correctly deserialize quotes created with older
 * methods.)
 *
 */
nrama.serializers = {
    rangy_1_2 : {
        // id must match the name
        id : 'rangy_1_2',
        serialize : function(range) {
            // second param means do not compute checksum (because adding highlights
            // to page screws it up)
            return rangy.serializeRange(range, true, nrama.root_node);
        },
        deserialize : function(text) {
            return rangy.deserializeRange(text, nrama.root_node);
        }
    }
}

// the serializer to be used in creating new quotes
nrama.serializer = nrama.serializers['rangy_1_2'];

/**
 * make this more sophisticated?
 */
nrama.page_id = document.location.href; //?in future this might be doi or similar
//this is the node within which notes and quotes are possible and relative to which
//their locations are defined
nrama.root_node = $('#readOverlay')[0]; //will eventually be configured per-site

/**
 * depends on :
 *   uuid
 *   nrama.serializer,
 *   nrama.url
 */
nrama.quotes = {
    /**
     * given a Rangy range object, returns a nrama quote object.
     * a nrama quote object can be serialised and deserialised -- no functions, just text
     */
    create : function create(range) {
        return {
            uuid : nrama.uuid(),  //uuid function is provided by a dependency
            type : 'quote',
            content : range.toString(),
            tags : nrama.options.tags, //string: space-separated list of tags this quote is tagged with
            background_color : nrama.options.background_color,
            //the xpointer to the quote (well, it isn't actually an xpointer but  any serialized representation of the raneg)
            xptr : nrama.serializer.serialize(range),
            //the name of the method used to seralise
            xptr_method : nrama.serializer.id,
            url : document.location.href,
            page_id : nrama.page_id,  //in future this might be doi or similar
            page_title : document.title,
            page_order : 0, //TODO
            created : new Date().getTime(),
            user_id : nrama.options.user_id
        }
    },
    
    /**
     * attempt to highlight quote into the HTML document.  May fail if range
     * cannot be decoded; fails silently.  The added nodes will have the
     * quote object stored with jQuery.data (key:'nrama_quote')
     *
     * depends Rangy + its highlight module
     *
     * @returns true if successful, false otherwise
     */
    display : function display(quote) {
        var range = nrama.quotes.get_range(quote);
        if( range == null ) {
            $.log("nrama failed to recover range for quote "+quote.uuid);
            return false;
        }
        var _rangy_highlighter = rangy.createCssClassApplier("_nrama-quote "+quote.uuid,false);
        _rangy_highlighter.applyToRange(range);
        $('.'+quote.uuid).css('background-color',quote.background_color).data('nrama_quote',quote);
        return true;
    },
    
    /**
     * remove a quote's highlights from the HTML document.
     * leaves jQuery.data('nrama_quote') and uuid as class intact, so quote can
     *   still be found (todo: not sure this is a good idea!).
     * todo -- this would ideally remove the elements so that subsequent quotes
     *  had more reliable xpointers (as long as we don't have a way of getting
     *  good xpointers).
     *          (there may be wa way to do with Rangy highlight module?)
     */
    undisplay : function undisplay(quote) {
        $('.'+quote.uuid).
            removeClass('nrama_quote').
            //removeClass(quote.uuid). //not sure whether I want to do this yet
            css('background-color','red').
            animate({'background-color':'black'}, function(){
                $(this).css('background-color','inherit');
            });
    },
    
    /**
     * request quote delete from server and remove from page if successful
     */
    remove : function remove(quote) {
        $('.'+quote.uuid).css('background-color','orange');
        nrama.persist.rm(quote, function(){
            $.log("nrama deleted quote "+quote.uuid);
            nrama.quotes.undisplay(quote);
        });
    },
    
    /**
     * recovers the range for the specified quote (if possible --- this may fail,
     * in which case null is returned).
     * NB: depending on serialize method used, this may fail if quote has been
     * highlighted!
     */
    get_range : function get_range(quote) {
        try {
            var serializer = nrama.serializers[quote.xptr_method];
            return serializer.deserialize(quote.xptr);
        } catch(error) {
            return null;
        }
    },
    
    /**
     * returns a quote object (or null if not found)
     */
    get_from_page : function get_from_page(quote_uuid) {
        return $('.'+quote_uuid).first().data('nrama_quote') || null;
    },
    
    /**
     * given a Rangy range object, return an integer representing which
     * order this quote probably appears on the page.  Does not work where
     * columns are used (assumes vertical dimension is dominant).
     * This should (and needs to) work accross changes in zoom.
     */
    calculate_page_order : function calculate_page_order(range) {
        var doc_height = $(nrama.root_node).height();
        var doc_width = $(nrama.root_node).width();
        //todo
        throw "incomplete!"
    },
    
    /**
     * calculate the offset of a quote
     */
    offset : function offset(quote_uuid) {
        return $('.'+quote_uuid).first().offset();
    }
}

/**
 * notes work differently from quotes.  The procedure is:
 *  - create a notes container node
 *  - on request, create a note node for the user to add text
 *  - when the text has been added, create the note object for serialization
 *  - if a note is 'edited', this means delete the old note object and create a new one.
 *
 *  DEPENDS
 *  - uuid
 */
nrama.notes = {
    init_page : function init_page() {
        if( $('#_nrama_notes').length == 0 ) {
            //add a div to the end of the document
            var _attrs = {"position":"absolute", "left":"0px", "top":"0px","width":"0%", "height":"0%"};
            $('<div id="_nrama_notes"></div>').appendTo('body').css(_attrs);
        }
    },
    
    /**
     * create a new note for the specified quote.
     * If the quote can be found on the current page, the position of the
     * note will also be set (otherwise it will not).
     *
     * @params options specifies properties for the note,
     *  - these should include quote_uuid 
     */
    create : function create(options){
        var defaults = {
            uuid : nrama.uuid(),  //uuid function is provided by a dependency
            type : 'note',
            content : nrama.options.note_default_text,
            background_color : nrama.options.note_background_color,
            width : nrama.options.note_width,
            url : document.location.href,
            page_id : nrama.page_id,  //in future this might be doi or similar
            created : new Date().getTime(),
            user_id : nrama.options.user_id
        };
        var new_note = $.extend({},defaults,options);
        return new_note;
        
    },
    
    /**
     * dispaly a note on the page -- i.e. create and style the HTML and add it
     * to the approriate part of the document (the #_nrama_notes).
     */
    display : function display(note, options) {
        //apply defaults to options
        var options_defaults = {
            focus : true
        };
        var settings = $.extend(true, {}, options_defaults, options );
        
        // apply defaults to notes -- for positioning 
        var note_defaults = {};
        var viewport_width = $(window).width();
        //shift quotes horizontally by 1/30 of viewport_width
        var random_shift = function(){return Math.floor(Math.random()*(viewport_width/30))};
        var note_right_gap = Math.min(15, viewport_width/65);
        note_defaults.left = viewport_width - note_right_gap - (note.width || nrama.options.note_width) - random_shift();
        //to get default for top we need position of associated quote --- only
        // compute this if we really need it
        if( note.quote_uuid && !note.top ) {
            //var quote = nrama.quotes.get_from_page(note.quote_uuid);
            var quote_offset = nrama.quotes.offset(note.quote_uuid);
            if( quote_offset ) {
                note_defaults.top = quote_offset.top + random_shift();
            } else {
                $.log("nrama unable to get default position for note " + note.uuid + " because no quote offset found for quote " + note.quote_uuid + "(has the quote been added to the page?)");
            }
        } else {
            var msg = "nrama unable to calculate position for note " + note.uuid + " because no quote_uuid property.";
            $.log(msg);
        }
        note = $.extend(true, note, note_defaults );   //(this would modify note in-place anyway)
        
        //start here
        var pos_attrs = {
            "position":"absolute",
            "left":note.left+"px",
            "top":note.top+"px"
        };
        var textarea = $('<textarea></textarea>').
                            val(note.content).
                            css(nrama.options.note_editor_style).
                            autogrow();
        var inner_div = $('<div></div>').css(nrama.options.note_inner_style).
                            append(textarea);
        var edit_note = $('<div></div').
                            attr('id',note.uuid).
                            addClass('_nrama-note').
                            css(pos_attrs).
                            css(nrama.options.note_style).
                            css('z-index',nrama._internal.zindex_counter++).
                            css('background-color',nrama.options.note_background_color).
                            data('nrama_note',note).
                            append(inner_div).
                            appendTo('#_nrama_notes').
                            draggable().
                            hide().show("scale",{},200, function(){
                                if( settings.focus ) {
                                    textarea.focus().select();
                                }
                            }
                        );
        
    },
    
    
    /**
     * update new note
     * This handles display, logic & persistence.
     * (strictly speaking this will delete the previous note object and
     *   create a new one --- but the UI will not show this.)
     * if & when successfully persisted, then store the note as a jquery.data attr
     * on the edit_note_node (key:nrama_note)
     */
    update : function update(edit_note_node) {
        var old_note = edit_note_node.data('nrama_note');
        
        //if note content is empty, delete it
        var $textarea = $('textarea', edit_note_node);
        var new_content = $textarea.val();
        if( new_content == '' ) {
            $.log("nrama.notes.update -- deleting note "+edit_note_node.attr('id'));
            nrama.notes.remove(edit_note_node);
            return null;
        }
        
        //if content unchanged, do nothing (so moving a note won't trigger a change)
        var old_content = old_note.content;
        if( old_content == new_content ) {
            $.log("nrama.notes.update -- note content unchanged, will not persist");
            return null;
        }
        $.log("nrama.notes.update --"+old_content+" to "+new_content);

        //delete the old note
        //we won't bother waiting until the server has actually deleted the note:
        // in the worst case the delete will fail
        var old_uuid = old_note.uuid;   //just in case the object is destroyed before callback
        nrama.persist.rm(old_note, function(){
            $.log("deleted note "+old_uuid+" from server.");
        });

        //build the new note from the old note
        var new_uuid = nrama.uuid();
        var updates = {
            uuid : new_uuid,
            replaces_note : old_uuid,   //this may not refer to anything that was persisted (initial uuid is never persisted)
            content : new_content,
            background_color : edit_note_node.css('background-color'),
            width : edit_note_node.width(),
            left : edit_note_node.offset().left,
            top : edit_note_node.offset().top,
            doc_height : $(document).height(),
            doc_width : $(document).width(),
            updated : new Date().getTime()
        };
        var new_note = $.extend(true, {}, old_note, updates);
        nrama._debug({note:new_note});
        nrama.persist.save(new_note, function(){
            $.log("nrama persisted note uuid:"+new_uuid+" for quote:"+new_note.quote_uuid);
            //delay updating the HTML node with the new data until it has been persisted.
            // that way, any failure to persist will result in a repeat persist attempt
            edit_note_node.data('nrama_note',new_note).
                attr('id',new_uuid);    //update id to refer to new note uuid
        });

        return null;
    },
    
    /**
     * request delete from server & remove from document if succeeds
     */
    remove : function remove(edit_note_node) {
        var note_uuid = edit_note_node.attr('id');
        edit_note_node.css('background-color','red');
        var note = edit_note_node.data('nrama_note');
        nrama.persist.rm(note, function(){
            $.log("deleted note "+note_uuid+" from server.");
            edit_note_node.hide('puff',{},300+Math.floor(Math.random()*1700), function(){
                edit_note_node.remove();
            });
        });

    },
    
    /**
     * @returns uuids of notes if @param quote has notes attached
     */
    find : function find(quote) {
        var uuids = [];
        $('._nrama-note').each(function(){
            var rel_quote_uuid = $(this).data('nrama_note').quote_uuid;
            if( rel_quote_uuid == quote.uuid ) {
                //add uuid of the note to the list
                uuids.push($(this).attr('id'));
            }
        });
        return uuids;
    }
    
    
}


nrama.$j(document).ready(function($){
    $.log("nrama2 starting up");

    rangy.init();
    nrama.notes.init_page();
    nrama.persist.is_connected();
    
    //configure events

    /**
     * quote : highlight creates a quote
     */
    $(document).bind("mouseup", function(e){
        if( e.shiftKey ) {
            //shift key cancels quote creation
            return;
        }
        //$.log("nrama2 caught mouse up");
        var selection = rangy.getSelection();
        if( selection.isCollapsed ) {
            return;
        }
        var range = selection.getRangeAt(0);
        var quote = nrama.quotes.create(range);
        nrama.persist.save(quote, function(){
            //only display the quote after it has been saved
            //(todo -- some indicate that it is being saved?)
            nrama.quotes.display(quote);
        });
        $.log("new quote uuid:"+quote.uuid);
        //$.log("selection serialized:" + quote.xptr );
        $.log("selection text:" + quote.content);
        //$.log("nrama2 finished mouse up");
        nrama._debug({range:range});
    });
    
    /**
     * click a quote to create a note
     */
    $('._nrama-quote').live('click', function(e){
        if( e.shiftKey || e.ctrlKey ) {
            //shift key cancels notecreation, so does ctrl
            return;
        }
        if( e.altKey || e.metaKey ) {
            //alt key causes quote deletion (in separate handler)
            return;
        }   
        //$.log("nrama caught click on quote");
        //$.log('nrama class of $(this):'+$(this).attr('class'));
        if( !$(this).hasClass('_nrama-quote')) {
            throw "nrama false assumtion -- add code to find the quote"
        }
        var quote = $(this).data('nrama_quote');
        var note = nrama.notes.create({quote_uuid:quote.uuid});
        nrama.notes.display(note);
    });
    
    /**
     * alt- or meta-click a quote to delete it
     * (after checking there are no linked notes)
     */
    $('._nrama-quote').live('click', function(e){
        if( e.altKey || e.metaKey ) {
            var quote = $(this).data('nrama_quote');
            var note_uuids = nrama.notes.find(quote);
            if( note_uuids.length != 0 ) {
                //don't delete quotes with notes attached ...
                var $quote_nodes = $('.'+quote.uuid);
                $quote_nodes.css({'border-top':'1px dashed red',
                                 'border-bottom':'1px dashed red'})
                //... instead make the relevant notes bounce
                var idstr = '#' + note_uuids.join(', #');
                $(idstr).effect('bounce', function(){
                    $quote_nodes.css({'border-top':'none',
                                     'border-bottom':'none'},500)
                });
                return;
            }
            $.log("nrama start deleting quote "+quote.uuid);
            nrama.quotes.remove(quote);
            return;
        }
    });

    /**
     * blur a note-edit node textarea to persist a note 
     */
    $('._nrama-note textarea').live('blur', function(e){
        var edit_note_node = $(this).parents('._nrama-note').first();   //should never need first, this is just to be explicit
        nrama.notes.update(edit_note_node);
    });
    
    /**
     * click on a note to bring it to the front and flash the
     * associated quote
     */
    $('._nrama-note').live('click',function(e){
        $(this).css('z-index',nrama._internal.zindex_counter++);
        var note= $(this).data('nrama_note');
        var $quote_nodes = $('.'+note.quote_uuid);
        $quote_nodes.css({'border-top':'1px dashed black',
                         'border-bottom':'1px dashed black'}).
                    css({'border-top':'#FFF',
                         'border-bottom':'red'});
                    //TODO -- not working
        /*
        window.setTimeout(function(){
            $quote_nodes.css({'border-top':0, 'border-bottom':0});            
        },600);
        */          
        
    });
    
});
