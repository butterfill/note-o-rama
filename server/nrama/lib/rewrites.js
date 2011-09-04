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
        from: '/users',                   //list all users; intended as an entry point for search engines : TODO needs updating!
        to: '_list/all_users/all_user_ids',
        method : 'GET',
        query : {
          group : 'true'
        } 
    },
    {
        from : '/users/:user',      //currently all sources for a particular user, probably modified in future
        to : '_list/sources/userId_source',
        query : {
            end_key: [":user"],
            start_key : [":user", {}],
            include_docs : 'true',
            descending : 'true'
        } 
    },
    {
        from : '/users/:user/sources',      //currently all sources for a particular user, probably modified in future
        to : '_list/sources/userId_source',
        query : {
            end_key: [":user"],
            start_key : [":user", {}],
            include_docs : 'true',
            descending : 'true'
        } 
    },
    {
        from : '/authors',
        to : '_list/authors/author_userId',
        query : {
            include_docs : 'true',
            descending : 'false',
            reduce : 'false',
            author_index_in_key : '0'
        }
    },
    {
        from : '/authors/:author',   //all sources for an author 
        to : '_list/authors/author_userId',
        query : {
            start_key :  [":author"],
            end_key : [":author", {}],
            include_docs : 'true',
            descending : 'false',
            reduce : 'false',
            author_index_in_key : '0'
        }
    },
    {
        from : '/users/:user/authors',              //list a user's authors
        to : '_list/authors/userId_author',
        query : {
            start_key : [":user"],
            end_key : [":user",{}],
            reduce : 'false',
            include_docs : 'true',   //docs are sources 
            author_index_in_key : '1'
        }
    },
    {
        from : '/users/:user/authors/:author',    //all sources for an author & user
        to : '_list/authors/author_userId',
        query : {
            start_key :  [":author", ":user"],
            end_key : [":author", ":user", {}],
            include_docs : 'true',
            descending : 'false',
            reduce : 'false',
            author_index_in_key : '0'
        }
    },
    {
        from : '/sources/:source',                  //everyone's notes on a source
        to : '_list/quotes/pageId_userId',
        query : {
            startkey : [":source"],
            endkey : [":source",{}],
            include_docs : 'true'
        }
    },
    {
        from : '/users/:user/sources/:source',    //the user's notes on a source
        to : '_list/quotes/pageId_userId',
        query : {
            key : [":source",":user"],
            include_docs : 'true'
        }
    },
    {
        from : '/tags',                         //all tags, with frequency
        to : '_list/tags/tags_all',
        query : {
            group : 'true',
            tag_index_in_key : '0'
        }
    },
    {
        from : '/tags/:tag',                   //show everything marked with a particular tag
        to : '_list/quotes/tags',
        query : {
            endkey : [":tag"],
            startkey : [":tag", {}],
            reduce : 'false',
            descending : 'true',
            include_docs : 'true'
        }
    },
    {
        from : '/users/:user/tags',
        to : '_list/tags/tags_user',
        query : {
            startkey : [":user"],
            endkey : [":user", {}],
            group_level : '2',
            tag_index_in_key : '1'
        }
    },
    {
        from : '/users/:user/tags/:tag',                 //show everything of a users' marked with a particular tag
        to : '_list/quotes/tags',
        query : {
          endkey : [":tag",":user"],
          startkey : [":tag", ":user", {}],
          reduce : 'false',
          descending : 'true',
          include_docs : 'true'
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
