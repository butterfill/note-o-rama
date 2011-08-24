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

exports.notes_by_page_id = {
    map: function(doc) {
        if(doc.type && doc.type=='note' &&doc.page_id ){
          emit(doc.page_id,doc);
        }
    }    
};

exports.quotes_by_page_id = {
    map : function(doc) {
        if(doc.type && doc.type=='quote' ){
          emit(doc.page_id,doc);
        }
    }
};

