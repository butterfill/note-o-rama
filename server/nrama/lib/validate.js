/**
 * The validate_doc_update function to be exported from the design doc.
 */

var types = require('kanso/types'),
    app_types = require('./types');


module.exports = function (newDoc, oldDoc, userCtx) {
    types.validate_doc_update(app_types, newDoc, oldDoc, userCtx);
    
    /**
     * if user_id of a documentcontains @, must be logged in as that user to make changes
     */
    var verify_user = function verify_user(user_id) {
        if( user_id && user_id[0] != '*' ) {
            if (userCtx.name == null ) {
                throw({forbidden: 'This user must be logged in to make changes (* policy). user_id:'+user_id});
            }
            if( userCtx.name != user_id ) {
                throw({forbidden: 'This user cannot make changes to another user\'s documents (* policy).user_id:'+user_id});
            }
        }
    }
    if( newDoc ) {
        verify_user(newDoc.user_id);
    }
    if( oldDoc ) {
        verify_user(oldDoc.user_id);
    }
    
};
