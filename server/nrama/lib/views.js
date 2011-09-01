/**
 * View functions to be exported from the design doc.
 */

/**
 * list all users
 * http://localhost:5984/nrama/_design/nrama/_view/all_user_ids
*/ 
exports.all_user_ids = {
    map : function(doc) {
        if( doc.type == 'source' && doc.updated) {
            emit(doc.user_id, doc.updated);
        }
    },
    reduce : '_stats'
};

//used by the bookmarklet client to get all quotes, then all notes.  TODO? remove tyepe?
exports.pageId_type_userId = {
    map : function(doc) {
        if( doc.page_id && doc.type ) {
            if( doc.user_id ) {
                emit([doc.page_id, doc.type, doc.user_id],doc);
            } else {
            //no user_id
            emit([doc.page_id, doc.type, null],doc);
            }
        }
    }
};


//used to display sources for a particular user
exports.userId_source = {
    map : function(doc) {
        if( doc.type && doc.type == "source" ) {
            if( doc.user_id && doc.page_id && doc.updated ) {
                emit([doc.user_id, doc.updated], null);
            }
        }
    }
};

//used to dispaly all sources
exports.source = {
    map : function(doc) {
        if( doc.type && doc.type == "source" ) {
            if( doc.updated && doc.page_id ) {
                emit([doc.updated, doc.page_id], null);
            }
        }
    }
};


//http://localhost:5984/nrama/_design/nrama/_view/pageId_userId?key=["http://en.wikipedia.org/wiki/Komodo_dragons?h=i","steve@gmail.com"]
exports.pageId_userId= {
    map : function(doc) {
            if( doc.user_id && doc.page_id ) {
                emit([doc.page_id, doc.user_id], null);
            }
        }
};

// authors!!!
exports.author_userId = {
  map : function(doc) {
    if( doc.AUTHOR && doc.user_id ) {
      var year = doc.YEAR || null;    //order is [year_unknown, 1965, 1990, 2000],  (typically reversed)
      for( idx in doc.AUTHOR ) {
        emit([doc.AUTHOR[idx], doc.user_id, year], null);
      }
    }
  }
};

exports.tag_userId = {
  map : function(doc) {
    if( doc.tags && doc.user_id ) {
      for( idx in doc.tags ) {
        var tag = doc.tags[idx];
        emit([tag, doc.user_id], null);
      }
    }
  }
};

/**
 * this is a bit wasteful in that emits the quote and the source for each tag.
 * see http://blog.couchbase.com/what%E2%80%99s-new-apache-couchdb-011-%E2%80%94-part-two-views-joins-redux-raw-collation-speed
 */
exports.tags = {
  map : function(doc) {
    if( doc.type && doc.type == 'note' ) {
      var note = doc;
      if( note.tags ) {
        if( note.user_id && note.source_id && note.quote_id && note.updated) {
          for( var idx in note.tags ) {
            var tag = note.tags[idx];
            emit([tag,note.user_id,note.updated], null);                  //include the note iteself
            emit([tag,note.user_id,note.updated], {_id:note.source_id});  //include the source
            emit([tag,note.user_id,note.updated], {_id:note.quote_id});   //include the quote
          }
        }
      }
    }
  },
  reduce : "_count"
};