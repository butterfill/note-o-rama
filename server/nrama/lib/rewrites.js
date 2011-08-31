/**
 * Rewrite settings to be exported from the design doc
 *
 * NB : for nrama, if path includes user info, that detail should be represented as
 *  'user_id'.  Currently this is passed into req.query so that we can recover the
 *  correct path using req.query.user_id.
 */

module.exports = [
    {from: '/static/*', to: 'static/*'},
    {from: '/xdm/*', to: 'xdm/*'},
    // -- for the nrama application
    {
        from : '/sources',              //all sources
        to : '_list/sources/source',
        query : {
            include_docs : 'true',  //for some reason it must be 'true', not true.
            descending : 'true'
        } 
    },
    {
        from : '/user/:user_id',      //all sources for a particular user
        to : '_list/sources/userId_source',
        query : {
            end_key: [":user_id"],
            start_key : [":user_id", {}],
            include_docs : 'true',
            descending : 'true'
        } 
    },
    {
        from : '/author/:author',   //all sources for an author 
        to : '_list/sources/author_userId',
        query : {
            end_key :  [":author"],
            start_key : [":author", {}],
            include_docs : 'true',
            descending : 'true'
        }
    },
    {
        from : '/user/:user_id/author/:author',    //all sources for an author & user
        to : '_list/sources/author_userId',
        query : {
            end_key :  [":author", ":user_id"],
            start_key : [":author", ":user_id", {}],
            include_docs : 'true',
            descending : 'true'
        }
    },
    {
        from : '/source/:url',                  //everyone's notes on a source
        to : '_list/source/pageId_userId',
        query : {
            startkey : [":url"],
            endkey : [":url",{}],
            include_docs : 'true'
        }
    },
    {
        from : '/user/:user_id/source/:url',    //the user's notes on a source
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
