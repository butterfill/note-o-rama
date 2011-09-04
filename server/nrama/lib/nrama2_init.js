/**
 * Call this (not nrama2) to load the functions.
 * NB can only be called client side!
 * 
 */
var db = require('kanso/db'),
    session = require('kanso/session'),
    _ = require('./underscore')._,
    BibtexParser = require('./bibtex').BibtexParser,      //nb this is more uptodate than that incl. with kanso 0.0.7
    b64_hmac_md5 = require('./md5').b64_hmac_md5,
    uuid_sync = require('./uuid');
    nrama_constructors = require('./nrama2');


var _init = function(){
    if( typeof window === 'undefined' || typeof document === 'undefine' ) {
        throw new Error("nrama.init can only be run in the browser (window or document not defined)");
    }
    nrama = {};
    nrama.uuid = function (){
        return  'N'+uuid_sync().replace(/-/g,'');
    };
    nrama.settings = {
        // -- internals
        is_embedded : false,     //set to false when being used on the server
        debug : true,
        // -- quotes & note settings
        note_default_text : 'type now',
        note_background_color : 'rgb(255,255,255)', 
        persist_started_color : '#FFBF00',  //#FFBF00=orange
        note_width : 150, //pixels
        // -- styling
        note_style : {},
        note_inner_style : {},
        note_editor_style : {}
    };
    nrama._debug = nrama_constructors._make_debug(nrama.settings, window);
    nrama.log = nrama_constructors._make_logging(nrama.settings, $);
    nrama.db = db;
    nrama.session = session;
    nrama.persist = nrama_constructors._make_persist(nrama.db, nrama.session, nrama.uuid, nrama._debug);
    nrama.sources = nrama_constructors._make_sources(nrama.persist, nrama._debug);
    nrama.finder = {};  //can't define until page has loaded
    nrama.notes = nrama_constructors._make_notes(nrama.settings, nrama.uuid, nrama.persist,
                                                 nrama.sources, null/*quotes*/, nrama.finder);
    
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