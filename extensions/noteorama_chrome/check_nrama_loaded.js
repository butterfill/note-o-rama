/**
 * content script, reports back to extension on whether nrama already
 * loaded
 */

var reply;
if( typeof nrama_is_loaded === 'undefined' ) {
    //just being asked the question will cause us to say 'yes' in future
    // (the assumption is that the load will work ... better than re-loading)
    nrama_is_loaded = true;
    reply = ( typeof nrama !== 'undefined' );
} else {
    reply = nrama_is_loaded;
}

if( typeof nrama_is_loaded_listner === 'undefined' ) {
    nrama_is_loaded_listner = true;
    chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request.what == "is_nrama_loaded") {
          console.log('nrama replying to request nrama_is_loaded: '+reply);
          sendResponse({nrama_is_loaded: reply});
        }
        else {
          sendResponse({}); // not our message
        }
    });    
}

