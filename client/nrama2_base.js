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
    easyXDM_cors_url : 'http://127.0.0.1:5984/easy_xdm/cors/cors.html',
    //server_url : 'http://127.0.0.1:8080/test',
    //server_url : 'http://noteorama.iriscouch.com/',
    user_id : nrama.uuid(),
    tags : '',  //space delimited string of tags
    background_color : '#FCF6CF',
    debug : true,
    note_width : 150, //pixels
    note_height : 150, //pixels
    note_default_text : 'type now',
    note_style : {
        'background-color' : '#FCF6CF',
        "border":"1px solid",
        "border-color":"#CDC0B0",
        "padding":"3px",
        'cursor':'move',
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
        "z-index":"9999",
        'background-color' : 'inherit'
    }
};
nrama.options.note_style["width"] = nrama.options.note_width+"px";
//nrama.options.note_style["height"] = nrama.options.note_height+"px";
nrama.options.note_editor_style['width'] = nrama.options.note_width+"px";
//nrama.options.note_editor_style['height'] = nrama.options.note_height+"px";




if( nrama.options.debug ) {
    //object contains stuff for debugging
    d = {};
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
     *        e.g. localhost:5984/easy_xdm/cors/cors.html
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
     */
    ajax : function ajax( params ){
        nrama.persist.rpc.request({
            url : params.url,
            data : params.data || {},
            method : params.method || params.type,
            headers : params.headers || {}
            },
            params.success,
            params.error
        );
    },
    
    /**
     * updates the value of nrama._internal.is_connected
     */
    is_connected : function is_connected() {
        var on_error = function(res){
            nrama._internal.is_connected = false;
            $.log("is_connected error"); 
            if( nrama.options.debug) {
                d.res=res;
            }
        }
        var on_success = function(res){
            nrama._internal.is_connected = true;
            $.log("is_connected success");
            if( nrama.options.debug) {
                d.res=res;
            }
        }
        nrama.persist.ajax({
                            url : nrama.options.server_url,
                            data : {},
                            method : "GET",
                            success : on_success,
                            error : on_error
            });
    },
    
    save_quote : function save_quote(quote, on_success, on_error) {
        $.log('nrama save quote ' + quote.uuid+' started');
        var url = nrama.options.server_url;
        url += 'nrama/';
        url += quote.uuid;
        nrama.persist.ajax({
                            url : url,
                            data : quote,
                            method : "PUT",
                            success : on_success,
                            error : on_error
        })
    },
    /**
     * deletes a quote from the server
     */
    delete_quote : function delete_quote(uuid, on_success, on_error) {
        // *** TODO ***
        on_success();
    },
    
    save_note : function save_note(note, on_success, on_error) {
        //***TODO***
        on_success();
    },
    /**
     * deletes a note from the server
     */
    delete_note : function delete_note(uuid, on_success, on_error) {
        // *** TODO ***
        on_success();
    },
    
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
            user_id : nrama.options.user_id,
            deleted : false
        }
    },
    
    /**
     * request quote delete from server and remove from page if successful
     */
    remove : function remove(quote) {
        $('.'+quote.uuid).css('background-color','orange');
        nrama.persist.delete_quote(quote.uuid, function(){
            $.log("nrama deleted quote "+quote.uuid);
            nrama.unhighlight(quote);
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
    offset : function offset(quote) {
        return $('.'+quote.uuid).first().offset();
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
     * create a new note node for the user to add text
     * (no note is actually created until the text has been entered).
     * param quote is the quote on which this is a note; this quote must be on the page
     *   (so that position for the note can be calculated).
     */
    create_edit_note : function create_edit_note(quote) {
        var note_uuid = '_dummy_'+nrama.uuid();
        $.log('nrama create_edit_note uuid:'+note_uuid);
        var viewport_width = $(window).width();
        var hpos = viewport_width - nrama.options.note_width - 15;
        hpos -= Math.floor(Math.random()*30);
        var vpos = nrama.quotes.offset(quote).top;
        vpos += Math.floor(Math.random()*30);
        var pos_attrs = {"position":"absolute", "left":hpos+"px", "top":vpos+"px"};
        var textarea = $('<textarea></textarea>').
                            val(nrama.options.note_default_text).
                            css(nrama.options.note_editor_style).
                            autogrow();
        var inner_div = $('<div></div>').css(nrama.options.note_inner_style).
                            append(textarea);
        var edit_note = $('<div></div').attr('id',note_uuid).
                            addClass('_nrama-note').
                            css(pos_attrs).css(nrama.options.note_style).
                            css('z-index',nrama._internal.zindex_counter++).
                            data('nrama_quote',quote).
                            data('nrama_content',nrama.options.note_default_text).
                            append(inner_div).
                            appendTo('#_nrama_notes').
                            draggable().
                            hide().show("scale",{},200, function(){
                                textarea.focus().select();
                            });
        
    },
    
    /**
     * create a new note
     */
    create : function create(edit_note_node) {
        //adjust height of note
        edit_note_node.css('height','auto');
        //$('textarea', edit_note_node).css('height','auto');
        //check whether anything has changed
        var old_content = edit_note_node.data('nrama_content');
        var $textarea = $('textarea', edit_note_node);
        var new_content = $textarea.val();
        if( old_content == new_content ) {
            $.log("nrama.notes.create -- note unchanged");
            return null;
        }
        var old_uuid = edit_note_node.attr('id');
        if( new_content == '' ) {
            $.log("nrama.notes.create -- deleting note "+old_uuid);
            nrama.notes.remove(edit_note_node);
            return null;
        }
        $.log("nrama.notes.create --"+old_content+" to "+new_content);
        var quote = edit_note_node.data('nrama_quote');
        var new_uuid = nrama.uuid();
        //we won't bother waiting until the server has actually deleted the note:
        // in the worst case the delete will fail
        nrama.persist.delete_note(old_uuid, function(){
            $.log("deleted note "+old_uuid+" from server.");
        });
        var note = {
            uuid : new_uuid,
            type : 'note',
            replaces_note : old_uuid,   //this may not be valid (initial uuid is garbage)
            content : new_content,
            quote_uuid : quote.uuid,
            background_color : edit_note_node.css('background-color'),
            height : edit_note_node.height(),
            width : edit_note_node.width(),
            left : edit_note_node.offset().left,
            top : edit_note_node.offset().top,
            doc_height : $(document).height(),
            doc_width : $(document).width(),
            created : new Date().getTime(),
            user_id : nrama.options.user_id,
            deleted : false
        };
        if(nrama.options.debug){
            d.note=note;
        }
        nrama.persist.save_note(note, function(){
            $.log("nrama created note uuid:"+new_uuid+" for quote:"+quote.uuid);
            edit_note_node.data('nrama_content',new_content).
                attr('id',new_uuid);
        });

        return null;
    },
    
    /**
     * request delete from server & remove from document if succeeds
     */
    remove : function remove(edit_note_node) {
        var note_uuid = edit_note_node.attr('id');
        edit_note_node.css('background-color','red');
        nrama.persist.delete_note(note_uuid, function(){
            $.log("deleted note "+note_uuid+" from server.");
            edit_note_node.hide('puff',{},2000, function(){
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
            var rel_quote_uuid = $(this).data('nrama_quote').uuid;
            if( rel_quote_uuid == quote.uuid ) {
                //add uuid of the note to the list
                uuids.push($(this).attr('id'));
            }
        });
        return uuids;
    }
    
    
}

/**
 * highlight a quote on the page (may fail silently).
 * if successful, this will also store the quote object on all the highlights.
 */
nrama.highlight = function highlight(quote) {
    var range = nrama.quotes.get_range(quote);
    if( range == null ) {
        $.log("nrama failed to recover range for quote "+quote.uuid);
        return null;
    }
    var _rangy_highlighter = rangy.createCssClassApplier("_nrama-quote "+quote.uuid,false);
    _rangy_highlighter.applyToRange(range);
    $('.'+quote.uuid).css('background-color',quote.background_color).data('nrama_quote',quote);
    return null;
};

/**
 * todo -- this would ideally remove the elements so that next load works ok.
 */
nrama.unhighlight = function unhighlight(quote){
    $('.'+quote.uuid).
        removeClass('nrama_quote').
        removeClass(quote.uuid).
        css('background-color','red').
        animate({'background-color':'black'}, function(){
            $(this).css('background-color','inherit');
        });
;
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
        $.log("nrama2 caught mouse up");
        var selection = rangy.getSelection();
        if( selection.isCollapsed ) {
            return;
        }
        var range = selection.getRangeAt(0);
        var quote = nrama.quotes.create(range);
        //TODO -- make highlight conditional on save
        nrama.persist.save_quote(quote);
        $.log("new quote uuid:"+quote.uuid);
        $.log("selection serialized:" + quote.xptr );
        $.log("selection text:" + quote.content);
        nrama.highlight(quote);
        $.log("nrama2 finished mouse up");
        if( nrama.options.debug ) {
            d.range = range;
        }
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
        $.log("nrama caught click on quote");
        $.log('nrama class of $(this):'+$(this).attr('class'));
        if (nrama.options.debug) {
            d._this = this;
        }
        if( !$(this).hasClass('_nrama-quote')) {
            throw "nrama false assumtion -- add code to find the quote"
        }
        var quote = $(this).data('nrama_quote'); //TODO!
        nrama.notes.create_edit_note(quote);
    });
    
    /**
     * alt- or meta-click a quote to delete it
     * TODO : check there are no linked notes!
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
        nrama.notes.create(edit_note_node);
    });
    
    /**
     * click on a note to bring it to the front and highlight the
     * associated quote
     */
    $('._nrama-note').live('click',function(e){
        $(this).css('z-index',nrama._internal.zindex_counter++);
        var quote = $(this).data('nrama_quote');
        var $quote_nodes = $('.'+quote.uuid);
        $quote_nodes.css({'border-top':'1px dashed black',
                         'border-bottom':'1px dashed black'}).
                    css({'border-top':'#FFF',
                         'border-bottom':'red'});
        /*
        window.setTimeout(function(){
            $quote_nodes.css({'border-top':0, 'border-bottom':0});            
        },600);
        */          
        
    });
    
});
