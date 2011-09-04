/**
 * note-o-rama, second attempt
 * Copyright (c) 2011 Stephen A. Butterfill, http://note-o-rama.com
 * 
 * I haven't decided what license to use yet, it will depend on what
 * I end up linking to.  For now if you want to use any of this, please
 * just email me (stephen.butterfill@gmail.com)
 *
 * For dependencies see lib.js
 *
 * To run as bookmarklet (change url; delete the 'now' param if not in developent mode):
 *   javascript:(function(){delete module;delete exports;_nrama_bkmklt=true;document.body.appendChild(document.createElement('script')).src='http://localhost:8888/nrama2_test/nrama2.js?now=new Date().getTime()'; })();
 *
 * To embed in page:
 *   <script src='lib.min.js" ></script>
 *   <script>
 *     _nrama_bkmklt = false;
 *   </script>
 *   <script src="nrama2_base.js" ></script>
 *
 * To use as a commonJS module (see near the end for a list of dependencies):
 *   nrama = require('./nrama');
 *   
 * NB: nrama will only work if users accept cookies from all websites (because XDM needed)
 *
 * TODO -- load settings from server for logged-in users
 */

/**
 * Wrapping for both <script> and commonJS require() use
 * Thanks to http://caolanmcmahon.com/posts/writing_for_node_and_the_browser
 * The function may be called with exports undefined to prevent execution (this
 * is to allow checking nrama not already loaded, see below).
 */
(function(exports){
    var _NRAMA_LIB_URL = "http://localhost:8888/nrama2_test/lib.min.js"; //where to load lib from (for bookmarklet only)

    /**
     * caution : if settings.debug, this will add to window (if defined)
     */
    var _make_debug = function(settings, window) {
        var _debug = function(){};    //does nothing if not debugging
        if( settings.debug && typeof window !== 'undefined' ) {
            //window.$=jQuery;                        //<-- nb breaks noConflict
            _debug = function _debug(map_or_array){
                $.each(map_or_array, function(key,val){
                      if( isFinite(key) ) {
                        key = 'a'+key;      //allows us to handle arrays
                      }
                      if( typeof $.log === 'function' ) {
                        $.log('nrama_debug setting '+key+'='+val);
                        window[key]=val;
                      }
                });
            };
            window.cb = function(){ $.log('window.cb called, sending arguments to _debug'); _debug(arguments); }; //convenience callback for testing async
        }
        return _debug;
    };
    
    /**
     * caution: extends $
     */
    var _make_logging = function(settings, $) {
        var logger = function(){
            if( !settings.debug ) {
                return false;       // will not log anything if not in debug mode
            }
            try { 
              console.log(arguments[0]);
              return true;
            } catch(e) {
              return false;
            }
        }
        $.extend({"log":logger});
        return logger;
    };

    /**
     * @param db{Object} implements (a subset of) kanso's db module
     * @param session{Object} implements (a subset of) kanso's session module
     * @param uuid{function} returns a uuid synchroniously
     */
    var _make_persist = function(db, session, uuid, _debug) {
        persist = {};
        /**
         * save a note or a quote (or that JSON.stringify will work on, really).
         * NB: If successful, will update a _rev property on thing and insert _id
         * NB: if options.clone_on_conflict, @param thing will have its properties updated  incl. new _id
         */
        persist.save = function(thing, options/*optional*/, callback/*required*/ ) {
            if( !callback ) {
                callback = options;
                options = {}
            }
            var defaults = {
                clone_on_conflict : false   //e.g. set to true used when saving notes
            };
            var settings = $.extend(true, {}, defaults, options);

            db.saveDoc(thing, function(error, data){
                _debug({msg:'nrama_persist.save ',error:error, data:data, settings:settings});
                if( error ) {
                    if( settings.clone_on_conflict ) {
                        if( error.status == 409 || error.error == "conflict")  {
                            $.log('nrama_persist.save: conflict on save for '+(thing.type || '')+' '+thing._id+' --- started cloning');
                            persist.clone(thing, callback);
                            return;
                        }
                    }
                    _debug({msg:'nrama_persist.save: error',error:error});
                    callback(error, data);
                    return;
                }
                thing._rev = data.rev;
                thing._id = data.id;
                callback(error, thing);
            });
        };
            
        /**
         * create and persist a clone of a note or quote, updating the
         * passed thing in place.
         */
        persist.clone = function(thing, callback) {
            var new_id = uuid();
            var updates = {
                _id : new_id,
                replaces_id : thing._id };
            var cloned_thing = $.extend(true, {}, thing, updates); 
            delete cloned_thing._rev;  //revision is no longer valid
            persist.save(cloned_thing, function(error, data){
                if( !error ) {
                    thing = cloned_thing;   //messy
                }
                callback(error,data);
            });
        };
    
        /**
         * assumes that thing.type (e.g. 'source') is the name of the couchdb update function
         * thing must have .type and ._id attributes
         */
        persist.update = function(thing, callback) {
            db.doUpdate( thing, encodeURIComponent( thing.type ), callback);
        };

        /**
         * deletes a quote or note from the server providing it has a '_rev' property.
         * if no _rev property, nothing happens but this is callback'ed as success.
         *  (we exploit this -- absence of _rev means it's not been persisted)
         */
        persist.rm = function(thing, callback) {
            if( !thing._rev ) {
                callback(null, { deleted:false, message:'nrama_persist.rm did not delete because '+(thing.type ||'')+' '+(thing._id || '')+' has no _rev'});
            }
            db.removeDoc(thing, callback);
        };
            
        /**
         * loads data for a page (e.g. all quotes)
         * @param options.page_id is the page to load stuff for (required)
         * @param options.type{String} [optional] specifies which type of objects to load (required)
         * @param options.user_id{String} [optional] (cannot be specified unless type is specified)
         */
        persist.load = function(options, callback) {
            var defaults = {
                page_id : undefined, type : null, user_id : null,
                success : null, error : null
            };
            var settings = $.extend({}, defaults, options);
            
            var query;
            if( !settings.type ) {
                query = {startkey:'["'+settings.page_id+'"]', endkey:'["'+settings.page_id+'",{}]'};
            } else { //type is specified
                if( !settings.user_id ) {
                    query = {
                        startkey:'["'+settings.page_id+'","'+settings.type+'"]',
                        endkey:'["'+settings.page_id+'","'+settings.type+'",{}]'
                    };
                } else {    //type and user_id are specified
                    query = {key:'["'+settings.page_id+'","'+settings.type+'","'+settings.user_id+'"]' };
                }
            }
            db.getView('pageId_type_userId', query, callback);
        };
    
        return persist;
    };

    /**
     * for each page_id, each user should create a source.  Minimally this
     *  need only contain the page_id.  But it should ideally contain a title
     *  and, where possible, authors &c.
     *  depends : 
     *    - b64_hmac_md5    from md5.js 
     *    - async           from async.js (caolan)
     *    - BibtexParser    from bibtex.js
     *    - $               from jQuery
     *    -  _              from underscore.js
     */
    var _make_sources = function(persist, _debug) {
        var sources = {};
        /**
         * @returns the id of a source record for the user and page
         * @param o{map} should contain user_id and page_id
         */
        sources.calculate_id = function(o) {
            return 'source_'+b64_hmac_md5(o.user_id, o.page_id);
        };
        
        /**
         * @param attrs must contain page_id & user_id ; should also
         * contain url and either (page_title or TITLE)
         */
        sources.create = function(attrs) {
            var defaults = {
                type : 'source',
                tags : []     //the server's update will append, not remove
            };
            var source = $.extend(true, defaults, attrs);
            source._id = source._id || sources.calculate_id(source);
            return source;
        }
        /**
         * Create or update a source.
         * @param source must contain TITLE, url, page_id & user_id if update
         * is being called to create a new source
         * caution: source will be modified in place.
         */
        sources.update = function(source, callback) {
            persist.update(source, callback);
        }

        /**
         * call update once per source only (but if it fails, will repeat next
         * time it is called)
         */
        var _update_memo = [];
        sources.update_once = function(source, callback) {
            var already_done = ( _.indexOf(_update_memo, source._id) != -1 );
            if( already_done  ) {
                callback(null, 'already done');
                return;
            } 
            sources.update(source, function(error, data){
                if(error){
                    callback(error,data);
                } else {
                    _update_memo.push(source._id);
                    callback(error, data);
                }
            });
        };
        
        /**
         * This should return an array of strings which canonically represent authors
         * @param authors{string} is the authors.
         * TODO: make this work (see js-bibtex?)
         */
        var _parse_authors = function( authors/*String*/ ) {
            _debug({authors:authors});
            return authors.split(' and ');
        };
        /**
         * given a string, attempts to parse it as bibtex and update the source
         * with the results
         * E.g.
         *   b='@incollection{Baillargeon:1995lu,	Address = {Oxford},	Author = {Baillargeon, Ren{\'e}e and Kotovsky, Laura and Needham, Amy},	Booktitle = {Causal cognition. A multidisciplinary debate},	Date-Added = {2010-08-04 17:40:21 +0100},	Date-Modified = {2010-08-04 17:40:38 +0100},	Editor = {Sperber, Dan and Premack, David},	Pages = {79-115},	Publisher = {Clarendon},	Title = {The Acquisition of Physical Knowledge In Infancy},	Year = {1995}}'
         */
        sources.update_from_bibtex = function(bib_str, callback) {
            var parser = new BibtexParser();
            parser.setInput(bib_str);
            parser.bibtex();
            var results = parser.getEntries();
            if( _.size(results) != 1 ) {
                callback('nrama.sources.parse_bibtex: input contained '+_.size(results)+' entries ('+bib_str+')');
                return;
            }
            var entry = _.toArray(results)[0];
            if( entry.AUTHOR ) {
                entry.AUTHOR_TEXT = entry.AUTHOR;
                entry.AUTHOR = _parse_authors(entry.AUTHOR_TEXT);
            }
            entry.bibtex = bib_str;
            sources.update(entry, callback);
        };
        
        return sources;
    };
    
    /**
     *  @param quotes can be set to null; if provided it is used to position noes
     */
    var _make_notes = function(settings, uuid, persist,
                               sources, quotes, finder) {
        var notes = {};
        /**
         * Create a new note for a specified quote.
         */
        notes.create = function(quote){
            var new_note = {
                _id : 'n_'+uuid(),  
                type : 'note',
                content : settings.note_default_text,
                quote_id : quote._id,
                quote_hash : quote.hash,    //can attach to the same quote from other users
                tags : [],                  //will cache the #s to save us parsing text in creating a view
                background_color : settings.note_background_color,
                width : settings.note_width,
                page_id : quote.page_id,  
                created : new Date().getTime(),
                user_id : settings.user_id
            };
            new_note.source_id = sources.calculate_id({
                user_id : new_note.user_id,
                page_id : new_note.page_id
            });
            return new_note;
        };
            
        /**
         * extract tags from note
         * losely based on lines 106-7 of https://raw.github.com/bcherry/twitter-text-js/master/twitter-text.js
         */
        var _hashtag_regex = /(^|[^0-9A-Z&\/\?]+)(#|＃)([0-9A-Z_]*[A-Z_]+[a-z0-9_]*)/gi;
        notes.get_tags = function(note) {
            var tags = [];
            note.content.replace(_hashtag_regex, function(match, before, hash, hashText) {
                tags.push(hashText);  
            });
            return tags;
        };
            
        notes.save = function(note, options/*optional*/, callback) {
            if( !callback ) {
                callback = options;
                options = {};
            }
            //extract and store the tags
            note.tags = notes.get_tags(note);
            //update the source before saving any quotes
            var source = finder.find_source(note);
            sources.update_once(source, function(error, data) {
                if( error ) {
                    $.log('error in nrama_notes.save, due to call to nrama_sources.update_once.')
                    callback(error, data);
                    return;
                }
                persist.save(note, options, callback);
            });
        };
            
        var _zindex_counter = 10000; //used for bringing notes to the front and to ensure new notes are on top
        notes.bring_to_front = function($note) {
            $note.css('z-index', _zindex_counter++);  //move note to frong
        }

        /**
         * dispaly a note on the page -- i.e. create and style the HTML and add it
         * to the approriate part of the document (the #_nrama_notes).
         * If note does not have position info (either because it is newly created,
         * or because it was created on the server), attempt to position it near the quote.
         */
        notes.display = function(note, options) {
            var options_defaults = {
                focus : true        //set focus to the note's textarea after creating it?
            };
            var display_settings = $.extend(true, {}, options_defaults, options );
            
            // --- apply some positioning defaults to notes
            var note_defaults = {};
            var viewport_width = $(window).width();
            //shift quotes horizontally by 1/30 of viewport_width
            var random_shift = function(){return Math.floor(Math.random()*(viewport_width/30))};
            var note_right_gap = Math.min(15, viewport_width/65);
            note_defaults.left = viewport_width - note_right_gap - (note.width || settings.note_width) - random_shift();
            //to get default for top we need position of associated quote --- only compute this if we really need it
            if( !note.top ) {
                var quote_offset = null;
                if( note.quote_id && quotes ) {
                    quote_offset = quotes.offset(note.quote_id);    //may return null if can't be computed
                }
                if( quote_offset ) {
                    note_defaults.top = quote_offset.top + random_shift();
                } else {
                    note_defaults.top = 0 + random_shift(); //put note at top of screen if can't do better
                    $.log("nrama unable to get default position for note " + note._id + " because no quote offset found for quote " + note.quote_id + "(has the quote been added to the page?)");
                }
            } 
            note = $.extend(true, {}, note_defaults, note );
            
            // -- check the note container div exists, append to document.body if not
            if( $('#_nrama_notes').length == 0 ) {
                $('<div id="_nrama_notes"></div>').appendTo('body').
                    css({position:"absolute", left:"0px", top:"0px",width:"0%", height:"0%"});
            }

            // --- start properly here
            if( $('#'+note._id).length != 0 ) {  
                notes.undisplay(note); //If note already displayed, undisplay it first.
            }
            var pos_attrs = {
                "position":"absolute",
                "left":note.left+"px",
                "top":note.top+"px"
            };
            var textarea = $('<textarea></textarea>').
                                val(note.content).
                                css(settings.note_editor_style).
                                one('blur', notes.update_on_blur).  //make sure edits are saved
                                autogrow();
            var inner_div = $('<div></div>').css(settings.note_inner_style).
                                append(textarea);
            var edit_note = $('<div></div').
                                attr('id',note._id).
                                addClass('_nrama-note').
                                css(pos_attrs).
                                css(settings.note_style).
                                css('z-index',_zindex_counter++).
                                css('background-color', note.background_color || settings.note_background_color).
                                data('nrama_note',note).
                                append(inner_div).
                                appendTo('#_nrama_notes').
                                draggable({ cursor:'move', opacity:0.66, stop:notes.update_on_drag }).
                                hide().show("scale",{},200, function(){
                                    if( display_settings.focus ) {
                                        textarea.focus().select();
                                    }
                                }
                            );
        };
            
        /**
         * remove HTML node represening note from the page
         */
        notes.undisplay = function(note) {
            $('#'+note._id).remove();
        };
            
        /**
         * update new note = event handler for blur event on TEXTAREA of $note
         * This handles display, logic & persistence.
         * if & when successfully persisted, the note is stored as a jquery.data attr
         * on the $note (key:nrama_note)
         */
        notes.update_on_blur = function(e) {
            var $textarea = $(this);
            $textarea.unbind('blur', notes.update_on_blur).
                attr("disabled", "disabled");   //disable text area while attempting to persist
            $note = $textarea.parents('._nrama-note').first();
            $note.css('background-color', settings.persist_started_color);
            
            // -- call this to re-enable note unless it's deleted
            var _finally = function _finally($textarea, restore_background ){
                //make changes to textarea possible & ensure they trigger updates
                $textarea.removeAttr("disabled");
                $textarea.unbind('blur', notes.update_on_blur).one('blur', notes.update_on_blur);  //make sure edits are saved
                if( restore_background ) {
                    $textarea.parents('._nrama-note').css({backgroundColor:settings.note_background_color});
                }
            };
            
            // -- delete note if note content is empty
            var new_content = $textarea.val();
            if( $.trim(new_content) == '' ) {
                $.log("nrama_notes.update -- deleting note "+$note.attr('id'));
                notes.remove($note); 
                return;
            }
            
            var note = $note.data('nrama_note');
            
            // -- if content unchanged, do nothing (so moving a note won't trigger a change)
            var old_content = note.content;
            if( old_content == new_content ) {
                _finally($textarea, true);
                return;
            }
    
            var updates = {
                content : new_content,
                background_color : settings.note_background_color,
                width : $note.width(),
                left : $note.offset().left,
                top : $note.offset().top,
                updated : new Date().getTime()
            };
            if( settings.is_embedded ) {
                updates.doc_height = $(document).height();
                updates.doc_width = $(document).width();
            }
            var new_note = $.extend(true, {}, note, updates);   
            
            notes.save(new_note, {clone_on_conflict:true}, function(error,data){
                if( error ) {
                    $note.css({backgroundColor : settings.persist_failed_color});
                    _finally($textarea, false);
                    return;
                }
                $.log("nrama_notes.update_on_blur: was persisted note _id:"+new_note._id+" for quote:"+new_note.quote_id);
                $note.attr('id',new_note._id); //may have changed (save can clone)
                $note = $('#'+new_note._id);   //have to update after changing id attribute
                $note.data('nrama_note', new_note);
                _finally( $('textarea',$note), true );
            });
        };
            
        notes.update_on_drag = function(e) {
            var $textarea = $('textarea', $(this) ).first();
            if( $textarea.attr('disabled') ) {
                $.log('nrama_notes.update_on_drag: save currently in progress');
                return;
            }
            $.log("nrama_notes.update_on_drag starting");
            $textarea.attr('disabled','disabled');
            var $note =  $(this);
            var note = $note.data('nrama_note');
            var updates = {
                left : $note.offset().left,
                top : $note.offset().top,
                doc_height : $(document).height(),
                doc_width : $(document).width()
            };
            note = $.extend(true, note, updates);   
            notes.save(note, {clone_on_conflict:false}, function(error, data){
                //errors are ignored -- note location not critical
                $textarea.removeAttr('disabled');
            });
        };
        
        /**
         * request delete from server & remove from document if succeeds
         */
        notes.remove = function($note) {
            var note_id = $note.attr('id');
            $note.css('background-color','red');
            var note = $note.data('nrama_note');
            persist.rm(note, function(error, data){
                if( error ) {
                    _debug({msg:'nrama_notes.remove --- error removing note', error:error});
                } else {
                    $.log("nrama_notes.remove deleted note "+note_id+" from server.");
                    $note.hide('puff',{},300+Math.floor(Math.random()*600), function(){
                        $note.remove();
                    });
                }
            });
        };
    
        /**
         * load notes from server and display on this page
         * run after quotes have been loaded and displayed in case notes need positioning
         */
        notes.load = function(page_id, callback) {
            persist.load({
                page_id : page_id,
                type : 'note',
                user_id : settings.me_only ? settings.user_id : undefined
            }, function(error, data){
                if( error ) {
                    _debug({msg:'nrama_notes.load error:', error:error})
                    callback(error, data);
                    return;
                }
                $.log('nrama_notes.load got ' + data.rows.length + ' notes from server');
                $.each(data.rows, function(index,row){
                    var note = row.value;
                    notes.display(note, {focus:false});
                });
                callback(error, data);
            });
        };
            
        /**
         * @returns _ids of notes if @param quote has notes attached
         */
        notes.find = function(quote) {
            var _ids = [];
            $('._nrama-note').each(function(){
                var rel_quote_id = $(this).data('nrama_note').quote_id;
                if( rel_quote_id == quote._id ) {
                    _ids.push($(this).attr('id'));  //add _id of the note to the list
                }
            });
            return _ids;
        };
        
        return notes;
    };
    

    var _nrama_init = function(nrama, $) {
        //fix uuids so that it doesn't include dashes (no good for couchDB)
        nrama.uuid = function (){
            return  'N'+uuid().replace(/-/g,'');
        };
    
        nrama.settings = {
            // -- internals
            is_embedded : true,     //set to false when being used on the server
            debug : true,
            server_url : 'http://127.0.0.1:5984/',  //must include trailing slash
            //server_url : 'http://noteorama.iriscouch.com/',
            db_name : 'nrama',
            xdm_url : 'http://localhost:5984/nrama/_design/nrama/_rewrite/xdm/provider.html',
            // -- user identification
            user_id : 'steve@gmail.com', // '*'+nrama.uuid(),
            password : 'new',   //TODO think of clever way to store this
            me_only : true,    //show only my notes and quotes
            // -- quotes & note settings
            note_default_text : 'type now',
            background_color : '#FCF6CF',   //for quotes
            background_color_other : 'rgba(240,240,240,0.5)',   //color for other ppl's notes and quotes (TODO)
            note_background_color : 'rgba(240,240,240,0.9)', 
            persist_started_color : '#FFBF00',  //#FFBF00=orange
            note_width : 150, //pixels
            max_quote_length : 5000,  //useful because prevents
            // -- styling
            note_style : {
                'border' : '1px solid',
                'background-color' : 'rgb(229,229,299)',    //default in case options.note_background_color fails
                'border-color' : '#CDC0B0',
                'box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
                '-moz-box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
                '-webkit-box-shadow' : '0 0 8px rgba(0,0,0,0.2)',
                'padding' : '3px',
                'cursor' : 'move',
                'height' : 'auto',
                'z-index' : '9998' //try to ensure always on top
            },
            note_inner_style : {},
            note_editor_style : {
                'wrap' : 'soft',
                'padding-left' : '1px',
                'padding-top' : '1px',
                'padding-right' : '0px',
                'padding-bottom' : '0px',
                'border' : 'none',
                'resize' : 'none',      //remove draggable resize handle in chrome
                'line-height' : '1.3em',
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
        
        nrama._debug = _make_debug(nrama.settings, window);
        nrama.log = _make_logging(nrama.settings, $);

        nrama.default_callback = function() {
            $.log('nrama.default_callback called with values:');
            nrama._debug(arguments); 
        }
        
        var _make_rpc = function(easyXDM) {
            var local = {
                get_version : {
                    method : function(success, error){ success("0.2"); }
                },
                msg : {
                    method : function(message, success, error){
                        alert(message);
                        success();
                    }
                },
                do_it : {
                    method : function(code_str, success, error){
                        eval(code_str);
                    }
                }
            };
            var remote = {
                test: {},
                db_saveDoc: {},
                db_removeDoc : {},
                db_getView: {},
                db_doUpdate : {},
                session_login: {},
                session_logout : {},
                session_info : {},
                db_getView2 : {}
            };
            return new easyXDM.Rpc({ remote:nrama.settings.xdm_url },{ remote:remote, local:local });
        }
        nrama._rpc = _make_rpc(easyXDM);
        /**
         * some messing around to get rpc to work with kanso.db and kanso.session is needed.
         * (See the corresponding wrappers in xdm/provider.js|html to get full picture.)
         * wrap_unarray is for undoing the effects of executing callbacks with all parameters
         * collapsed into an array (easyXDM only allows for callbacks with a single parameter).
         */
        var _wrap_unarray = function(fn){
            return function(){
                var new_args = _.toArray(arguments[0]);
                fn.apply(this, new_args);
            }
        };
        var _wrap_rpc = function( method ) {
            return function( ) {
                var new_arguments = _(arguments).map(function(arg){
                    if( typeof(arg) == 'function' ) {
                        return _wrap_unarray(arg);    //wrap because we're putting parameters into array for xdm
                    }
                    return arg;
                });
                method.apply(this, new_arguments);  
            }
        }
        nrama.db = {
            saveDoc : _wrap_rpc( nrama._rpc.db_saveDoc ),
            removeDoc : _wrap_rpc( nrama._rpc.db_removeDoc ),
            getView : _wrap_rpc( nrama._rpc.db_getView ),
            doUpdate : _wrap_rpc( nrama._rpc.db_doUpdate )
        };
        nrama.session = {
            login : _wrap_rpc( nrama._rpc.session_login ),
            logout : _wrap_rpc( nrama._rpc.session_logout ),
            info : _wrap_rpc( nrama._rpc.session_info )
        };
        
        
        nrama.persist = _make_persist(nrama.db, nrama.session, nrama.uuid, nrama._debug);
        
        /**
         * Ways of serializing and restoring rangy range objects.
         * These would ideally work across browsers; rangy_1_2 claims not to.  
         * (Having multiple ways allow us to upgrade the method of serialization
         * while still being able to correctly deserialize quotes created with older
         * methods.)
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
    
        nrama.sources = _make_sources(nrama.persist, nrama._debug);

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
             * @returns a hash useful for determining whether two quotes are the same
             *     across different users.
             */
            calculate_hash : function(quote) {
                var hash = b64_hmac_md5(quote.page_id, quote.content);
                nrama.quotes._last_hash = hash;
                return hash;
            },
                
            /**
             * @param range is a Rangy range object
             * @returns a nrama quote object.
             */
            create : function create(range) {
                var new_quote = {
                    _id : 'q_'+nrama.uuid(),  
                    type : 'quote',
                    content : $.trim( range.toString() ),
                    background_color : nrama.settings.background_color,
                    url : document.location.href,
                    page_id : nrama.page_id,  
                    page_title : document.title,
                    //the xpointer to the quote (well, it isn't actually an xpointer but  any serialized representation of the raneg)
                    xptr : nrama.serializer.serialize(range),
                    //the name of the method used to seralise
                    xptr_method : nrama.serializer.id,
                    page_order : nrama.quotes.calculate_page_order(range),
                    created : new Date().getTime(),
                    updated : new Date().getTime(),
                    user_id : nrama.settings.user_id
                };
                new_quote.hash = nrama.quotes.calculate_hash(new_quote);
                new_quote.source_id = nrama.sources.calculate_id({
                    user_id : new_quote.user_id,
                    page_id : new_quote.page_id
                });
                return new_quote;
            },
            
            save : function(quote, options /*optional*/, callback) {
                if( !callback ) {
                    callback = options;
                    options = {};
                }
                //update the source before saving any quotes
                var source = nrama.finder.find_source(quote);
                nrama.sources.update_once(source, function(error, data) {
                    if( error ) {
                        $.log('error in nrama.quotes.save is due to call to nrama.sources.update_once.')
                        callback(error, data);
                        return;
                    }
                    nrama.persist.save(quote, options, callback);
                });
            },
            
            /**
             * attempt to highlight quote into the HTML document.  May fail if range
             * cannot be decoded; fails silently.  Nodes added to the DOM will have the
             * quote object stored with jQuery.data (key:'nrama_quote')
             *
             * Checks that quote not already on page; will not re-display if it is.
             *
             * depends Rangy + its highlight module
             *
             * @returns true if successful (or quote already displayed), false otherwise
             */
            display : function display(quote) {
                if( $('.'+quote._id).length != 0 ) {
                    return true;  //quote already displayed
                }
                var range = nrama.quotes.get_range(quote);
                if( range == null ) {
                    return false;
                }
                var _rangy_highlighter = rangy.createCssClassApplier("_nrama-quote "+quote._id,false);
                try{
                    _rangy_highlighter.applyToRange(range);
                } catch(error) { //seems to be rare
                    if( nrama.settings.debug ) {
                        $.log("nrama: error using Randy's createCssClassApplier.applyToRange, re-throwing");
                        throw error;
                    } else {
                        return false;   //silently fail if not in debug mode
                    }
                }
                $('.'+quote._id).css('background-color',quote.background_color).data('nrama_quote',quote);
                return true;
            },
            
            /**
             * remove a quote's highlights from the HTML document.
             * leaves jQuery.data('nrama_quote') and _id as class intact, so quote can
             *   still be found (todo: not sure this is a good idea!).
             * todo -- this would ideally remove the elements so that subsequent quotes
             *  had more reliable xpointers (as long as we don't have a way of getting
             *  good xpointers).
             */
            undisplay : function undisplay(quote) {
                $('.'+quote._id).
                    removeClass('_nrama-quote').
                    css({'border-top':'none', 'border-bottom':'none', 'box-shadow':'none'}).
                    //removeClass(quote._id). //not sure whether I want to do this yet
                    css('background-color','red').
                    animate({'background-color':'black'}, function(){
                        $(this).css('background-color','inherit');
                    });
            },
            
            flash : function flash(quote_id) {
                var $quote_nodes = $('.'+quote_id);
                $quote_nodes.css({'border-top':'1px dashed black',
                                 'border-bottom':'1px dashed black',
                                 'box-shadow':'0 0 20px' + nrama.settings.background_color });
                window.setTimeout(function(){
                    $quote_nodes.css({'border-top':'none', 'border-bottom':'none', 'box-shadow':'none'});            
                },600);
            },
            
            /**
             * request quote delete from server and remove from page if successful
             */
            remove : function remove(quote) {
                $('.'+quote._id).css('background-color','orange');
                nrama.persist.rm(quote, function(error, data){
                    if( !error ) {
                        nrama.quotes.undisplay(quote);
                    } else {
                        nrama._debug({msg:'nrama.quotes.remove: passing error to debug',error:error});
                    }
                });
            },
            
            /**
             * load quotes from server and display on this page
             */
            load : function load(page_id, callback) {
                $.log('nrama starting to load quotes ...');
                nrama.persist.load({
                    page_id : page_id,
                    type : 'quote',
                    user_id : nrama.settings.me_only ? nrama.settings.user_id : undefined
                }, function(error, data){
                    if( error ) {
                        nrama._debug({msg:'nrama.quotes.load: error loading quotes', error:error});
                        callback(error);
                        return;
                    }
                    $.log('nrama loaded ' + data.rows.length + ' quotes from server');
                    //need to sort quotes by the time they were added to page for best chance of displaying them
                    var _sorter = function(a,b){ return a.value.created - b.value.created };
                    data.rows.sort(_sorter);
                    var _failing_quotes = []
                    $.each(data.rows, function(index,row){
                        var quote = row.value;
                        var success = nrama.quotes.display(quote);  //this won't re-display quotes already present
                        if( !success ) {
                            _failing_quotes.push(quote._id);
                        }
                    });
                    if( _failing_quotes.length > 0 ) {
                        $.log('failed to display quotes with _ids: '+_failing_quotes);
                    }
                    callback(error, data);
               });
            },
            
            /**
             * @returns the range for the specified quote or null if not possible.
             * NB: this may fail once the quote has been highlighted!
             */
            get_range : function get_range(quote) {
                var method = quote.xptr_method || '_method_unspecified'; //method for recovering the range from the quote
                if( ! (method in nrama.serializers) ) {
                    $.log('unknown xptr_method ('+method+') for quote '+quote._id);
                    return null;
                }
                try {
                    var serializer = nrama.serializers[method];
                    return serializer.deserialize(quote.xptr);
                } catch(error) {
                    //$.log('nrama.quotes.display FAIL with range = '+quote.xptr+' for quote '+quote._id);
                    //nrama._debug({catch_error:error});  //not usually informative
                    return null;
                }
            },
            
            /**
             * @returns a quote object (or null if not found)
             */
            get_from_page : function get_from_page(quote_id) {
                return $('.'+quote_id).first().data('nrama_quote') || null;
            },
            
            /**
             * @param range{Rangy}
             * @returns an array representing the order this quote probably appears
             * on the page.  Assumes that earlier in DOM means earlier on screen.
             * (the alternative would be to use height, but that fails for columns
             * & varying height)
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
                return page_order;
            },
            
            /**
             * calculate the offset (.top, .left) of a quote
             */
            offset : function offset(quote_id) {
                return $('.'+quote_id).first().offset();
            }
        }
        
        /**
         * provides methods for, e.g., getting sources given a note
         */
        nrama.finder = {};  //can't define until page has loaded
        
        nrama.notes = _make_notes(nrama.settings, nrama.uuid, nrama.persist,
                                  nrama.sources, nrama.quotes, nrama.finder);

        /**
         * main setup:
         *  - init dependencies & nrama
         *  - load notes & quotes;
         *  - configure events (select to create quote, etc)
         */
        $(document).ready(function(){
            /**
             * nrama.page_id is a value s.t. two page instances have the same page_id exactly
             *   when we want to load the same notes & quotes onto those pages.  This is really
             *   hard to compute (e.g. DOI helps but if different users see an article with
             *   different formatting, should we load the same notes & quotes?  Probably.)
             * In future this might be doi or similar
             */
            nrama.page_id = window.location.protocol+"//"+window.location.host+window.location.pathname;  //the url with no ?query or #anchor details
            
            nrama.finder.find_source = function(thing) {
                //in embedded mode there is only one source (but we re-create it in case settings changed)
                return nrama.sources.create({
                    page_title : document.title,
                    url : document.location.href,
                    page_id : nrama.page_id,
                    user_id : nrama.settings.user_id
                });
            }

            /**
             * this is the node within which notes and quotes are possible and
             * relative to which their locations are defined.
             * Might eventually be configured per-site
             * NB nrama.root_note must be defined after document loaded!
             */
            //nrama.root_node = $('#readOverlay')[0]; 
            nrama.root_node = document.body;
    
            rangy.init();
    
            $.log('nrama: loading notes and quotes ...');
            //using _.defer just means waiting until callstack cleared
            _.defer(nrama.quotes.load, nrama.page_id, function(error, data){
                _.defer(nrama.notes.load, nrama.page_id, nrama.default_callback );
            });
            
            // --- configure events ---
            
            //based on underscore but can't use their throttle as it calls fn AFTER timout
            var throttle2 = function(func) {
                var timeout;
                return function() {
                    var context = this,
                        args = arguments;
                    var reset_timeout = function() {
                        timeout = null;
                    };
                    if( !timeout ) {
                        timeout = setTimeout(reset_timeout, nrama.settings.event_delay);
                        func.apply(context, args);
                    }
                };
            };
            
            // highlighting text creates a quote
            var create_quote_from_selection = function(e){
                if( e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
                    //any modifier key cancels quote creation
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
                if( quote.content != '' ) {
                    nrama.quotes.save(quote, function(error, data){
                        //(todo -- some indicate that it has failed?
                        if( !error ) {
                            nrama.quotes.display(quote);   //display the quote only after it has been saved
                        }
                    });
                    nrama._debug((function(){ var a={}; a[quote._id]=quote; return a; })()); 
                }
            };
            $(document).bind("mouseup", throttle2(create_quote_from_selection) );
            
            //click a quote to create a note
            var create_note_from_quote_click = function(e){
                if( e.shiftKey || e.ctrlKey ) {
                    //shift key cancels notecreation, so does ctrl
                    return;
                }
                if( e.altKey || e.metaKey ) {
                    //alt key causes quote deletion (in separate handler)
                    return;
                }   
                var quote = $(this).data('nrama_quote');
                var note = nrama.notes.create(quote);
                nrama.notes.display(note);
            };
            $('._nrama-quote').live('click', throttle2(create_note_from_quote_click) );
            
            // alt- or meta-click a quote to delete it (after checking there are no linked notes)
            $('._nrama-quote').live('click', function(e){
                if( e.altKey || e.metaKey ) {
                    var quote = $(this).data('nrama_quote');
                    var note_ids = nrama.notes.find(quote);
                    if( note_ids.length != 0 ) {
                        //don't delete quotes with notes attached ...
                        var $quote_nodes = $('.'+quote._id);
                        $quote_nodes.css({'border-top':'1px dashed red',
                                         'border-bottom':'1px dashed red'})
                        //... instead make the relevant notes bounce
                        var idstr = '#' + note_ids.join(', #');
                        $(idstr).effect('bounce', function(){
                            $quote_nodes.css({'border-top':'none',
                                             'border-bottom':'none'},500)
                        });
                        return;
                    }
                    $.log("nrama start deleting quote "+quote._id);
                    nrama.quotes.remove(quote);
                    return;
                }
            });
        
            //click on a note to enable editing, bring it to the front and flash the associated quote
            $('._nrama-note textarea').live('click',function(e){
                var $textarea = $(this);
                var $note = $(this).parents('._nrama-note').first();
                nrama.notes.bring_to_front($note);
                var note= $note.data('nrama_note');
                nrama.quotes.flash(note.quote_id);
            });
            
            //tabbing out of a note doesn't move to next note (because weird).
            //thank you http://stackoverflow.com/questions/1314450/jquery-how-to-capture-the-tab-keypress-within-a-textbox
            $('._nrama-note').live('keydown',function(e){
                if( e.which == 9 ) {
                    $('textarea', this).blur();
                    e.preventDefault();
                }
            });       
        });
    }
    
    /**
     * IT ALL STARTS HERE
     * Determine how to initialize depending on whether bookmarklet or embedded in page
     */
    if( typeof exports !== 'undefined' ) {    //exports undefined means nrama is already loaded -- bookmarklet may be called more than once)

        if( typeof _nrama_bkmklt === 'undefined' && typeof require !== 'undefined' ) {
            //initialise as commonJS module
            //in this mode, we just provide functions to build the nrama object
            exports._make_logging = _make_logging;
            exports._make_debug = _make_debug;
            exports._make_persist = _make_persist;
            exports._make_sources = _make_sources;
            exports._make_notes = _make_notes;
            //exports.nrama.uuid = require('./nrama_uuid');
            //_nrama_init_commonjs(exports.nrama, jQuery);
        } else {
            if( typeof _nrama_bkmklt === 'undefined' || !_nrama_bkmklt ) {
                //run as embedded <script> (_nrama_bkmklt must be defined by the boomarklet code)
                _nrama_init(exports, jQuery);
            } else {
                // run in bookmarklet mode : load libraries & only start work after they loaded
                // thank you http://stackoverflow.com/questions/756382/bookmarklet-wait-until-javascript-is-loaded
                //from jQuery ajaxTransport
                var loadScript2 = function(url, callback) {
                    var head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;
                    var script = document.createElement( "script" );
                    //script.charset = set this?$
                    script.src = url;
                    // Attach handlers for all browsers
                    script.onload = script.onreadystatechange = function( _, isAbort ) {
                        if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
                            // Handle memory leak in IE
                            script.onload = script.onreadystatechange = null;
                            // Remove the script
                            if ( head && script.parentNode ) {
                                head.removeChild( script );
                            }
                            // Dereference the script
                            script = undefined;
                            if ( !isAbort ) {
                                callback( 200, "success" );
                            }
                        }
                    };
                    // Use insertBefore instead of appendChild  to circumvent an IE6 bug.
                    // This arises when a base node is used (#2709 and #4378).
                    //document.body.appendChild(script);
                    head.insertBefore( script, head.firstChild );
                }
                loadScript2(_NRAMA_LIB_URL, function() {

                    _nrama_init(exports, jQuery);
                });
            }
        }
    }
// if exports is not defined, or if _nrama_bkmklt exists, attach everything to this.nrama
//     but if nrama is already defined, do nothing (send undefined)
// otherwise behave as a commonJS module
})(
    ( typeof exports !== 'undefined' && typeof _nrama_bkmklt === 'undefined' ) ?
        exports
    :(
        typeof nrama === 'undefined' ?
            nrama={}
        :
            undefined   //prevent execution if nrama already defined
    )
);   