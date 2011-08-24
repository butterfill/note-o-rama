/**
 * note-o-rama, second attempt
 *
 * (c) 2011 Stephen A. Butterfill
 * 
 * I haven't decided what license to use yet, it will depend on what
 * I end up linking to.  For now if you want to use any of this, please
 * just email me (stephen.butterfill@gmail.com)
 *
 * For dependencies see test_page.html (some may not be necessary)
 *
 * To run as bookmarklet:
 *  javascript:(function(){_nrama_bkmklt=true;document.body.appendChild(document.createElement('script')).src='http://localhost:8888/nrama2_test/nrama2_base.js'; })();
 *
 * To embed in page
 *     <script src="lib.min.js" ></script>
 *     <script src="nrama2_base.js" ></script>
 *
 * NB: will only work if users accept cookies from all websites (because XDM needed)
 *
 * TODO -- load settings from server for logged-in users
 *
 *  
 */

_NRAMA_LIB_URL = "http://localhost:8888/nrama2_test/lib.min.js"; //where to load lib from (for bookmarklet only)

/**
 * this function is called when we're ready to roll.
 * before this is called, almost nothing should happen (see near end of file).
 * wrap everything in a function because when used as a bookmarklet we need
 * to wait for jQuery & other libraries to load before doing anything at all.
 */
_nrama_init=function _nrama_init($){
    //fix uuids so that it doesn't include dashes (no good for couchDB)
    nrama.uuid = function (){
        var before = uuid();
        var after = 'njs'+before.replace(/-/g,'');
        return after;
    };

    nrama.settings = {
        // -- internals
        debug : true,
        server_url : 'http://127.0.0.1:5984/',  //must include trailing slash
        //server_url : 'http://noteorama.iriscouch.com/',
        db_name : 'nrama',
        easyXDM_cors_url : 'http://127.0.0.1:5984/easy_xdm/cors/provider.html',
        // -- user identification
        user_id : 'steve@gmail.com', // nrama.uuid(),
        password : 'new',   //TODO think of clever way to store this
        // -- quotes & note settings
        tags : '',  //space delimited string of tags
        background_color : '#FCF6CF',
        note_background_color : 'rgba(240,240,240,0.9)', 
        persist_started_color : '#FFBF00',  //#FFBF00=orange
        note_width : 150, //pixels
        note_default_text : 'type now',
        max_quote_length : 5000,  //useful because prevents
        // -- styling
        note_style : {
            //'background-color' : '#FCF6CF',
            "border":"1px solid",
            'background-color' : 'rgb(229,229,299)',    //default in case options.note_background_color fails
            "border-color":"#CDC0B0",
            'box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
            '-moz-box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
            '-webkit-box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
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
            "line-height":"1.3em",
            'background-color' : 'inherit',
            'font-family' : 'Palatino, serif',
            'font-size' : '12px',
            'color' : 'rgb(0,0,0)',
            'text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)',
            '-moz-text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)',
            '-webkit-text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)'
        }
    };
    nrama.settings.note_style["width"] = nrama.settings.note_width+"px";
    nrama.settings.note_editor_style['width'] = nrama.settings.note_width+"px";
    
    nrama._internal = {
        zindex_counter : 10000,  //used for bringing notes to the front
        is_connected : false // true if known to be connected
    }
    
    nrama._debug = function(){};    //does nothing if not debugging
    if( nrama.settings.debug ) {
        //global object contains stuff for debugging
        d = {};
        nrama._debug = function _debug(map){
            $.each(map, function(key,val){
                $.log('nrama._debug setting d.'+key+'='+val);
                d[key]=val;
            });
        };
        //convenience callback for testing async
        cb = function(res){ nrama._debug({res:res}); };
    }
    //configure jQuery.log -- will not log anything if not debug
    $.extend({"log":function(){
        if( !nrama.settings.debug ) {
            return false;
        }
        try { 
          console.log(arguments[0]);
          return true;
        } catch(e) {
          return false;
        }
      }});
    
    
    
    /**
     * nrama.page_id is a value s.t. two page instances have the same page_id exactly
     *   when we want to load the same notes & quotes onto those pages.  This is really
     *   hard to compute (e.g. DOI helps but if different users see an article with
     *   different formatting, should we load the same notes & quotes?  Probably.)
     */
    nrama.page_id = document.location.href; //?in future this might be doi or similar
    //this is the node within which notes and quotes are possible and relative to which
    //their locations are defined
    //nrama.root_node = $('#readOverlay')[0]; //will eventually be configured per-site
    //nrama.root_note must be defined after document loaded!
    jQuery(document).ready(function($){
        nrama.root_node = document.body;
    });
    
    
    nrama.persist = {
        
        /**
         * because we're doing cross domain stuff we can't just do $.ajax.
         * Instead we need to call nrama.persist.rpc.request -- it works roughly the same
         * This depends on some config:
         *  -- easyXDM.js (and JSON2.js)
         *  -- installing the cors html file (and its dependencies) on the server at:
         *        nrama.settings.easyXDM_cors_url
         *        e.g. localhost:5984/easy_xdm/cors/provider.html
         */
        rpc : new easyXDM.Rpc({
                                    remote: nrama.settings.easyXDM_cors_url
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
         *
         * TODO : get with params doesn't seem to work
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
                
            };
            var _error = function _error(res) {
                var data = res.data || {};
                var message = res.message || '';
                nrama._debug({data:data,message:message});
                if( params.error ) {
                    params.error( data, message ); 
                }
            };
            nrama.persist.rpc.request({
                url : params.url,
                data : JSON.stringify(params.data)|| {},
                processData : false,
                method : params.method || params.type,
                headers : params.headers || {'Content-Type': 'application/json'}
                },
                _success,
                _error
            );
        },
        
        login : function login(on_success, on_error) {
            nrama.persist.ajax({
                url:nrama.settings.server_url+'_session',
                method:'POST',
                success:on_success,
                error:on_error,
                data:{name:nrama.settings.user_id,password:nrama.settings.password}
            });        
        },
        
        logout : function logout(on_success, on_error) {
            nrama.persist.ajax({
                url:nrama.settings.server_url+'_session',
                method:'DELETE',
                success:on_success,
                error:on_error
            });        
        },
        
        is_logged_in : function is_logged_in (on_success, on_error) {
            var _success = function(res) {
                //logged in iff res.userCtx.name is not null
                if( on_success ) {
                    on_success( res.userCtx.name != null);
                }
            };
            nrama.persist.ajax({
                url:nrama.settings.server_url+'_session',
                method:'GET',
                success:_success,
                error:on_error
            });
        },
    
        
        /**
         * updates the value of nrama._internal.is_connected
         */
        is_connected : function is_connected(on_success, on_error) {
            var _error = function(res){
                nrama._internal.is_connected = false;
                $.log("nrama is_connected error"); 
                nrama._debug({res:res});
                if( on_error ) {
                    on_error(res);
                }
            }
            var _success = function(res){
                nrama._internal.is_connected = true;
                $.log("nrama is_connected success");
                if( on_success ) {
                    on_success(res);
                }
            }
            nrama.persist.ajax({
                                url : nrama.settings.server_url,
                                data : {},
                                method : "GET",
                                success : _success,
                                error : _error
                });
        },
        
        /**
         * save a note or a quote (or anything with a uuid that JSON.stringify will
         *  work on, really).
         * If successful, will also update a _rev property on thing
         *
         * clone_on_conflict will update thing with its new properties
         */
        save : function save(thing, on_success, on_error, options) {
            var defaults = {
                clone_on_conflict : false
            };
            var settings = $.extend(true, {}, defaults, options);
            $.log('nrama save ' + (thing.type || '') +' '+ thing.uuid+' started');
            var url = nrama.settings.server_url;
            url += nrama.settings.db_name + '/';
            url += thing.uuid;
            var _success = function _success(data){
                thing._rev = data.rev;
                if( on_success ) {
                    on_success(data);
                }
            };
            var _error = function _error(data, message) {
                if( settings.clone_on_conflict ) {
                    if( data.status == 409 ) {
                        $.log('nrama conflict on save --- cloning');
                        var new_uuid = nrama.uuid();
                        var updates = { uuid : new_uuid, replaces_uuid : thing.uuid };
                        thing = $.extend(true, thing, updates); 
                        delete thing._rev;  //revision is no longer valid
                        nrama._debug({updated_thing:thing});
                        settings.clone_on_conflict = false;  //don't loop cloning
                        nrama.persist.save(thing, on_success, on_error, settings);
                    }
                }
                if( on_error ) {
                    on_error(data,message);
                }
            };
            nrama.persist.ajax({
                                url : url,
                                data : thing,
                                method : "PUT",
                                success : _success,
                                error : _error
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
            var url = nrama.settings.server_url;
            url += nrama.settings.db_name + '/';
            url += thing.uuid;
            url += '?rev='+thing._rev;  //nb parameter name must be 'rev' not '_rev'
            nrama.persist.ajax({
                                url : url,
                                method : "DELETE",
                                data : {},  //rev is specified as part of URL
                                success : on_success,
                                error : on_error
            })
        },
        
        /**
         * loads a single object
         * on_success will be called with parsed JSON data
         */
        load : function load(uuid, on_success, on_error) {
            var url = nrama.settings.server_url;
            url += nrama.settings.db_name + '/';
            url += uuid;
            nrama.persist.ajax({
                                url : url,
                                method : "GET",
                                success : on_success,
                                error : on_error
            })
        },
        
        
        /**
         * loads data from a view for this page.
         * The view's must be page ids; the page_id of this page will be used (from nrama.page_id).
         * used by load_quotes, load_notes
         *
         * @param view_address {string} is like /_design/nrama/_view/quotes_by_page_id
         */
        _load_view : function _load_view(view_address, on_success, on_error) {
            var url = nrama.settings.server_url;
            url += nrama.settings.db_name + '/';
            url += view_address;
            nrama.persist.ajax({
                url : url,
                method : 'POST',
                data : {keys:[nrama.page_id]},
                success : on_success,
                error : on_error
            })
        },
        
        /**
         * get quotes for this page (based on nrama.page_id)
         */
        load_quotes : function load_quotes(on_success, on_error) {
            var view_address = '/_design/nrama/_view/quotes_by_page_id';
            nrama.persist._load_view(view_address,on_success,on_error);
        },
        
        /**
         * get notes for this page (based on nrama.page_id)
         */
        load_notes : function load_notes(on_success, on_error) {
            var view_address = '/_design/nrama/_view/notes_by_page_id';
            nrama.persist._load_view(view_address,on_success,on_error);
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
     * depends on :
     *   Rangy
     *   nrama.uuid
     *   nrama.serializer,
     *   nrama.url
     *   nrama.persist
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
                tags : nrama.settings.tags, //string: space-separated list of tags this quote is tagged with
                background_color : nrama.settings.background_color,
                //the xpointer to the quote (well, it isn't actually an xpointer but  any serialized representation of the raneg)
                xptr : nrama.serializer.serialize(range),
                //the name of the method used to seralise
                xptr_method : nrama.serializer.id,
                url : document.location.href,
                page_id : nrama.page_id,  
                page_title : document.title,
                page_order : nrama.quotes.calculate_page_order(range),
                created : new Date().getTime(),
                user_id : nrama.settings.user_id
            }
        },
        
        /**
         * attempt to highlight quote into the HTML document.  May fail if range
         * cannot be decoded; fails silently.  The added nodes will have the
         * quote object stored with jQuery.data (key:'nrama_quote')
         *
         * Checks that quote not already on page; will not re-display if it is.
         *
         * depends Rangy + its highlight module
         *
         * @returns true if successful (or quote already displayed), false otherwise
         */
        display : function display(quote) {
            if( $('.'+quote.uuid).length != 0 ) {
                return true;  //quote already displayed
            }
            var range = nrama.quotes.get_range(quote);
            if( range == null ) {
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
                removeClass('_nrama-quote').
                //unbind().
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
         * load quotes from server and display on this page
         */
        load : function load(on_success,on_error) {
            $.log('nrama starting to load quotes ...');
            var _success = function _success(data) {
                $.log('nrama loaded ' + data.rows.length + ' quotes from server');
                //need to sort by order added to page
                var _sorter = function(a,b){ return a.value.created - b.value.created };
                data.rows.sort(_sorter);
                var _failing_quotes = []
                $.each(data.rows, function(index,row){
                    var quote = row.value;
                    var success = nrama.quotes.display(quote);  //this won't re-display quotes already present
                    if( !success ) {
                        _failing_quotes.push(quote.uuid);
                    }
                });
                if( _failing_quotes.length > 0 ) {
                    $.log('failed to display quotes with uuids: '+_failing_quotes);
                }
                if( on_success ) {
                    on_success(data);
                }
            }
            nrama.persist.load_quotes(_success,on_error);
        },
        
        /**
         * recovers the range for the specified quote (if possible --- this may fail,
         * in which case null is returned).
         * NB: depending on serialize method used, this may fail if quote has been
         * highlighted!
         */
        get_range : function get_range(quote) {
            var method = quote.xptr_method; //method for recovering the range from the quote
            if( ! (method in nrama.serializers) ) {
                $.log('unknown xptr_method ('+method+') for quote '+quote.uuid);
                return null;
            }
            try {
                var serializer = nrama.serializers[method];
                return serializer.deserialize(quote.xptr);
            } catch(error) {
                //$.log('nrama.quotes.display FAIL with range = '+quote.xptr+' for quote '+quote.uuid);
                //$.log('nrama.quotes.display error = '+error);  //not usually informative
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
         * order this quote probably appears on the page.  Assumes that
         * earlier in DOM means earlier on screen.  (the alternative would
         * be to use height, but that fails for columns & varying height)
         *
         * depends
         *  - Rangy
         */
        calculate_page_order : function calculate_page_order(range) {
            var doc_height = $(nrama.root_node).height();
            var doc_width = $(nrama.root_node).width();
            //todo
            var node = range.startContainer;
            var page_order = [range.startOffset];   //create in reverse order, will reverse it
            while ( node && node != document.body ) {
                page_order.push(rangy.dom.getNodeIndex(node, true));
                node = node.parentNode;
            }
            page_order.reverse();
            nrama._debug({page_order:page_order})
            return page_order;
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
     *  - nrama.persist
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
                content : nrama.settings.note_default_text,
                background_color : nrama.settings.note_background_color,
                width : nrama.settings.note_width,
                url : document.location.href,
                page_id : nrama.page_id,  
                created : new Date().getTime(),
                user_id : nrama.settings.user_id
            };
            var new_note = $.extend({},defaults,options);
            return new_note;
            
        },
        
        /**
         * dispaly a note on the page -- i.e. create and style the HTML and add it
         * to the approriate part of the document (the #_nrama_notes).
         *
         * If note already displayed, this will undisplay it first.
         */
        display : function display(note, options) {
            //apply defaults to options
            var options_defaults = {
                focus : true
            };
            var settings = $.extend(true, {}, options_defaults, options );
            
            if( $('#'+note.uuid).length != 0 ) {
                nrama.notes.undisplay(note);
            }
            
            // apply defaults to notes -- for positioning 
            var note_defaults = {};
            var viewport_width = $(window).width();
            //shift quotes horizontally by 1/30 of viewport_width
            var random_shift = function(){return Math.floor(Math.random()*(viewport_width/30))};
            var note_right_gap = Math.min(15, viewport_width/65);
            note_defaults.left = viewport_width - note_right_gap - (note.width || nrama.settings.note_width) - random_shift();
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
                if( !note.top  ) {
                    var msg = "nrama unable to calculate position for note " + note.uuid + " because no quote_uuid property.";
                    $.log(msg);
                }
            }
            note = $.extend(true, {}, note_defaults, note );
            
            //start here
            var pos_attrs = {
                "position":"absolute",
                "left":note.left+"px",
                "top":note.top+"px"
            };
            var textarea = $('<textarea></textarea>').
                                val(note.content).
                                css(nrama.settings.note_editor_style).
                                autogrow();
            var inner_div = $('<div></div>').css(nrama.settings.note_inner_style).
                                append(textarea);
            var edit_note = $('<div></div').
                                attr('id',note.uuid).
                                addClass('_nrama-note').
                                css(pos_attrs).
                                css(nrama.settings.note_style).
                                css('z-index',nrama._internal.zindex_counter++).
                                css('background-color',note.background_color || nrama.settings.note_background_color).
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
         * remove HTML node represening note from the page
         */
        undisplay : function undisplay(note) {
            $('#'+note.uuid).remove();
        },
        
        /**
         * update new note
         * This handles display, logic & persistence.
         * if & when successfully persisted, then store the note as a jquery.data attr
         * on the edit_note_node (key:nrama_note)
         */
        update : function update(edit_note_node) {
            var note = edit_note_node.data('nrama_note');
            
            var $textarea = $('textarea', edit_note_node);
            var new_content = $textarea.val();
            if( $.trim(new_content) == '' ) {
                //delete note because note content is empty
                $.log("nrama.notes.update -- deleting note "+edit_note_node.attr('id'));
                nrama.notes.remove(edit_note_node);
                return;
            }
            
            //if content unchanged, do nothing (so moving a note won't trigger a change)
            var old_content = note.content;
            if( old_content == new_content ) {
                $.log("nrama.notes.update -- note content unchanged, will not persist");
                return;
            }
            $.log("nrama.notes.update --"+old_content+" to "+new_content);
    
            var updates = {
                content : new_content,
                //background_color : edit_note_node.css('background-color'),
                width : edit_note_node.width(),
                left : edit_note_node.offset().left,
                top : edit_note_node.offset().top,
                doc_height : $(document).height(),
                doc_width : $(document).width(),
                updated : new Date().getTime()
            };
            var note = $.extend(true, note, updates);   //assignment not strictly necessary here
            nrama._debug({msg:'updating the following note',note:note});
            //change bkg to signal save in progress
            edit_note_node.css('background-color',nrama.settings.persist_started_color);
            nrama.persist.save(note,
                function(){
                    $.log("nrama persisted updated note uuid:"+note.uuid+" for quote:"+note.quote_uuid);
                    edit_note_node.attr('id',note.uuid);    //may have changed (save can clone)
                    edit_note_node.css('background-color',note.background_color);
                },
                function(){}, //error
                { clone_on_conflict : true } //options
            );
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
         * load notes from server and display on this page
         * run after quotes have been loaded and displayed in case notes need positioning
         */
        load : function load(on_success, on_error) {
            var _success = function _success(data) {
                $.log('nrama loaded ' + data.rows.length + ' notes from server');
                $.each(data.rows, function(index,row){
                    var note = row.value;
                    nrama.notes.display(note, {focus:false});
                });
                if( on_success ) {
                    on_success(data);
                }
            }
            nrama.persist.load_notes(_success,on_error);
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
    
    /**
     * main setup stuff 
     */
    jQuery(document).ready(function($){
        $.log("nrama2 starting up");
    
        rangy.init();
        nrama.notes.init_page();
        nrama.persist.is_connected(function(){
            $.log('loading notes and quotes ...');
            nrama.quotes.load();
            nrama.notes.load();
        });
        
        // --- configure events ---
        
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
            //check that not too much text has been selected (avoid accidental selecting loads of doc)
            if( nrama.settings.max_quote_length > 0 ) {
                if( range.toString().length > nrama.settings.max_quote_length ){
                    $.log('nrama no quote -- ' + range.toString().length + ' characters selected.');
                    return;
                }
            }
            var quote = nrama.quotes.create(range);
            nrama.persist.save(quote, function(){
                //only display the quote after it has been saved
                //(todo -- some indicate that it is being saved?)
                nrama.quotes.display(quote);
            });
            nrama._debug((function(){
                var a={new_quote_uuid:quote.uuid, range:range};
                a[quote.uuid]=quote;
                return a;
            })()); 
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

}

/**
 * this should be the only thing that executes on load.
 * (note that we make sure nothing happens if nrama is already loaded --
 *      bookmarklet may be called more than once)
 */
if( typeof(nrama) == 'undefined' ) {
    nrama = {};     //the only global variable --- holds everything
    
    if( typeof(_nrama_bkmklt)=='undefined' || _nrama_bkmklt==false ) {
        //run as embedded script
        $.noConflict();
        _nrama_init(jQuery);
    } else {
        /**
         * run in bookmarklet mode
         * load supporting libraries; only start work after they loaded
         * thank you http://stackoverflow.com/questions/756382/bookmarklet-wait-until-javascript-is-loaded
         */
        nrama.loadScript = function loadScript(url, callback) {
                var head = document.getElementsByTagName("head")[0];
                var script = document.createElement("script");
                script.src = url;
        
                // Attach handlers for all browsers
                var done = false;
                script.onload = script.onreadystatechange = function() {
                        if( !done && ( !this.readyState 
                                                || this.readyState == "loaded" 
                                                || this.readyState == "complete") ) {
                                done = true;
                                callback();
        
                                // Handle memory leak in IE
                                script.onload = script.onreadystatechange = null;
                                head.removeChild( script );
                        }
                };
                head.appendChild(script);
        }
        nrama.loadScript(_NRAMA_LIB_URL, function() {
            $.noConflict();
            _nrama_init(jQuery);
        });
    }
}
