/**
 * Note-o-rama firefox extension
 * So far this is only working in 'implant' mode
 * And there is no way of setting the user_id yet (it's currently hard-coded as ffext).
 */
var Cc = require("chrome").Cc;
var Ci = require("chrome").Ci;

const widgets = require("widget");
var tabs = require("tabs");
var pageMod = require("page-mod");
var self = require("self");
var data = self.data;
var privateBrowsing = require("private-browsing");
var panel = require("panel");
var storage = require('simple-storage').storage;
 
exports.main = function(options, callbacks) {
  
  //will be attached to onClick / onCommand
  var on_nrama_btn = function(){
    
    //don't do anything in private browsing
    if (privateBrowsing.isActive) {
      panel.Panel({
        contentURL: data.url("no_load.html")
      }).show();
      return;
    }
    
    //check username is set
    if( storage.nramaUser ) {
      inject_nrama();
    } else{
      //user must set nrama user name
      get_user_name = panel.Panel({
        width : 650,
        height: 400,
        contentURL: data.url("user_name.html"),
        contentScriptFile : data.url("user_name.js"),
        onHide : function(){
          console.log('storage.nramaUser '+storage.nramaUser);
          if( storage.nramaUser ) {
            inject_nrama();
          }
        }
      });
      get_user_name.port.on('set_user', function(username){
        console.log('nrama setting user to '+username);
        storage.nramaUser = username;
      });
      get_user_name.show();
      get_user_name.port.emit('init', {username:storage.nramaUser})
    }

    /*
    //prompt from http://gitorious.org/addon-sdk/bugzilla-triage-scripts/blobs/master/lib/prompts.js
    var stringValue = { value : "" };
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Ci.nsIPromptService);
    var result = prompts.prompt(null, 'Note-o-rama', 'Please enter your user name',
        stringValue, null, {});
    if (result) {
      storage.nramaUser = stringValue.value;
    }
    */
    
  };
  
  var inject_nrama = function(){
    // inject nrama 
    var implant = tabs.activeTab.attach({
      contentScriptFile : [
        // the less good way of doing it -- merely implant scripts
        data.url('nrama2_firefox_implant.js')
      ]
    });
    //pass some data to the implanted script
    implant.port.emit('nrama_implant', {
      lib : data.url('lib.js'),
      nrama2 : data.url('nrama2.js'),
      user : storage.nramaUser || '[unspecified]'
    });
  };
  
  
  //var sandbox_nrama = function(){
  //  var implant = tabs.activeTab.attach({
  //    contentScriptFile : [
  //      // attempts to use a context script failed
  //      /*
  //       // -- FIRST TRY, NO RPC
  //       // to get xdm xhr we'd need to move the xhr code to the extension
  //       // and use the jetpack request api but (a) this means FF-specific code
  //       // & it only supports get & post
  //      */
  //      data.url('lib.extension.js'),
  //      data.url('rangy-core-test.js'),
  //      data.url('rangy-cssclassapplier.js'),
  //      data.url('rangy-serializer.js'),
  //      data.url('nrama2_firefox_config.js'),
  //      data.url('db.ex-kanso.js'),
  //      data.url('session.ex-kanso.js'),
  //      data.url('nrama2.js')
  //
  //      /*
  //       // -- SECOND TRY, USER RPC
  //       //   BUT FAILS ?BECAUSE? LIKE CHROME, IFRAMES are not
  //       //   straightforward in context scripts
  //      data.url('lib.js'),
  //      data.url('rangy-core-test.js'),
  //      data.url('rangy-cssclassapplier.js'),
  //      data.url('rangy-serializer.js'),
  //      data.url('nrama2_firefox_config.js'),
  //      data.url('nrama2.js')
  //      */
  //    ]
  //  });
  //};
  
  

  
  // create toolbarbutton
  var tbb = require("toolbarbutton").ToolbarButton({
    id: "com.note-o-rama.nrama-btn",
    label: "Note-o-rama",
    image : data.url('nrama_logo_16x16.gif'),
    onCommand: on_nrama_btn
  });
  tbb.moveTo({
    toolbarID: "nav-bar",
    forceMove: false // only move from palette
  });

/*  
  //addons bar icon
  var widget = widgets.Widget({
    id: "nrama",
    label: "Note-o-rama",
    contentURL: data.url('nrama_logo_32x32.png'),
    onClick: on_nrama_btn
  });
*/

  console.log('nrama: addon started ...');
};

exports.onUnload = function (reason) {
  console.log('nrama extension unloaded: '+reason);
};




