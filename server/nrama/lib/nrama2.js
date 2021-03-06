/**
 * note-o-rama, second attempt
 * Copyright (c) 2011 Stephen A. Butterfill
 *
 * For dependencies see lib.js
 *
 * To run as bookmarklet (nb _NRAMA_LOCAL = load everything from localhost; delete the 'now' query param if not in developent mode):
 *   javascript:(function(){delete module;delete exports;_NRAMA_BKMRKLT=true;_NRAMA_LOCAL=true;_NRAMA_USER='steve';document.body.appendChild(document.createElement('script')).src='http://localhost:5984/nrama/_design/nrama/bkmrklt/nrama2.js?now=new Date().getTime()'; })();
 *
 * To embed in page:
 *   <script src='lib.min.js" ></script>
 *   <script>
 *     _NRAMA_BKMRKLT = false;
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

/*
    This file is part of Note-o-rama.

    Note-o-rama is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Note-o-rama is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Note-o-rama.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Wrapping for both <script> and commonJS require() use
 * Thanks to http://caolanmcmahon.com/posts/writing_for_node_and_the_browser
 * The function may be called with exports undefined to prevent execution (this
 * is to allow checking nrama not already loaded, see below).
 */
(function(exports){
    
    if( typeof exports === 'undefined' ) {
        try{
            $.log('nrama: cancelled because already loaded.');
        } catch(e) {}
        return;
    }
    
    /**
     * fix uuids so that it doesn't include dashes (no good for couchDB)
     * also include a trailing N to mark the source
     */
    exports._make_uuid = function(uuid) {
        var new_uuid = function (use_b36/*optional*/){
            if( use_b36 ) {
                return parseInt(uuid().replace(/-/g,''), 16).toString(36);
            } else {
                return  uuid().replace(/-/g,'')+'N';
            }
        };
        return new_uuid;
    };

    /**
     * These are some settings for embedded mode (bkmrklt or <script>).
     * Others are added during init (see page_id and root_node).
     * When used on the server, some settings are overriden.
     * @param lib provides $ (jQuery) and _ (underscore)
     */
    exports._make_settings = function(nrama_uuid, use_localhost, lib){
        var settings = {
            // -- internals
            is_embedded : true,     //set to false when being used on the server
            debug : true,
            nrama_version : 2.02,
            xdm_url: ( use_localhost ?
                        'http://localhost:5984/nrama/_design/nrama/_rewrite/xdm/provider.debug.html'
                     :
                        'http://note-o-rama.com/xdm/provider.html'
                     ),
            event_delay : 750, //min time between creating two notes or quotes
            // -- user identification
            user_id : '*'+nrama_uuid(true).slice(0,10), //default to random anonymous user
            password : 'new',   //TODO think of clever way to store this
            me_only : true,    //show only my notes and quotes
            // -- quotes & note settings
            note_default_text : 'type now',
            background_color : '#FFFC00', //for quotes todo: I like '#FCF6CF' but can't be seen on some screens -- must implement per user settings soon
            background_color_other : 'rgba(240,240,240,0.5)',   //color for other ppl's notes and quotes (TODO)
            note_background_color : 'rgba(240,240,240,0.9)', 
            persist_started_color : '#FFBF00',  //#FFBF00=orange
            note_width : 150, //pixels
            max_quote_length : 5000,  //useful because prevents
            // -- styling
            style : {   //applies to note_editor & dialogs
                fontFamily : "Palatino, 'Palatino Linotype', Georgia, Times, 'Times New Roman', serif",
                fontSize : '12px',
                color : 'rgb(0,0,0)'
            },
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
                'text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)',
                '-moz-text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)',
                '-webkit-text-shadow' : '1px 1px 20px rgba(250,250,250,1), -1px -1px 20px rgba(250,250,250,1), 0 0 1px rgba(250,250,250,1)'
            },
            simplemodal : {
                autoResize: true,
                overlayClose: true,
                zIndex : 32000,
                overlayCss : { 'background-color' : '#000' },
                containerCss : {
                    height : 'auto',
                    backgroundColor : '#fff',
                    border: '8px solid #444',
                    padding: '12px'
                },
                onShow : function(){
                    lib._.delay( function() { lib.$('.simplemodal-container').css({height:'auto'}); }, 50 );
                }
            }
        };
        settings.note_style.width = settings.note_width+"px";
        settings.note_editor_style.width = settings.note_width+"px";
        lib.$.extend(settings.note_editor_style, settings.style);
        lib.$.extend(settings.simplemodal.containerCss, settings.style);
        return settings;
    };
        

    /**
     * caution : if settings.debug, this will add to window (if defined)
     */
    exports._make_debug = function(settings, window) {
        var $ = jQuery;
        var _debug = function(){};    //does nothing if not debugging
        if( settings.debug && typeof window !== 'undefined' ) {
            //window.$=jQuery;                        //<-- nb breaks noConflict
            _debug = function _debug(){
                var map_or_array = arguments.length === 1 ? arguments[0] : arguments;
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
            //convenience callback for testing async
            window.cb = function(){ $.log('window.cb called, sending arguments to _debug'); _debug(arguments); }; 
        }
        return _debug;
    };
    
    /**
     * caution: extends $
     */
    exports._make_logging = function(settings, $) {
        var logger = function(){ return false; };
        if( settings.debug ) {
            logger = function(){
                // will not log anything unless in debug mode
                try {
                    var args = Array.prototype.slice.call(arguments);
                    $.each(args, function(idx, arg){
                        console.log(arg);
                    });
                    return true;
                } catch(e) {
                    return false;
                }
            };
        }
        $.extend({"log":logger});
        return logger;
    };

    /**
     * @returns the rpc transport for xdm 
     */
    exports._make_rpc = function(settings, easyXDM, lib) {
        var rpc = {};
        rpc.$ = lib.$;
        
        //local functions allow communication from the server to user
        var local = {};
        local.get_version = {
            method : function(success, error){ success( settings.nrama_version ); }
        };
        local.msg = {
            method : function(message, success, error){
                if( typeof message === 'string' ) {
                    alert(message);
                    success('done');
                }
            }
        };
        /**
         * display a dialog using jQuery.simplemodal, minimsing xss vulnerabilities
         */
        local.modal = {
            method : function(div_str, success, error){
                if( typeof div_str === 'string') {
                    var $div = rpc.$('<div>'+div_str+'</div>');
                    rpc.$('#id_ok', $div).click(function () {
                        rpc.$.modal.close();
                        success('ok');          //nb this only triggers cb on remote end (no function is passed)
                    });
                    $div.beResetCSS().modal(settings.simplemodal);
                }
            }
        };
        var rpc_names = ['db_saveDoc', 'db_removeDoc', 'db_getView', 'db_doUpdate',
                         'session_login', 'session_logout', 'session_info'];
        var remote = { };
        rpc.$.each(rpc_names, function(idx,name){
            remote[name] = {};      //create a stub      
        });
        if( settings.debug ) {
            remote.test = {};
        }
        
        var _rpc = new easyXDM.Rpc({ remote:settings.xdm_url },{ remote:remote, local:local });
        //ideally _rpc would be all we need, but some tweaking is needed ...
        
        /**
         * get rpc to work with kanso.db and kanso.session : callback arguments passed as an array.
         * (See the corresponding wrappers in xdm/provider.js|html to get full picture.)
         * wrap_unarray is for undoing the effects of executing callbacks with all parameters
         * collapsed into an array (easyXDM only allows for callbacks with a single parameter).
         */
        var _callback_wrapper = function(fn){
            return function(){
                var new_args = arguments[0];
                fn.apply(null, new_args);
            };
        };
        var _wrap_unarray = function( method ) {
            return function( ) {
                var new_arguments = lib._.map(arguments, function(arg){
                    if( typeof(arg) === 'function' ) {
                        return _callback_wrapper(arg);    //wrap because we're putting parameters into array for xdm
                    }
                    return arg;
                });
                method.apply(null, new_arguments);  
            };
        };

        // finally, add the rpc functions (as db.save, session.save etc)
        rpc.db={};
        rpc.session={};
        rpc.$.each(rpc_names, function(idx,name){
            //rpc[name] = _wrap_unarray( _rpc[name] );
            var wrapped_method = _wrap_unarray( _rpc[name] );
            var parts = name.split('_');
            rpc[parts[0]][parts[1]] = wrapped_method;
        });
        return rpc;
    };
    
    
    /**
     * @return a wrapped subset of kanso's db module, same API
     * Any 403 Forbidden errors will trigger a custom event, 'nrama_403'
     */
    exports._make_db = function(kanso_db, lib) {
        var db = {};
        
        /**
         * we want to capture 403 (forbidden) errors so that the user can login
         * caution : assumes last argument is the unique callback (as node js)
         */
        var _wrap_403_callback = function( callback ) {
            return function(error, data) {
                if( error && ( error.status === 403 || error.error === 'forbidden' ) ) {
                    var user_id = '';
                    try {
                        if( error.message.indexOf('user_id:') !== -1 ) {
                            user_id = error.message.slice(error.message.indexOf('user_id:')+8);
                        }
                    } catch(e) {}
                    lib.$(document).trigger('nrama_403', user_id);
                }
                callback(error, data);
            };
        };
        var _wrap_403 = function( fn ) {
            return function() {
                var args = Array.prototype.slice.call(arguments);
                args[args.length-1] = _wrap_403_callback( args[args.length-1] );
                return fn.apply(null, args);
            };
        };
        db.saveDoc = _wrap_403( kanso_db.saveDoc );
        db.removeDoc = _wrap_403( kanso_db.removeDoc );
        db.getView = _wrap_403( kanso_db.getView );
        db.doUpdate = _wrap_403( kanso_db.doUpdate );
        
        return db;
    };

    /**
     * @return a wrapped subset of kanso's session module, same API
     */
    exports._make_session = function(kanso_session, lib) {
        /**
         * wrap session.* to fire event telling us which user is logged in
         * (if any)
         * This doesn't work for session.login (need different wrapper, below  )
         */
        var _wrap_callback = function(callback) {
            return function(error, data) {
                if( !error ) {
                    if( data && data.userCtx && data.userCtx.name ) {
                        lib.$(document).trigger( 'nrama_user_id', data.userCtx.name );
                    } else {
                        //null data means not logged in
                        lib.$(document).trigger( 'nrama_user_id', null );
                    }
                }
                callback(error,data);
            };
        };
        var _wrap = function( fn ) {
            return function() {
                var args = Array.prototype.slice.call(arguments);
                args[args.length-1] = _wrap_callback( args[args.length-1] );
                return fn.apply(null, args);
            };
        };
        /**
         * needs separate wrapper because callback not called with userCtx.name
         */
        var login = function(username, password, callback) {
            var user_id = username;
            kanso_session.login(username, password, function(error, data) {
                if( !error) {
                    lib.$(document).trigger( 'nrama_user_id', user_id );
                }
                callback(error, data);
            });
        };
        return {
            login : login,
            logout : _wrap( kanso_session.logout ),
            info : _wrap( kanso_session.info ) 
        };
    };


    /**
     * @param db{Object} implements (a subset of) kanso's db module
     * @param session{Object} implements (a subset of) kanso's session module
     * @param uuid{function} returns a uuid synchroniously
     */
    exports._make_persist = function(nrama_settings, db, session, uuid, _debug) {
        persist = {};
        persist.$ = jQuery;

        //log errors (used to wrap callbacks from db & session)
        var _debug_wrap = function(name, callback) {
            return function(error, data){
                if( error ) {
                    _debug({msg:'nrama_'+name+': error',error:error});
                }
                callback(error, data);
            };
        };
    
        /**
         * save a note or a quote (or that JSON.stringify will work on, really).
         * NB: If successful, will update a _rev property on thing and insert _id
         * NB: if options.clone_on_conflict, @param thing will have its properties updated  incl. new _id
         */
        persist.save = function(thing, options/*optional*/, callback/*required*/ ) {
            if( !callback ) {
                callback = options;
                options = {};
            }
            var defaults = {
                clone_on_conflict : false   //e.g. set to true used when saving notes
            };
            var settings = persist.$.extend(true, {}, defaults, options);
            
            //add nrama_version if not present
            if( !thing.nrama_version ) {
                thing.nrama_version = nrama_settings.nrama_version;
            }

            db.saveDoc(thing, function(error, data){
                if( error ) {
                    if( settings.clone_on_conflict ) {
                        if( error.status === 409 || error.error === "conflict")  {
                            persist.$.log('nrama_persist.save: conflict on save for '+(thing.type || '')+' '+thing._id+' --- started cloning');
                            persist.clone(thing, callback);
                            return;
                        }
                    }
                    _debug({msg:'nrama_persist.save: error',error:error});
                } else {
                    thing._rev = data.rev;
                    thing._id = data.id;
                }
                callback(error, data);
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
            var cloned_thing = persist.$.extend(true, {}, thing, updates); 
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
            _debug({msg:'thing.type = '+thing.type+' for thing._id='+thing._id});
            db.doUpdate( thing, encodeURIComponent( thing.type ), _debug_wrap('persist.update', callback) );
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
            db.removeDoc(thing, _debug_wrap('persist.rm',callback));
        };
            
        /**
         * loads data for a page (e.g. all quotes)
         * @param options.page_id is the page to load stuff for (required)
         * @param options.type{String} specifies which type of objects to load (required)
         * @param options.user_id{String} [optional] omit if loading for all users
         */
        persist.load = function(options, callback) {
            var defaults = {
                page_id : undefined, type : null, user_id : null,
                success : null, error : null
            };
            var load_settings = persist.$.extend({}, defaults, options);
            
            var query;
            if( !load_settings.type ) {
                query = {startkey:'["'+load_settings.page_id+'"]', endkey:'["'+load_settings.page_id+'",{}]'};
            } else { //type is specified
                if( !load_settings.user_id ) {
                    query = {
                        startkey:'["'+load_settings.page_id+'","'+load_settings.type+'"]',
                        endkey:'["'+load_settings.page_id+'","'+load_settings.type+'",{}]'
                    };
                } else {    //type and user_id are specified
                    query = {key:'["'+load_settings.page_id+'","'+load_settings.type+'","'+load_settings.user_id+'"]' };
                }
            }
            db.getView('pageId_type_userId', query, _debug_wrap('persist.load',callback));
        };
    
        return persist;
    };


    /**
     * Ways of serializing and restoring rangy range objects.
     * These would ideally work across browsers; rangy_1_2 claims not to.  
     * (Having multiple ways allow us to upgrade the method of serialization
     * while still being able to correctly deserialize quotes created with older
     * methods.)
     * @param lib{map} provides rangy
     */
    exports._make_serializers = function(settings, lib){
        var serializers = {
            rangy_1_2 : {
                id : 'rangy_1_2',   // id must match the name
                serialize : function(range) {
                    // second param means do not compute checksum (because adding highlights to page screws it up)
                    return lib.rangy.serializeRange(range, true, settings.root_node);
                },
                deserialize : function(text) {
                    return lib.rangy.deserializeRange(text, settings.root_node);
                }
            }
        };
        serializers.current = serializers.rangy_1_2;   // the serializer to be used in creating new quotes
        return serializers;
    };



    /**
     * for each page_id with notes, each user must create a source.  
     *  @param lib{map} provides dependencies : 
     *    - b64_hmac_md5    from md5.js 
     *    - BibtexParser    from bibtex.js
     *    - $               from jQuery
     */
    exports._make_sources = function(settings, persist, _debug, lib/*optional*/) {
        var sources = {};
        lib.$.extend(sources, lib); //add lib.b64_hmac_md5 etc to sources
        
        /**
         * @returns the id of a source record for the user and page
         * @param o{map} should contain user_id and page_id
         */
        sources.calculate_id = function(o) {
            return 'source_'+sources.b64_hmac_md5(o.user_id, o.page_id);
        };
        
        /**
         * @param attrs must contain page_id & user_id ; can be note or quote in which case only page_id and user_id are used
         */
        sources.create = function(attrs) {
            var new_source;
            if( !attrs.type || attrs.type === 'source' ) {
                new_source = sources.$.extend(true, attrs, {});
            } else {
                //@param attrs is a note or quote or some such
                new_source = {
                    page_id : attrs.page_id,
                    user_id : attrs.user_id,
                    url : ( attrs.url ? attrs.url : undefined ),
                    page_title : ( attrs.page_title ? attrs.page_title : undefined )
                };
            }
            if( settings.is_embedded ) {
                var defaults = {
                    page_title : document.title,
                    url : document.location.href
                };
                new_source = sources.$.extend(true, defaults, new_source);
            }
            new_source._id = sources.calculate_id(new_source);  
            new_source.type = 'source';
            return new_source;
        };
        
        /**
         * Create or update a source.
         * @param source must contain (TITLE or page_title), url, page_id
         *      & user_id if update is being called to create a new source
         * Can be called with either a source or a note or a quote
         * Caution: if called with source, source will be modified in place.
         */
        sources.update = function(thing, callback) {
            var source = ( thing.type === 'source' ? thing : sources.create(thing) );
            persist.update(source, callback);
        };

        /**
         * call update once per source only (but if it fails, will repeat next
         * time it is called)
         * can be called with either a source or a note or a quote 
         */
        var _update_memo = [];
        sources.update_once = function(thing, callback) {
            var source_id = ( thing.type === 'source' ? thing._id : thing.source_id );
            var already_done = ( sources._.indexOf(_update_memo, source_id) !== -1 );
            if( already_done  ) {
                callback(null, 'already done');
                return;
            }
            sources.update(thing, function(error, data){
                if(!error){
                    _update_memo.push(source_id);
                }
                callback(error, data);
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
         * quickly attempt to guess whether something is bibtex
         */
        // like this: @text { = , }
        var _bib_rex = /(^|[^0-9A-Z&\/\?]+)(@)([0-9A-Z_]*[A-Z_]+[a-z0-9_]*)([\s\S]*?{)([\s\S]*?=)([\s\S]*?,)([\s\S]*?})/gi;
        sources.detect_bibtex = function( text ) {
            return !!( text.match(_bib_rex) );
        };
        /**
         * given a string, attempts to parse it as bibtex and update the source
         * with the results.
         * @param thing can be a source, quote or note
         * E.g.
         *   b='@incollection{Baillargeon:1995lu,	Address = {Oxford},	Author = {Baillargeon, Ren{\'e}e and Kotovsky, Laura and Needham, Amy},	Booktitle = {Causal cognition. A multidisciplinary debate},	Date-Added = {2010-08-04 17:40:21 +0100},	Date-Modified = {2010-08-04 17:40:38 +0100},	Editor = {Sperber, Dan and Premack, David},	Pages = {79-115},	Publisher = {Clarendon},	Title = {The Acquisition of Physical Knowledge In Infancy},	Year = {1995}}'
         */
        sources.update_from_bibtex = function(bib_str, thing, callback) {
            var parser = new sources.BibtexParser();
            var results;
            try {
                parser.setInput(bib_str);
                parser.bibtex();
                results = parser.getEntries();
            } catch(e) {
                _debug("caught error parsing bibtex",e);
                callback('error parsing bibtex '+e);
                return;
            }
            if( sources._.size(results) !== 1 ) {
                callback('nrama_sources.parse_bibtex: input contained '+sources._.size(results)+' entries ('+bib_str+')');
                return;
            }
            var entry = sources._.toArray(results)[0];
            if( entry.AUTHOR ) {
                entry.AUTHOR_TEXT = entry.AUTHOR;
                entry.AUTHOR = _parse_authors(entry.AUTHOR_TEXT);
            }
            entry.bibtex = bib_str;
            var source = sources.create(thing);
            source = sources.$.extend(true, {}, source, entry);
            sources.update(source, callback);
        };
        return sources;
    };
    
    
    /**
     * This is only intended to work embedded in a page, not on the server.
     * lib must include
            b64_hmac_md5 
            rangy 
            $ ( jQuery )
            _ : window._
     */
    exports._make_quotes = function(settings, uuid, persist,
                                    sources, serializers, _debug,
                                    lib) {
        var quotes = {};
        lib.$.extend(quotes, lib);  //add items in lib to quotes

        /**
         * @returns a hash for determining whether two quotes are the same
         *     across different users.
         */
        quotes.calculate_hash = function(quote) {
            var hash = quotes.b64_hmac_md5(quote.page_id, quote.content);
            return hash;
        };
            
        /**
         * @param range is a Rangy range object
         */
        quotes.create = function(range) {
            var new_quote = {
                _id : 'q_'+uuid(),  
                type : 'quote',
                content : quotes.$.trim( range.toString() ),
                background_color : settings.background_color,
                url : document.location.href,
                page_id : settings.page_id,  
                page_title : document.title,
                //the xpointer to the quote (well, it isn't actually an xpointer but  any serialized representation of the range)
                xptr : serializers.current.serialize(range),
                //the name of the method used to seralise
                xptr_method : serializers.current.id,
                page_order : quotes.calculate_page_order(range),
                created : new Date().getTime(),
                updated : new Date().getTime(),
                user_id : settings.user_id
            };
            new_quote.hash = quotes.calculate_hash(new_quote);
            new_quote.source_id = sources.calculate_id({
                user_id : new_quote.user_id,
                page_id : new_quote.page_id
            });
            return new_quote;
        };
        
        quotes.save = function(quote, options/*optional*/, callback) {
            if( !callback ) {
                callback = options;
                options = {};
            }
            //update the source before saving any quotes
            sources.update_once(quote, function(error, data) {
                if( error ) {
                    quotes.$.log('error in nrama_quotes.save is due to call to sources.update_once.');
                    callback(error, data);
                    return;
                }
                persist.save(quote, options, callback);
            });
        };
        
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
        quotes.display = function(quote) {
            if( quotes.$('.'+quote._id).length !== 0 ) {
                return true;  //quote already displayed
            }
            var range = quotes.get_range(quote);
            if( !range ) {
                return false;
            }
            var _rangy_highlighter = quotes.rangy.createCssClassApplier("_nrama-quote "+quote._id,false);
            try{
                _rangy_highlighter.applyToRange(range);
            } catch(error) { //seems to be rare
                if( settings.debug ) {
                    quotes.$.log("nrama: error using Randy's createCssClassApplier.applyToRange, re-throwing");
                    throw error;
                } else {
                    return false;   //silently fail if not in debug mode
                }
            }
            quotes.$('.'+quote._id).css('background-color',quote.background_color).data('nrama_quote',quote);
            return true;
        };
        
        /**
         * remove a quote's highlights from the HTML document.
         * leaves jQuery.data('nrama_quote') and _id as class intact, so quote can
         *   still be found (todo: not sure this is a good idea!).
         * todo -- this would ideally remove the elements so that subsequent quotes
         *  had more reliable xpointers (as long as we don't have a way of getting
         *  good xpointers).
         */
        quotes.undisplay = function(quote) {
            quotes.$('.'+quote._id).
                removeClass('_nrama-quote').
                css({'border-top':'none', 'border-bottom':'none', 'box-shadow':'none'}).
                //removeClass(quote._id). //not sure whether I want to do this yet
                css('background-color','red').
                animate({'background-color':'black'}, function(){
                    quotes.$(this).css('background-color','inherit');
                });
        };
        
        quotes.flash = function(quote_id) {
            var $quote_nodes = quotes.$('.'+quote_id);
            $quote_nodes.css({'border-top':'1px dashed black',
                             'border-bottom':'1px dashed black',
                             'box-shadow':'0 0 20px' + settings.background_color });
            window.setTimeout(function(){
                $quote_nodes.css({'border-top':'none', 'border-bottom':'none', 'box-shadow':'none'});            
            },600);
        };
        
        /**
         * request quote delete from server and remove from page if successful
         */
        quotes.remove = function(quote) {
            quotes.$('.'+quote._id).css('background-color','orange');
            persist.rm(quote, function(error, data){
                if( !error ) {
                    quotes.undisplay(quote);
                }
            });
        };
        
        /**
         * load quotes from server and display on this page
         */
        quotes.load = function(page_id, callback) {
            var user_id = settings.me_only ? settings.user_id : undefined;
            persist.load({
                page_id : page_id,
                type : 'quote',
                user_id : user_id
            }, function(error, data){
                if( !error && data ) {
                    quotes.$.log('nrama_quotes.load got ' + ( data.rows ? data.rows.length : 0 ) + ' quotes from server for user '+user_id);
                    //need to sort quotes by the time they were added to page for best chance of displaying them
                    var _sorter = function(a,b){ return a.value.created - b.value.created; };
                    data.rows.sort(_sorter);
                    var _failing_quotes = [];
                    quotes.$.each(data.rows, function(index, row){
                        var quote = row.value;
                        var success = quotes.display(quote);  //this won't re-display quotes already present
                        if( !success ) {
                            _failing_quotes.push(quote._id);
                        }
                    });
                    if( _failing_quotes.length > 0 ) {
                        quotes.$.log('failed to display '+_failing_quotes.length+' quotes, _ids: '+_failing_quotes.join('\n\t'));
                    }
                }
                callback(error, data);
           });
        };
        
        /**
         * @returns the range for the specified quote or null if not possible.
         * caution: this may fail once the quote has been highlighted!
         */
        quotes.get_range = function(quote) {
            var method = quote.xptr_method || '_method_unspecified'; //method for recovering the range from the quote
            if( !(serializers.hasOwnProperty(method)) ) {
                quotes.$.log('unknown xptr_method ('+method+') for quote '+quote._id);
                return null;
            }
            try {
                var serializer = serializers[method];
                return serializer.deserialize(quote.xptr);
            } catch(error) {
                //quotes.$.log('nrama_quotes.display FAIL with range = '+quote.xptr+'\n\t for quote '+quote._id);
                //_debug({catch_error:error});  //not usually informative
                return null;
            }
        };
        
        /**
         * @returns a quote object (or null if not found)
         */
        quotes.get_from_page = function(quote_id) {
            return quotes.$('.'+quote_id).first().data('nrama_quote') || null;
        };
        
        /**
         * @param range{Rangy}
         * @returns an array representing the order this quote probably appears
         * on the page.  Assumes that earlier in DOM means earlier on screen.
         * (the alternative would be to use height, but that fails for columns
         * & varying height)
         */
        quotes.calculate_page_order = function calculate_page_order(range) {
            var doc_height = quotes.$(settings.root_node).height();
            var doc_width = quotes.$(settings.root_node).width();
            //todo
            var node = range.startContainer;
            var page_order = [range.startOffset];   //create in reverse order, will reverse it
            while ( node && node !== document.body ) {
                page_order.push(quotes.rangy.dom.getNodeIndex(node, true));
                node = node.parentNode;
            }
            page_order.reverse();
            return page_order;
        };
        
        /**
         * calculate the offset (.top, .left) of a quote
         */
        quotes.offset = function(quote_id) {
            return quotes.$('.'+quote_id).first().offset();
        };
        
        return quotes;
    };
    
    
    /**
     *  @param quotes can be set to null; if provided it is used to position noes
     */
    exports._make_notes = function(settings, uuid, persist,
                               sources, quotes, _debug) {
        var notes = {};
        var $ = jQuery;
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
                updated : new Date().getTime(),
                user_id : quote.user_id
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
        var _hashtag_regex = /(^|[^0-9A-Z&\/\?]+)(#|＃)([0-9A-Z_]*[A-Z_-]+[a-z0-9_]*)/gi;
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
            _debug({msg:'updating source'});
            sources.update_once(note, function(error, data) {
                if( error ) {
                    $.log('error in nrama_notes.save, due to call to nrama_sources.update_once.');
                    callback(error, data);
                } else {
                    _debug({msg:'saving note'});
                    persist.save(note, options, callback);
                }
            });
        };
            
        var _zindex_counter = 10000; //used for bringing notes to the front and to ensure new notes are on top
        notes.bring_to_front = function($note) {
            $note.css('z-index', _zindex_counter++);  //move note to front
        };

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
            var random_shift = function(){ return Math.floor(Math.random()*(viewport_width/30)); };
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
            if( $('#_nrama_notes').length === 0 ) {
                $('<div id="_nrama_notes"></div>').appendTo('body').
                    css({position:"absolute", left:"0px", top:"0px",width:"0%", height:"0%"});
            }

            // --- start properly here
            if( $('#'+note._id).length !== 0 ) {  
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
                                beResetCSS().
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

        // -- call this to re-enable note when error saving or deleting
        var _finally = function _finally($note, restore_background ){
            var $textarea = $('textarea', $note);
            //make changes to textarea possible & ensure they trigger updates
            $textarea.removeAttr("disabled");
            $textarea.unbind('blur', notes.update_on_blur).one('blur', notes.update_on_blur);  //make sure edits are saved
            if( restore_background ) {
                $textarea.parents('._nrama-note').css({backgroundColor:settings.note_background_color});
            }
        };
        /**
         * event handler for blur event on TEXTAREA of $note
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
            
            
            // -- delete note if note content is empty
            var new_content = $textarea.val();
            if( $.trim(new_content) === '' ) {
                $.log("nrama_notes.update -- deleting note "+$note.attr('id'));
                notes.remove($note); 
                return;
            }
            
            var note = $note.data('nrama_note');
            
            // -- if content unchanged, do nothing (so moving a note won't trigger a change)
            var old_content = note.content;
            if( old_content === new_content ) {
                _finally($note, true);
                return;
            }
    
            var updates = {
                content : new_content,
                updated : new Date().getTime()
            };
            if( settings.is_embedded ) {
                $.extend(updates, {
                    background_color : settings.note_background_color,
                    left : $note.offset().left,
                    top : $note.offset().top,
                    doc_height : $(document).height(),
                    doc_width : $(document).width()
                });
            }
            var new_note = $.extend(true, {}, note, updates);   
            
            notes.save(new_note, {clone_on_conflict:true}, function(error,data){
                if( error ) {
                    $note.css({backgroundColor : settings.persist_failed_color});
                    _finally($note, false);
                } else {
                    //$.log("nrama_notes.update_on_blur: was persisted note _id:"+new_note._id+" for quote:"+new_note.quote_id);
                    $note.attr('id',new_note._id); //may have changed (save can clone)
                    $note = $('#'+new_note._id);   //have to update after changing id attribute
                    $note.data('nrama_note', new_note);
                    //check for bibtex (do this after save to avoid conflicts)
                    if( sources.detect_bibtex(new_note.content) ) {
                        sources.update_from_bibtex(new_note.content, new_note, function(error, data){
                            if( !error ) {
                                $('#'+note._id).css({border:'1px solid #01DF01'});
                            }
                            _finally( $note, true );
                        });
                    } else {
                        _finally( $note, true );
                    }
                }
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
                    _finally($note, false);
                } else {
                    $.log("nrama_notes.remove deleted note "+note_id+" from server.");
                    $('#'+note_id).hide('puff',{},300+Math.floor(Math.random()*600), function(){
                        $('#'+note_id).remove();
                    });
                }
            });
        };
    
        /**
         * load notes from server and display on this page
         * run after quotes have been loaded and displayed in case notes need positioning
         */
        notes.load = function(page_id, callback) {
            var user_id = settings.me_only ? settings.user_id : undefined;
            persist.load({
                page_id : page_id,
                type : 'note',
                user_id : user_id
            }, function(error, data){
                if( error ) {
                    _debug({msg:'nrama_notes.load error:', error:error});
                    callback(error, data);
                    return;
                }
                $.log('nrama_notes.load got ' + ( data ? (data.rows ? data.rows.length : 0 ) : 0) + ' notes from server for user '+user_id);
                if( data && data.rows ) {
                    $.each(data.rows, function(index,row){
                        var note = row.value;
                        notes.display(note, {focus:false});
                    });
                }
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
                if( rel_quote_id === quote._id ) {
                    _ids.push($(this).attr('id'));  //add _id of the note to the list
                }
            });
            return _ids;
        };
        
        return notes;
    };
    
    
    
    
    /**
     * for dialogs (todo -- move event handlers)
     */
    exports._make_ui = function(settings, session, _debug, lib){
        var ui = {};
        
        var _update_user_id = function(data) {
            if( data && data.userCtx && data.userCtx.name ) {
                var logged_in_as = data.userCtx.name;
                if( logged_in_as !== settings.user_id ) {
                    //username has changed
                    ui.dialogs.warn_user_discrepancy(logged_in_as);
                    settings.user_id = logged_in_as;
                }
            }
        };
        /** 
         * may update settings.user_id.  may result in modal dialog warning
         */
        ui.info = function(callback){
            session.info(function(error, data){
                if( !error ) {
                    _update_user_id(data);
                }
                callback(error,data);
            });
        };
        /**
         * may update settings.user_id.  may result in modal dialog warning
         */
        ui.login = function(username, password, callback){
            session.login(username, password, function(error,data){
                if( !error ) {
                    _update_user_id(data);
                }
                callback(error,data);
            });
        };


        ui.dialogs = {};
        /**
         * switch user_id if logged in; otherwise check whether configured for
         * anonymous user and request user to log in if not.
         */
        ui.dialogs.login_if_necessary = function(callback) {
            ui.info( function(error,data) {
                if( data && data.userCtx && data.userCtx.name ) {
                    callback(null, 'already logged in');
                } else {
                    //not logged in
                    if( settings.user_id && settings.user_id[0] === '*' ) {
                        //anonymous
                        callback(null, 'anonymous user');
                    } else {
                        ui.dialogs.login(settings.user_id, callback);
                    }
                }
            });
        };
        
        /**
         * dispaly a login dialog.
         * @param callback{Function} will be called with an error if the user cancels.
         */
        ui.dialogs.login = function(username, msg/*optional*/, callback) {
            if( !callback ) {
                callback = msg;
                msg = '';
            }
            var last_error = {message:'you cancelled'};  //report results of last error if user cancels
            var $div = lib.$('<div><h2><a href="http://www.note-o-rama.com" target="_blank">Note-o-rama</a> : login</h2></div>');
            $div.append('<form id="login_form" action="/_session" method="POST">' +
                '<div class="general_errors">'+msg+'</div>' +
                '<div class="username field">' +
                    '<label for="id_name">Username</label>' +
                    '<input id="id_name" name="name" type="text" />' +
                    '<div class="errors">&nbsp;</div>' +
                '</div>' +
                '<div class="password field">' +
                    '<label for="id_password">Password</label>' +
                    '<input id="id_password" name="password" type="password" />' +
                    '<div class="errors">&nbsp;</div>' +
                '</div>' +
                '<div class="actions">' +
                    '<input type="button" id="id_cancel" value="Cancel" />' +
                    '<input type="submit" id="id_login" value="Login" />' +
                '</div>' +
            '</form>');
            $div.beResetCSS();
            lib.$('.general_errors, .errors', $div).css({color:'red'});
            lib.$('#id_name',$div).val(username||'');
            lib.$('#id_cancel', $div).click(function () {
                lib.$.modal.close();
                callback(last_error);
            });
            lib.$('form', $div).submit(function (ev) {
                ev.preventDefault();
                var username = lib.$('input[name="name"]', $div).val();
                var password = lib.$('input[name="password"]', $div).val();
                lib.$('.username .errors', $div).text(
                    username ? '': 'Please enter a username'
                );
                lib.$('.password .errors', $div).text(
                    password ? '': 'Please enter a password'
                );
                if (username && password) {
                    ui.login(username, password, function (error, data) {
                        _debug({error:error});
                        if( error ) {
                            last_error = error;
                            var error_msg = error.message || "Error "+(error.status || '')+" logging in (network connection?)";
                            lib.$('.general_errors', $div).text(error_msg);
                        } else {
                            lib.$($div).fadeOut('slow', function () {
                                lib.$.modal.close();
                                callback(null, data);
                            });
                        }
                    });
                }
                return false;
            });
            $div.modal(settings.simplemodal);
            lib._.delay( function(){
                if( username ) {
                    lib.$('#id_password').focus();
                }
            }, 50 );
        };
        
        ui.dialogs.warn_user_discrepancy = function(name, callback) {
            if( !callback ) { callback = function(){}; }
            var who = ( settings.user_id[0] === '*' ? 'anonymous users' : settings.user_id );
            lib.$.log('user logged in as '+name+' but this bookmarklet was configured for '+who );
            callback(null, 'not implemented yet');
        };
        return ui;
    };


    /**
     * put nrama together when used as bkmrklt or embedded <script>
     * (see nrama2_init.js for the corresponing init for the server parts)
     * caution: some init requires page load to be complete
     * @param callback{Function} is called when init done.
     */
    var _nrama_init = function(nrama, use_localhost, jQuery, callback) {
        nrama.$ = jQuery;

        var lib = { //provide dependencies as  map
            b64_hmac_md5 : window.b64_hmac_md5,
            rangy : window.rangy,
            BibtexParser : window.BibtexParser,
            $ : nrama.$,
            _ : window._
        };
        nrama.uuid = exports._make_uuid(uuid);
        nrama.settings = exports._make_settings(nrama.uuid, use_localhost, lib);
        //detect user if set by bkmrklt or script (will be overriden by session cookies)
        if( typeof _NRAMA_USER !== 'undefined' && _NRAMA_USER ) {
            nrama.settings.user_id = _NRAMA_USER;
        }

        nrama._debug = exports._make_debug(nrama.settings, window);
        nrama.log = exports._make_logging(nrama.settings, nrama.$);
        var _db, _session;
        if( typeof _NRAMA_NO_RPC === 'undefined' || !_NRAMA_NO_RPC  ) {
            nrama.rpc = exports._make_rpc(nrama.settings, easyXDM, lib);
            _db = nrama.rpc.db;
            _session = nrama.rpc.session;
        } else {
            //if not using RPC, the db will have been provided before this script was run
            $.log('no rpc');
            _db = window.db;
            _session = window.session;
        }
        nrama.db = exports._make_db(_db, lib);
        nrama.session = exports._make_session(_session, lib);
        nrama.persist = exports._make_persist(nrama.settings, nrama.db, nrama.session,
                                              nrama.uuid, nrama._debug);
        nrama.serializers = exports._make_serializers(nrama.settings, lib);
        nrama.sources = exports._make_sources(nrama.settings, nrama.persist, nrama._debug, lib);
        nrama.quotes = exports._make_quotes(nrama.settings, nrama.uuid, nrama.persist,
                                            nrama.sources, nrama.serializers, nrama._debug,
                                            lib);
        nrama.notes = exports._make_notes(nrama.settings, nrama.uuid, nrama.persist,
                                          nrama.sources, nrama.quotes, nrama._debug);
        nrama.ui = exports._make_ui(nrama.settings, nrama.session, nrama._debug, lib);

        /**
         * main setup:
         *  - init dependencies & nrama
         *  - load notes & quotes;
         *  - configure events (select to create quote, etc)
         */
        nrama.$(document).ready(function(){
            /**
             * nrama.settings.page_id is a value s.t. two page instances have the same page_id exactly
             *   when we want to load the same notes & quotes onto those pages.  This is really
             *   hard to compute (e.g. DOI helps but if different users see an article with
             *   different formatting, should we load the same notes & quotes?  Probably.)
             * In future this might be doi or similar
             */
            nrama.settings.page_id = window.location.protocol+"//"+window.location.host+window.location.pathname;  //the url with no ?query or #anchor details
            //remove trailing slash
            var last = nrama.settings.page_id.length-1;
            if( nrama.settings.page_id[last] === '/' ) {
                nrama.settings.page_id = nrama.settings.page_id.slice(0,last);
            }
            
            /**
             * this is the node within which notes and quotes are possible and
             * relative to which their locations are defined.
             * Might eventually be configured per-site
             */
            //nrama.settings.root_node = nrama.$('#readOverlay')[0]; 
            nrama.settings.root_node = document.body;
    
            rangy.init();
    
            nrama.$.log('nrama: starting ...');
            nrama.ui.dialogs.login_if_necessary(function(error, ignore){
                if( error ) {
                    nrama._debug({msg:'error logging in',error:error});
                } else {
                    //_.defer means wait until callstack cleared
                    _.defer(nrama.quotes.load, nrama.settings.page_id, function(error, data){
                        _.defer(nrama.notes.load, nrama.settings.page_id, nrama._debug );
                    });
                }
            });
            
            // --- configure events ---
            
            // deal with 403 Forbidden events (session expires, etc)
            nrama.$(document).bind('nrama_403', function(e, user_id){
                if( !user_id ) {
                    user_id = nrama.settings.user_id;
                }
                nrama.ui.dialogs.login(user_id, 'Please login and re-try.', nrama._debug);
            });
            
            //throttle2 is like _.throttle(fn) but this calls fn BEFORE timout
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
                //nrama.$.log("nrama2 caught mouse up");
                var selection = rangy.getSelection();
                if( selection.isCollapsed ) {
                    return;
                }
                var range = selection.getRangeAt(0);
                //check that not too much text has been selected (avoid accidental selecting loads of doc)
                if( nrama.settings.max_quote_length > 0 ) {
                    if( range.toString().length > nrama.settings.max_quote_length ){
                        nrama.$.log('nrama no quote -- ' + range.toString().length + ' characters selected.');
                        return;
                    }
                }
                var quote = nrama.quotes.create(range);
                if( quote.content !== '' ) {
                    nrama.quotes.save(quote, function(error, data){
                        //(todo -- some indicate that it has failed?
                        if( !error ) {
                            nrama.quotes.display(quote);   //display the quote only after it has been saved
                        }
                    });
                    nrama._debug((function(){ var a={}; a[quote._id]=quote; return a; })()); 
                }
            };
            nrama.$(document).bind("mouseup", throttle2(create_quote_from_selection) );
            
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
                var quote = nrama.$(this).data('nrama_quote');
                var note = nrama.notes.create(quote);
                nrama.notes.display(note);
            };
            nrama.$('._nrama-quote').live('click', throttle2(create_note_from_quote_click) );
            
            // alt- or meta-click a quote to delete it (after checking there are no linked notes)
            nrama.$('._nrama-quote').live('click', function(e){
                if( e.altKey || e.metaKey ) {
                    var quote = nrama.$(this).data('nrama_quote');
                    var note_ids = nrama.notes.find(quote);
                    if( note_ids.length !== 0 ) {
                        //don't delete quotes with notes attached ...
                        var $quote_nodes = nrama.$('.'+quote._id);
                        $quote_nodes.css({'border-top':'1px dashed red',
                                         'border-bottom':'1px dashed red'});
                        //... instead make the relevant notes bounce
                        var idstr = '#' + note_ids.join(', #');
                        nrama.$(idstr).effect('bounce', function(){
                            $quote_nodes.css({'border-top':'none',
                                             'border-bottom':'none'},500);
                        });
                        return;
                    }
                    nrama.quotes.remove(quote);
                }
            });
        
            //click on a note to enable editing, bring it to the front and flash the associated quote
            nrama.$('._nrama-note textarea').live('click',function(e){
                var $textarea = nrama.$(this);
                var $note = nrama.$(this).parents('._nrama-note').first();
                nrama.notes.bring_to_front($note);
                var note= $note.data('nrama_note');
                nrama.quotes.flash(note.quote_id);
            });
            
            //tabbing out of a note doesn't move to next note (because weird).
            //thank you http://stackoverflow.com/questions/1314450/jquery-how-to-capture-the-tab-keypress-within-a-textbox
            nrama.$('._nrama-note').live('keydown',function(e){
                if( e.which === 9 ) {
                    nrama.$('textarea', this).blur();
                    e.preventDefault();
                }
            });
            
            // === init done
            callback(nrama.$);
        });
    };
    
    /**
     * IT ALL STARTS HERE
     * Determine how to initialize depending on whether bookmarklet or embedded in page
     */
    if( typeof exports !== 'undefined' ) {    //exports undefined means nrama is already loaded -- bookmarklet may be called more than once)

        var use_localhost = typeof _NRAMA_LOCAL !== 'undefined' && _NRAMA_LOCAL;
        if( typeof _NRAMA_BKMRKLT === 'undefined' && typeof require !== 'undefined' ) {
            //this script is being used as a commonJS module
            //already defined exports; initialisation is handled in another module.
        } else {
            if( typeof _NRAMA_BKMRKLT === 'undefined' || !_NRAMA_BKMRKLT ) {
                //run as embedded <script>
                _nrama_init(exports, use_localhost, jQuery, function(){
                    exports._initalized = true;
                });
            } else {
                // run in bookmarklet mode
                // first remove head if we can -- for some reason this seems to help avoid clashes in FF
                var get_head = function(){ return document.getElementsByTagName('head')[0]; };
                var old_head_html = get_head().innerHTML;
                var restore_document_head = function($){
                    $(old_head_html).not('script').appendTo('head');
                }; 
                try {
                    get_head().innerHTML = '';
                } catch(ex) {
                    //alt. method -- can't set innerHTML with safari (others?)
                    var head = get_head();
                    var children = [];
                    while(head.firstChild) {
                        var child = head.firstChild;
                        if( child.nodeName !== 'SCRIPT' ) {
                            children.push( child );
                        }
                        head.removeChild( child );
                    }
                    restore_document_head = function($) {
                        $('head').append(children);
                    };
                }
     
                // load libraries & only start work after they loaded
                var lib_url = (  use_localhost ?
                                    "http://localhost:5984/nrama/_design/nrama/bkmrklt/lib.min.js"
                                :
                                    "http://note-o-rama.com/bkmrklt/lib.min.js"
                              );
                if( typeof _NRAMA_LIB_URL !== 'undefined' ) {
                    lib_url = _NRAMA_LIB_URL;
                }
                // adapted from jQuery ajaxTransport, thank you also http://stackoverflow.com/questions/756382/bookmarklet-wait-until-javascript-is-loaded
                var loadScript2 = function(url, callback) {
                    var head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;
                    var script = document.createElement( "script" );
                    //script.charset = set this?$
                    script.src = url;
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
                    head.insertBefore( script, head.firstChild );
                };
                loadScript2(lib_url, function() {
                    jQuery.noConflict();
                    _nrama_init(exports, use_localhost, jQuery, function(jQuery){
                        restore_document_head(jQuery);
                        exports._initalized = true;
                    });
                });
            }
        }
    }
// if exports is not defined, or if _NRAMA_BKMRKLT exists, attach everything to this.nrama
//     but if nrama is already defined, do nothing (send undefined)
// otherwise behave as a commonJS module
})(
    ( typeof exports !== 'undefined' && typeof _NRAMA_BKMRKLT === 'undefined' ) ?
        exports
    :(
        ( typeof nrama === 'undefined' || !nrama._initalized ) ?
            nrama={}
        :
            undefined   //prevent execution if nrama already defined
    )
);   