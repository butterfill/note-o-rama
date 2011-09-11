/**
 * implant nrama2 into page by adding scripts to header
 * (breaks content script isolation, which would be better, but can't make that work yet)
 */

// nrama2.js settings


// adapted from jQuery ajaxTransport, thank you also http://stackoverflow.com/questions/756382/bookmarklet-wait-until-javascript-is-loaded
var loadScript2 = function(props, callback) {
    var head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;
    var script = document.createElement( "script" );
    //script.charset = set this?$
    if( props.url ) {
        script.src = props.url;
    }
    if( props.innerHTML ) {
        script.innerHTML = props.innerHTML
    }
    script.onload = function(){
        if( props.url ) {
            console.log('nrama implanted '+props.url);
        }
        callback( 200, "success" );
    };
    head.appendChild( script);
};


/*
self.port.on('nrama_implant', function(urls){
    console.log('nrama user: '+urls.user);
    loadScript2({url:urls.lib}, function(){
        //config
        var setup_script = "self._NRAMA_BKMRKLT = false;self._NRAMA_USER = '"+urls.user+"';";  
        loadScript2({innerHTML:setup_script});
        //nrama
        loadScript2({url:urls.nrama2}, function(){
            console.log('nrama: all loaded ...');
        });
    });
});
*/

self.port.on('nrama_implant', function(urls){
    console.log('nrama user: '+urls.user);
    //config : load as bkmrklt but get libs from resource:// rather than remote
    var setup_script = "self._NRAMA_BKMRKLT=true;self._NRAMA_USER = '"+urls.user+"';_NRAMA_LIB_URL='"+urls.lib+"'";  
    loadScript2({innerHTML:setup_script});
    //nrama
    loadScript2({url:urls.nrama2}, function(){
        console.log('nrama: all loaded ...');
    });
});

