/**
 * Note-o-rama firefox extension
 * So far this is only working in 'implant' mode
 * And there is no way of setting the user_id yet (it's currently hard-coded as ffext).
 */

const widgets = require("widget");
var tabs = require("tabs");
var pageMod = require("page-mod");
var self = require("self");
var data = self.data;


//addons bar icon
var widget = widgets.Widget({
  id: "nrama",
  label: "Note-o-rama",
  contentURL: data.url('nrama_logo_32x32.png'),
  onClick: function() {
    var implant = tabs.activeTab.attach({
      contentScriptFile : [
              // attempts to use a context script failed
              /*
               // -- FIRST TRY, NO RPC
               // to get xdm xhr we'd need to move the xhr code to the extension
               // and use the jetpack request api but (a) this means FF-specific code
               // & it only supports get & post
              data.url('lib.extension.js'),
              data.url('rangy-core-test.js'),
              data.url('rangy-cssclassapplier.js'),
              data.url('rangy-serializer.js'),
              data.url('nrama2_firefox_config.js'),
              data.url('db.ex-kanso.js'),
              data.url('session.ex-kanso.js'),
              data.url('nrama2.js')
              */
              
              /*
               // -- SECOND TRY, RPC
               //   LIKE CHROME, IFRAMES are not straightforward in context scripts
              data.url('lib.js'),
              data.url('rangy-core-test.js'),
              data.url('rangy-cssclassapplier.js'),
              data.url('rangy-serializer.js'),
              data.url('nrama2_firefox_config.js'),
              data.url('nrama2.js')
              */
              
              // the less good way of doing it -- merely implant scripts
              data.url('nrama2_firefox_implant.js')
      ]
    });
    implant.port.emit('nrama_implant', {
      lib : data.url('lib.js'),
      nrama2 : data.url('nrama2.js')
    });
  }
});

console.log('nrama: addon started ...');
