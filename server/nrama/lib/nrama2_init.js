/**
 * Call this (not nrama2) to load the functions.
 * NB can only be called client side!
 * 
 */
var db = require('kanso/db'),
    utils = require('kanso/utils'),
    session = require('kanso/session'),
    _ = require('./underscore')._,
    BibtexParser = require('./bibtex').BibtexParser,      //nb this is more uptodate than that incl. with kanso 0.0.7
    b64_hmac_md5 = require('./md5').b64_hmac_md5,
    uuid_sync = require('./uuid');
    nrama_constructors = require('./nrama2');

/**
 * requires global $
 */
var _init = function(){
    if( typeof window === 'undefined' || typeof document === 'undefine' ) {
        throw new Error("nrama.init can only be run in the browser (window or document not defined)");
    }
    if( typeof $ === 'undefined' ) {
        throw new Error("nrama.init requires global $ (jQuery)");
    }

    var lib = {
        '$' : $,
        '_' : _,
        BibtexParser : BibtexParser,
        b64_hmac_md5 : b64_hmac_md5
    };
    
    // temporary patch (kanso's db lacks updates)
    if( !db.doUpdate ) {
        db.doUpdate = function( doc, update_name, callback ) {
            var url = utils.getBaseURL() + '/update/' + update_name +'/' + db.encode( doc._id );
            var req = {
                type: 'PUT',
                url: url,
                data: JSON.stringify(doc),
                processData: false,
                contentType: 'application/json',
                expect_json:false               //as of couchdb 1.1.0, updates seem to defy attempts to alter headers & return text/html header.
            };
            db.request(req, callback);
        };
    }
    var nrama = {};
    nrama.uuid = nrama_constructors._make_uuid(uuid_sync);
    nrama.settings = _.extend( nrama_constructors._make_settings( nrama.uuid, false/*use_localhost*/, lib ), {
        // -- internals
        is_embedded : false,     //set to false when being used on the server
        debug : true,
        user_id : '*ERROR',
        // -- quotes & note settings
        note_style : {},
        note_inner_style : {},
        note_editor_style : {}
    });
    nrama._debug = nrama_constructors._make_debug(nrama.settings, window, lib);
    nrama.log = nrama_constructors._make_logging(nrama.settings, $);
    nrama.db = db;
    nrama.session = session;
    nrama.persist = nrama_constructors._make_persist(nrama.db, nrama.session, nrama.uuid, nrama._debug);
    nrama.sources = nrama_constructors._make_sources(nrama.settings, nrama.persist, nrama._debug, lib);
    
    nrama.notes = nrama_constructors._make_notes(nrama.settings, nrama.uuid, nrama.persist,
                                                 nrama.sources, null/*quotes*/, nrama._debug);
    
    /**
     * return urls for various things (varies depending on current url)
     */
    nrama.kanso_urls = {}
    nrama.kanso_urls.tag = function(tag, req) {
        return req.userCtx.baseURL + (req.query.user ? '/users/'+encodeURIComponent(req.query.user) : '') + '/tags/'+ tag;
    }
    
    
    return nrama;
};


exports.init = _.once(_init);