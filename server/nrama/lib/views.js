/**
 * View functions to be exported from the design doc.
 */

// http://localhost:5984/nrama/_design/nrama/_view/all_user_ids
exports.all_user_ids = {
    map : function(doc) {
        if( doc.type == 'note' || doc.type == 'quote' ) {
            emit(doc.user_id,1);
        }
    },
    reduce : function(keys, values, rereduce) {
        return true;
    }
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

// http://localhost:5984/nrama/_design/nrama/_view/userId_pageId?group=true
exports.userId_pageId= {
    map : function(doc) {
            if( doc.user_id && doc.page_id ) {
                emit([doc.user_id, doc.page_id]);
            }
        },
    reduce : "_count"
};

//http://localhost:5984/nrama/_design/nrama/_view/pageId_userId?key=["http://en.wikipedia.org/wiki/Komodo_dragons?h=i","steve@gmail.com"]
exports.pageId_userId= {
    map : function(doc) {
            if( doc.user_id && doc.page_id ) {
                emit([doc.page_id, doc.user_id],doc);
            }
        }
};