/**
 * content script to configure nrama for chrome extension
 * This is run after libraries loaded and before nrama2.js is loaded
 */

_NRAMA_USER = 'ffext';  //TODO REMOVE!!!
_NRAMA_BKMRKLT = false; //don't load the libraries first
_NRAMA_NO_RPC =false;   //use RPC within FF (xdm xhr not straightforward, unlike chrome)
settings = {
    name : 'nrama',         
    baseURL : 'http://noteorama.com'    
}
