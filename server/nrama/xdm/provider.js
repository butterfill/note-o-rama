/**
 * How to make couchdb work with easyXDM's rpc.
 * 
 * we'll have to do some wrapping to make easyXDM play nicely:
 * 
 *  1. when easyXDM executes the remote calls it calls the methods defined here
 *  with TWO callbacks, success and error.  This messes up how db.nrama.js &
 *  session.nrama.js handle the optional parameters (which is a weakness). See
 *  line 2758 in easyXDM.debug.js
 *
 *  2. easyXDM wraps callbacks in such a way that only the first parameter
 *  is passed up to the original callback (line 2728 in easyXDM.debug.js).
 *
 *  To around these points, we wrap the methods so as to (i) delete the final
 *  argument with which they are called, and (ii) invoke the callback with
 *  parameters as an array.  This (ii) requires complementary wrapping at the
 *  other end (the consumer).
 */
var _array_wrap = function(fn) {
    return function(){
        var args = Array.prototype.slice.call(arguments);
        fn(args);
    }
}
var _wrap = function(fn) {
    return {
        method : function(){
            var wrapped_arguments = [];
            $.each(arguments, function(idx, arg){
                if( typeof arg === "function" ) {
                    wrapped_arguments.push( _array_wrap(arg) );
                } else {
                    wrapped_arguments.push(arg);
                }
            });
            // remove the last argument -- it's a callback (evily inserted by easyXDM to confuse us)
            var len = wrapped_arguments.length;
            wrapped_arguments.splice(len-1,1);
            fn.apply(this,wrapped_arguments);
        }
    }
}
var local = {
    test : {
        method : function(object, on_success, on_error) {
            return on_success(object);
        }
    },
    db_saveDoc : _wrap( db.saveDoc ),
    db_removeDoc : _wrap( db.removeDoc ),
    db_getView : _wrap( db.getView ),
    db_doUpdate : _wrap( db.doUpdate ),
    session_login: _wrap( session.login ),
    session_logout : _wrap( session.logout ),
    session_info : _wrap( session.info )
};
/*
  // shortcut for testing
$.each(db, function(key, method){
  if( typeof(method)==="function") {
      console.log('db_'+key);
      expose['db_'+key] = method_array_wrap(method);
  }
});
$.each(session, function(key, method){
  if( typeof(method)==="function") {
      console.log('session_'+key);
      expose['session_'+key] = method_array_wrap(method);
  }
});
*/
//stubs for remote methods
var remote = {
    get_version : {},
    msg : {},
    modal : {}
};
var onReady = function(){
    //test1
    /*
    _rpc.get_version(function(version){
        _rpc.msg('hello from remote to nrama client version '+version);
    });
    */
    
    //test2
    /*
    _rpc.get_version( function(version){
        _rpc.modal(make_modal_str(version));
    });
    */
};
var _rpc = new easyXDM.Rpc({ onReady:onReady }, {local:local, remote:remote} );

/**
 * This is how to do the same for jquery.couch.db instead
 * Note that callbacks cannot be wrapped in objects when passed as parameters
 * 
var $db = $.couch.db('nrama');  // <-- your db name goes here
var expose = {
    test : {
        method : function(on_success, on_error, object) {
            return on_success('that worked!', object);
        }
    },
    $login : {
        method : function(name, password, success, error) {
            $.couch.login({
                name:name,
                password:password,
                success:success,
                error:error
            });
        }
    },
    $logout : {
        method : function(success, error) {
            $.couch.logout({success:success, error:error});
        }
    },
    $session : {
        method : function(success,error) {
            $.couch.session({success:success, error:error});
        }
    },
    $saveDoc : {
        method : function(doc, success, error) {
            $db.saveDoc(doc, {success:success, error:error});
        }
    }
    // etc
};
 */


/**
 * this is for testing modal --- can be diplayed on the client
 *
var make_modal_str = function(version) {
    var $modal = $('<div><h2>Update Needed</h2></div>');
    $modal.append('<form id="info_form">' +
            '<div class="info">' +
                '<p>Please update your bookmarklet, this version ('+version+') is no longer supported</p>' +
                '<p><a href="http://www.note-o-rama.com">get the new version</a></p>' +
            '</div>' +
            '<div class="actions">' +
                '<input type="button" id="id_ok" value="OK" />' +
            '</div>' +
        '</form>');
    modal_str=$modal.html();
    return modal_str;
}
*/

fn = function(){
    $.each(arguments, function(idx, arg){
        console.log(arg);
    });
}