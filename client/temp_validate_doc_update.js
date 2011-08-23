function(newDoc, oldDoc, userCtx) {
    
    /**
     * if user name contains @, must be logged in
     */
    var verify_user = function verify_user(user_id) {
        if( user_id && user_id.indexOf('@') != -1 ) {
            if (userCtx.name == null ) {
                throw({forbidden: 'This user must be logged in to make changes (@ policy).'});
            }
            if( userCtx.name != user_id ) {
                throw({forbidden: 'This user cannot make changes to another user\'s documents (@ policy).'});
            }
        }
    }
    if( newDoc ) {
        verify_user(newDoc.user_id);
    }
    if( oldDoc ) {
        verify_user(oldDoc.user_id);
    }
}