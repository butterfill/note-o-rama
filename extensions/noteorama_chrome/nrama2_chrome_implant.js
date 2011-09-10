/**
 * implant nrama2 into page by adding scripts to header
 * (chrome.tabs.executeScript would be better but doesn't seem to work for me)
 */

// nrama2.js settings
_NRAMA_BKMRKLT = false;

var implant_script = function(src, callback) {
    var head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;
    var script = document.createElement( "script" );
    script.src = src;
    head.insertBefore( script, head.firstChild );
}
implant_script('chrome-extension://dahignbbjenhloljgiobkmdhiodpdlmd/lib.min.js');
implant_script('chrome-extension://dahignbbjenhloljgiobkmdhiodpdlmd/nrama2.js');

