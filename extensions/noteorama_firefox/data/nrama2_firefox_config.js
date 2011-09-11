/**
 * content script to configure nrama for chrome extension
 * This is run after libraries loaded and before nrama2.js is loaded
 */

self._NRAMA_USER = 'ffext2';  //TODO REMOVE!!!
self._NRAMA_BKMRKLT = false; //don't load the libraries first
self._NRAMA_NO_RPC =true;   //use RPC within FF (xdm xhr not straightforward, unlike chrome)
self.settings = {
    name : 'nrama',         
    baseURL : 'http://noteorama.com'    
}
