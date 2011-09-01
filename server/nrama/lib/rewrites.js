/**
 * Rewrite settings to be exported from the design doc
 *
 * NB : for nrama, the parameter names matter because req.query is used
 *      in templating.  Their names must match the urls used to access them,
 *      e.g. ':user' for something reprenseted in a url as /users/:user
 *
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
        from : '/users/:user',      //all sources for a particular user
        to : '_list/sources/userId_source',
        query : {
            end_key: [":user"],
            start_key : [":user", {}],
            include_docs : 'true',
            descending : 'true'
        } 
    },
    {
        from : '/authors/:author',   //all sources for an author 
        to : '_list/sources/author_userId',
        query : {
            end_key :  [":author"],
            start_key : [":author", {}],
            include_docs : 'true',
            descending : 'true'
        }
    },
    // TODO /users/:user/authors
    {
        from : '/users/:user/authors/:author',    //all sources for an author & user
        to : '_list/sources/author_userId',
        query : {
            end_key :  [":author", ":user"],
            start_key : [":author", ":user", {}],
            include_docs : 'true',
            descending : 'true'
        }
    },
    {
        from : '/sources/:source',                  //everyone's notes on a source
        to : '_list/source/pageId_userId',
        query : {
            startkey : [":source"],
            endkey : [":source",{}],
            include_docs : 'true'
        }
    },
    {
        from : '/users/:user/sources/:source',    //the user's notes on a source
        to : '_list/source/pageId_userId',
        query : {
            key : [":source",":user"],
            include_docs : 'true'
        }
    },
    // TODO /tags
    {
        from : '/tags/:tag',                   //show everything marked with a particular tag
        to : '_list/quotes2/tags',
        query : {
          startkey : [":tag"],
          endkey : [":tag", {}],
          reduce : 'false',
          include_docs : 'true'
        }
    },
    // TODO /users/:user/tags
    {
        from : '/users/:user/tags/:tag',                 //show everything of a users' marked with a particular tag
        to : '_list/quotes2/tags',
        query : {
          startkey : [":tag",":user"],
          endkey : [":tag", ":user", {}],
          reduce : 'false',
          include_docs : 'true'
        }
    },
    {
        from: '/users',                   //list all users; intended as an entry point for search engines : TODO needs updating!
        to: '_list/all_users/all_user_ids',
        method : 'GET',
        query : {
          group : 'true'
        } 
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
