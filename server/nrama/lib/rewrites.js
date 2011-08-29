/**
 * Rewrite settings to be exported from the design doc
 *
 * NB : for nrama, if path includes user info, that detail should be represented as
 *  'user_id'.  Currently this is passed into req.query so that we can recover the
 *  correct path using req.query.user_id.
 */

module.exports = [
    // -- for the nrama application
    {from: '/static/*', to: 'static/*'},
    {
        from : '/sources',
        to : '_list/sources/source',
        query : {
            include_docs : 'true',  //for some reason it must be 'true', not true.
            descending : 'true'
        } 
    },
    {
        from : '/user/:user_id',
        to : '_list/sources/userId_source',
        query : {
            end_key: [":user_id"],
            start_key : [":user_id",{}],
            include_docs : 'true',
            descending : 'true'
        } 
    },
    {
        from : '/source/:url',
        to : '_list/source/pageId_userId',
        query : {
            startkey : [":url"],
            endkey : [":url",{}],
            include_docs : 'true'
        }
    },
    {
        from : '/user/:user_id/source/:url',
        to : '_list/source/pageId_userId',
        query : {
            key : [":url",":user_id"],
            include_docs : 'true'
        }
    },
    {
        from: '/all_users',
        to: '_list/all_users/all_user_ids',
        method : 'GET',
        query : { group : 'true' } //for some reason it must be 'true', not true.
    },
    
    // -- for the bookmarklet/embeded client
    {
        from : '/update/source/:id',
        to : '_update/source/:id'
    },
    
    // -- generic
    { from: '/', to: '_show/welcome' },
    {from: '*', to: '_show/not_found'}
];
