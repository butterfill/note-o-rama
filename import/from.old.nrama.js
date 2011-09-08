var sys = require('sys'),
     pg = require('pg'),
     cradle = require('cradle'),
     async = require('async'),
     md5 = require('./md5'),
     repl = require('repl');
var _ = require('./underscore');
_.mixin(require('underscore.string'));

console.log('starting ...');


// -- debug

_u = _
d = {msg:'holds your data', past: []};
make_cb = function(my, log) {
  return function(error, data){
    if( error ) {
      console.log( 'error: '+sys.inspect(error) );
    } else {
      my.data=data;
      my.past.push(data);
      if( log ) {
        log( 'success: '+sys.inspect(data) );
      } else {
        console.log('success');
      }
    }
  };
}
cb = make_cb(d);


// -- convert methods

var Converter = function() {
  
  var fixdate = function(object) {
    if( object.created ) {
      object.created = new Date(object.created).getTime();
    }
    if( object.updated ) {
      object.updated = new Date(object.updated).getTime();
    }
    if( !object.updated ) {
      object.updated = object.created;
    }
  };
  
  var _rename = function(object, renames){
    _.map(renames, function(old_name, new_name){
      object[new_name] = object[old_name];
      delete object[old_name];
    });
  };
  /**
   * convert list of nrama1 author_source+author objects
   *   to list of nrama2 simple author names (last, first).
   */
  workers = {
    user : function(user) {
      //TODO !
    },
    
    source : function(source, users, authors) {
      var calculate_id = function(o) {
        return 'source_'+md5.b64_hmac_md5(o.user_id, o.page_id);
      };
      var extract_authors = function(authors) {
        var res = [];
        _.each(authors, function(author) {
          res.push(author.last_name + ', ' + author.first_name);
        });
        return res;
      }
      source.AUTHOR = extract_authors(authors[source.id]);
      //note that we append a cheat below : necessary to keep sources apart
      //  (but means no new notes can be added from the page to the same source
      //     -- would ideally work out where it's necessary to do this!)
      source.page_id = (source.do_i || source.url) + '?cheat='+source.id;
      source.user_id = users[source.owner_id].user_name;
      _rename(source, {
        page_title : 'web_title',
        TITLE : 'publication_title',
        YEAR : 'date',
        PAGES : 'pages',
        VOLUME : 'volume',
        ISSUE : 'issue',
        DOI : 'do_i'
      });
      source._id = calculate_id(source);
    },
    
    quote : function(quote, users, sources) {
      var calculate_hash = function(quote) {
        var hash = md5.b64_hmac_md5(quote.page_id, quote.content);
        return hash;
      };
      quote._id = 'q_'+quote.uuid.replace(/-/g,'')+'K';
      quote.user_id =  users[quote.owner_id].user_name;
      var source = sources[quote.source_id];
      quote.source_id_v1 = quote.source_id;
      quote.source_id = source._id;
      quote.page_id = source.page_id;
      if( !source ) {
        console.log('missing source for quote '+quote);
      }
      quote.url = source.url;
      quote.page_title = source.page_title;
      quote.hash = calculate_hash(quote);
      quote.parent_quote_id = undefined;
    },
    
    note : function(note, users, sources, quotes, tags) {
      note._id = 'n_'+note.uuid.replace(/-/g,'')+'K';
      note.user_id =  users[note.owner_id].user_name;
      var quote = quotes[note.quote_id];
      if( !quote ) {
        console.log('missing quote for note '+note.text);
      } else {
        note.quote_hash = quote.hash;
        note.page_id = quote.page_id;
        //tags in several steps
        note.tags = [];
        // first check content of note
        if( _(note.text).startsWith('t:') ) {
          var content_tags = _.words(note.text).splice(1);
          _.each(content_tags, function(tag){
            note.tags.push(tag);
          })
          note.text = '#'+note.tags.join(' #');
        }
        //now check the tags records
        _.each( tags[note.quote_id] , function(tag){
          note.tags.push(tag);
          note.text+=' #'+tag;
        });
        //finally, make sure tags are unique
        note.tags = _.union(note.tags);
        if( note.tags.length > 0 ) {
          console.log( '#'+note.tags.join(' #') + ' <<>> ' + note.text);
        }
        //(end tags)
        note.quote_id_v1 = note.quote_id;
        note.quote_id = quote._id;  //do this last because using the old id!
      }
      var source = sources[note.source_id];
      if( source ) {
        note.source_id = source._id;
        note.page_id = source.page_id;
      }
      _rename(note,{
        content : 'text',
        left : 'x',
        top : 'y'
      });
      note.parent_sticky_id = undefined;
      note.sticky_id=undefined;
      note.server_version=undefined;
    }
  };

  return function(thing){
    //var args = Array.prototype.slice.call(arguments);
    workers[thing.type].apply(null, arguments);
    _rename( thing, {id_v1:'id'});
    fixdate(thing);
    thing.nrama_version = 1.0;
  };
};

convert = new Converter();


// -- input : get from postgres

connectionString = "postgres://steve:hope@localhost/nrama_old";

/**
 * @returns a pg connection (call end() on it after use)
 */
get_client = function(){
  var c = new pg.Client(connectionString);
  c.connect();
  return c;
}

/**
 * collect all rows from a single table (fine for users, sources, ...)
 */
get_thing = function( table_name, nrama_name/*optional*/, callback ) {
  if( !callback ) {
    callback = nrama_name;
    nrama_name = table_name;
  }
  console.log('\n=============\n\t'+table_name+'\n-------------')
  var client = get_client();
  var thing_q = client.query("SELECT * FROM "+table_name);
  var things = {};
  thing_q.on('row', function(row){
    things[row.id] = row;
    things[row.id].type = nrama_name;
  });
  thing_q.on('end', function(){
    client.end();
    callback(null, things);
  })
}

/**
 * getting authors requires joins
 */
get_authors = function(callback) {
  var authors = {}; //keys are source ids, values are lists of authors
  var client = get_client();
  q = client.query("select * from source_author,author where author.id=source_author.author_id order by creator_order");
  q.on('row', function(row){
    authors[row.source_id] = (authors[row.source_id] || []);
    authors[row.source_id].push(row);
  });
  q.on('end', function(){
    client.end();
    callback(null, authors);
  })
  
}

get_tags = function(callback) {
  var tags = {};  //keys are quote ids, values are lists of tags
  var client = get_client();
  q = client.query("select * from tag,quote_tag where quote_tag.tag_id = tag.id");
  q.on('row', function(row){
    tags[row.quote_id] = (tags[row.quote_id] || []);
    tags[row.quote_id].push(row.label);
  });
  q.on('end', function(){
    client.end();
    callback(null, tags);
  });
}

// -- output : push to couchdb

var couch_connection = new(cradle.Connection)('127.0.0.1', 5984, {
  auth: { username: 'steve', password: 'newstar' }
});
var couchdb = couch_connection.database('nrama');




// -- tie it all together

//stores objects as we fetch them
all = {};

/**
 * do_sources will (a) get sources from database, attach authors, users & calculate _id,
 * then (b) upload them all to couchdb
 */
do_sources = function(main_callback){
  async.parallel(
    [
      function(callback) {
        get_thing('tg_user', 'user', function(error, users){
          all.users = users;
          callback();
        });
      },
      function(callback) {
        get_thing('source', function(error, sources){
          all.sources = sources;
          callback();
        });
      },
      function(callback) {
        get_authors(function(error, authors){
          all.authors = authors;
          callback();
        });
      }
    ],
    // this happens after all of the above are complete
    // (a) convert sources; (b) save to couch-db
    function(){
      console.log('phew!');
      _.map(all.sources, function(source, id){
        convert(source, all.users, all.authors);
      });
      console.log('got '+ _.toArray(all.sources).length+' sources');
      main_callback(null, all.sources);
    }
  );
}

save_sources = function(callback) {
  sources_array = _.toArray(all.sources);
  console.log('saving '+sources_array.length+' sources ...');
  couchdb.save( sources_array, function(){
    console.log('... saved');
    callback(null, 'done');
  });
}

/**
 * do_quotes will get and store quotes
 */
do_quotes = function(main_callback) {
  get_thing('quote', function(error, quotes){
    all.quotes = quotes;
    _.map(quotes, function(quote, id){
      convert(quote, all.users, all.sources);
    });
    var quote_array = _.toArray(quotes);
    console.log('have '+quote_array.length+' quotes');
    quote_array = _.select(quote_array, function(quote){
      return quote.content != '';
    });
    console.log('have '+quote_array.length+' quotes with content');
    all.quote_array = quote_array;
    main_callback(null,quotes);
  });
}

save_quotes = function(callback) {
  couchdb.save( all.quote_array, function() {
    console.log('saved '+all.quote_array.length+' quotes');
    callback(null, 'done');
  });
};

do_tags = function(callback) {
  get_tags(function(error, tags){
    all.tags = tags;
    callback( null, tags );
  });
};


do_notes = function(main_callback) {
  get_thing('sticky', 'note', function(error, notes){
    all.notes = notes;
    _.map(notes, function(note,id ){
      convert(note, all.users, all.sources, all.quotes, all.tags);
    });
    var note_array = _.toArray(notes);
    console.log('have '+note_array.length+' notes');
    note_array = _.select(note_array, function(note){
      var content = _.trim(note.content);
      return ( content != '' && content != 'h:' );
    });
    console.log('have '+note_array.length+' notes with content');
    all.note_array = note_array;
    main_callback(null, notes);
  });
}

save_notes = function(callback){
  couchdb.save( all.note_array, function() {
    console.log('saved '+all.note_array.length+' notes');
    callback(null, 'done');
  });
};

get_everything = function(callback) {
  async.series([
    do_sources,
    do_quotes,
    do_tags,
    do_notes,
  ],
    function(){
      console.log('got everything');
      callback(null, 'got everything'); }
  );
}


save_everything = function(callback) {
  async.series([
    save_sources,
    save_quotes,
    save_notes
  ],
    function(){
      console.log('the end');
      callback(null, 'all done'); }
  );
}


repl.start();
