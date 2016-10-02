/**
 * content script to configure nrama for chrome extension
 * This is run after libraries loaded and before nrama2.js is loaded
 */

_NRAMA_BKMRKLT = false; //don't load the libraries first
_NRAMA_NO_RPC = true;   //don't use RPC, we will provide db and session objects before init
settings = {
    name : 'nrama',         
    baseURL : 'https://notes.butterfill.com'    
}
