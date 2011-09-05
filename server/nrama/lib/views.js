/**
 * View functions to be exported from the design doc.
 */

// === for the bookmarklet (/other) client

/**
 * to request all notes or all quotes on a particular source,
 *   either for a particular user or for all users
 * TODO : should probably skip doc.type and provide everything
 */
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



// === for the couchApp

/**
 * all users
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

/**
 * to display all sources (for all users) ordered by most recently updated
 */
exports.source = {
    map : function(doc) {
        if( doc.type && doc.type == "source" ) {
            if( doc.updated && doc.page_id ) {
                emit([doc.updated, doc.page_id], null);
            }
        }
    }
};

/**
 * to display all sources for a particular user
 */
exports.userId_source = {
    map : function(doc) {
        if( doc.type && doc.type == "source" ) {
            if( doc.user_id && doc.page_id && doc.updated ) {
                emit([doc.user_id, doc.updated], null);
            }
        }
    }
};

/**
 * to display [all users' | a user's] notes on a single source.
 * e.g.
 *   http://localhost:5984/nrama/_design/nrama/_view/pageId_userId?key=["http://en.wikipedia.org/wiki/Komodo_dragons?h=i","steve@gmail.com"]
 */
exports.pageId_userId= {
  map : function(doc) {
    if( doc.user_id && doc.page_id ) {
      emit([doc.page_id, doc.user_id], null);
    }
  }
};


// -- author views
//    these differ almost only in order of emissions but don't have elegant way to express this relation

/**
 * to display a user's authors and, for each author, the sources
 */
exports.userId_author = {
  map : function(doc) {
    if( doc.type && doc.type == 'source' ) {
      if( doc.AUTHOR && doc.user_id ) {
        var year = doc.YEAR || 0;    //order is [null, 1965, 1990, 2000],  (typically reversed)
        for( idx in doc.AUTHOR ) {
          emit( [ doc.user_id, doc.AUTHOR[idx], 5000-year ], 1 );
        }
      }
    }
  },
  reduce : "_count"
}
/**
 * to display all sources by an author, or all of a user's sources by an author,
 * sorted by year.
 * & to display all authors with each author's sources 
 * (We are treating authors like tags; authors tag sources, not notes)
 */
exports.author_userId = {
  map : function(doc) {
    if( doc.type && doc.type == 'source' ) {
      if( doc.AUTHOR && doc.user_id ) {
        var year_order = 5000 - parseInt(doc.YEAR) || 5000;    //order is [null, 1965, 1990, 2000],  (typically reversed)
        for( idx in doc.AUTHOR ) {
          emit( [doc.AUTHOR[idx], doc.user_id, year_order], 1 );
        }
      }
    }
  },
  reduce : "_count"
};


// -- tags

/**
 * to display all tags
 */
exports.tags_all= {
  map : function(doc) {
    if( doc.type && doc.type == 'note' ) {
      if( doc.tags ) {
        for( idx in doc.tags ) {
          var tag = doc.tags[idx];
          emit([tag], 1);
        }
      }
    }
  },
  reduce : '_count'
};
exports.tags_user= {
  map : function(doc) {
    if( doc.type && doc.type == 'note' ) {
      if( doc.tags && doc.user_id ) {
        for( idx in doc.tags ) {
          var tag = doc.tags[idx];
          emit([doc.user_id, tag], 1);
        }
      }
    }
  },
  reduce : '_count'
};
/**
 * to show [all users' | a user's] notes on a tag organised by source,
 *   where the sources are sorted by most recently updated
 *
 * used with include_docs, it will grab triples of a note, a source & a quote.
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
            emit([ tag, note.user_id, note.updated ], null);                  //include the note iteself
            emit([ tag, note.user_id, note.updated ], {_id:note.source_id});  //include the source
            emit([ tag, note.user_id, note.updated ], {_id:note.quote_id});   //include the quote
          }
        }
      }
    }
  },
  reduce : "_count"
};

/**
 * for the flow, show notes by recency.  Allows a quote-centred view rather than
 *  source-centred.
 *
 * Wasteful -- emits source for every note and again for every quote.
 * Because quotes are emitted in order of CREATION (not in order notes are updated,
 * this view ends up being out of order).
 * If limited, there might be notes with missing quotes (this could happen where
 * there is a delay between creating a quote and adding a note).
 * (Could fix both problems by having updates to notes causing quotes to be updated
 * too, just as sources are.)
 *
 * Like tags, it provides note-quote-source triples and must be used with
 *  include_docs
 */ 
exports.quotes = {
  map : function(doc) {
    if( doc.type && doc.user_id && doc.source_id && doc.updated ) {
      if( doc.type == 'note' && doc.quote_id ) {
        var note = doc;
        emit([ note.user_id, note.updated ], null);                  //include the note iteself
        emit([ note.user_id, note.updated ], {_id:note.source_id});  //include the source
        //emit([ note.user_id, note.updated ], {_id:note.quote_id});   //include the quote
      }
      if( doc.type == 'quote' ) {
        var quote = doc;
        emit([ quote.user_id, quote.created ], null);
        emit([ quote.user_id, quote.created ], {_id:quote.source_id})
      }
    }
  }
};